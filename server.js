const express = require('express');
const path = require('path');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const Stripe = require('stripe');

const compression = require('compression');

const app = express();
const PORT = process.env.PORT || 3000;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// ====== STARTUP SECRETS HARDENING ======
// JWT_SECRET: en producción es OBLIGATORIO. En dev permitimos un fallback dev-only.
let JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  if (IS_PRODUCTION) {
    console.error('FATAL: JWT_SECRET env var not set in production — refusing to start.');
    process.exit(1);
  }
  JWT_SECRET = 'shiftia-dev-only-secret-not-for-prod-' + crypto.randomBytes(8).toString('hex');
  console.warn('WARNING: JWT_SECRET not set — using ephemeral dev secret. Sessions will reset on restart.');
}

// Express está detrás de proxy en Railway/Heroku/Fly — sin esto req.ip = IP del proxy y
// el rate limiter agrupa todo el tráfico bajo una sola IP.
app.set('trust proxy', 1);

// ====== TIMEZONE BOOKING ======
// Toda la aplicación de booking opera en horario de Madrid (Europe/Madrid).
const BOOKING_TIMEZONE = process.env.BOOKING_TIMEZONE || 'Europe/Madrid';
const BOOKING_MIN_LEAD_HOURS = Number(process.env.BOOKING_MIN_LEAD_HOURS || 4);
const BOOKING_HORIZON_DAYS = Number(process.env.BOOKING_HORIZON_DAYS || 60);
const BOOKING_LUNCH_BLOCK = (process.env.BOOKING_LUNCH_BLOCK || '14:00,14:30,15:00').split(',').map(s => s.trim()).filter(Boolean);
const BOOKING_SLOT_MINUTES = Number(process.env.BOOKING_SLOT_MINUTES || 30); // 30 → :00 y :30; 60 → solo :00
const BOOKING_HOUR_START = Number(process.env.BOOKING_HOUR_START || 9);
const BOOKING_HOUR_END = Number(process.env.BOOKING_HOUR_END || 18);
const BOOKING_CANCEL_SECRET = process.env.BOOKING_CANCEL_SECRET || JWT_SECRET; // HMAC para tokens de cancelar

// ====== STRIPE CONFIG ======
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
const APP_URL = process.env.APP_URL || 'https://shiftia.es';

// Stripe price IDs — set these in Railway after creating products in Stripe dashboard
const STRIPE_PRICES = {
  starter_monthly:  process.env.STRIPE_PRICE_STARTER_MONTHLY  || '',
  starter_annual:   process.env.STRIPE_PRICE_STARTER_ANNUAL   || '',
  pro_monthly:      process.env.STRIPE_PRICE_PRO_MONTHLY      || '',
  pro_annual:       process.env.STRIPE_PRICE_PRO_ANNUAL       || '',
  business_monthly: process.env.STRIPE_PRICE_BUSINESS_MONTHLY || '',
  business_annual:  process.env.STRIPE_PRICE_BUSINESS_ANNUAL  || '',
};

// Stripe webhook MUST receive raw body — register BEFORE express.json()
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!stripe) return res.status(503).json({ error: 'Stripe not configured' });
  // Requerimos firma SIEMPRE — sin excepción dev, para evitar que el webhook
  // se convierta en un panel de admin abierto en cualquier entorno.
  if (!STRIPE_WEBHOOK_SECRET) {
    console.error('Stripe webhook rejected: STRIPE_WEBHOOK_SECRET not configured');
    return res.status(503).json({ error: 'Webhook secret not configured' });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Stripe webhook signature failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Idempotencia: si ya procesamos este event.id, ack inmediato.
  // Stripe reintenta hasta 3 días si no devolvemos 2xx — sin esto, cada retry
  // duplicaba updates de plan y emails de confirmación.
  try {
    const ins = await pool.query(
      'INSERT INTO stripe_processed_events (event_id, event_type) VALUES ($1, $2) ON CONFLICT (event_id) DO NOTHING RETURNING event_id',
      [event.id, event.type]
    );
    if (ins.rowCount === 0) {
      console.log('Stripe webhook duplicate (already processed):', event.id, event.type);
      return res.json({ received: true, duplicate: true });
    }
  } catch (dedupErr) {
    // Si la tabla aún no existe (primer arranque), seguimos — initializeDatabase la creará.
    if (!/does not exist/i.test(dedupErr.message)) {
      console.error('Stripe dedup error:', dedupErr.message);
      return res.status(500).json({ error: 'dedup' }); // Stripe reintentará
    }
  }

  console.log('Stripe webhook:', event.type, event.id);

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.metadata?.user_id;
        const plan = session.metadata?.plan;
        const billing = session.metadata?.billing;
        const stripeCustomerId = session.customer;
        const subscriptionId = session.subscription;

        if (userId && plan) {
          const workersMap = { starter: 15, pro: 40, business: -1 };
          await pool.query(
            `UPDATE users SET plan = $1, plan_status = 'active', workers_limit = $2,
             stripe_customer_id = $3, stripe_subscription_id = $4, billing_cycle = $5,
             next_billing_date = NOW() + INTERVAL '1 ${billing === 'annual' ? 'year' : 'month'}'
             WHERE id = $6`,
            [plan, workersMap[plan] || 15, stripeCustomerId, subscriptionId, billing || 'monthly', userId]
          );
          console.log(`Plan updated: user ${userId} → ${plan} (${billing})`);

          // Fire-and-forget payment confirmation email
          const userInfo = await pool.query('SELECT email, name FROM users WHERE id = $1', [userId]);
          if (userInfo.rows.length > 0) {
            const { email, name } = userInfo.rows[0];
            const planNames = { starter: 'Starter', pro: 'Pro', business: 'Business' };
            const planPrices = {
              starter: { monthly: '20€/mes', annual: '192€/año' },
              pro: { monthly: '30€/mes', annual: '288€/año' },
              business: { monthly: '50€/mes', annual: '480€/año' }
            };
            const amount = planPrices[plan] ? planPrices[plan][billing === 'annual' ? 'annual' : 'monthly'] : 'contactar';
            const esc = (str) => String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

            sendMail({
              from: RESEND_FROM,
              to: email,
              subject: `Tu plan Shiftia ${planNames[plan]} está activo`,
              html: emailTemplate({
                preheader: 'Tu suscripción a Shiftia ha sido activada correctamente',
                headline: 'Plan activado',
                body: `
                  <p style="margin:0 0 16px;">Hola ${esc(name)},</p>
                  <p style="margin:0 0 20px;">Tu suscripción a Shiftia ha sido activada correctamente. Gracias por confiar en nosotros.</p>
                  <div style="margin:24px 0;padding:24px;background:#faf9f6;border-radius:10px;border:1px solid #ece9e2;">
                    <p style="color:#7a766f;font-size:12px;text-transform:uppercase;letter-spacing:0.06em;margin:0 0 14px;">Detalles de tu suscripción</p>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr><td style="font-size:13px;color:#7a766f;padding:6px 16px 6px 0;width:140px;">Plan</td><td style="font-size:15px;color:#0e0f0f;">${planNames[plan]}</td></tr>
                      <tr><td style="font-size:13px;color:#7a766f;padding:6px 16px 6px 0;">Ciclo</td><td style="font-size:15px;color:#1a1a1a;">${billing === 'annual' ? 'Anual' : 'Mensual'}</td></tr>
                      <tr><td style="font-size:13px;color:#7a766f;padding:6px 16px 6px 0;">Importe</td><td style="font-size:15px;color:#0e0f0f;">${amount}</td></tr>
                    </table>
                  </div>
                  <p style="margin:0 0 20px;">Tienes acceso completo a todas las características de tu plan. Si en los próximos 30 días no estás completamente satisfecho, podemos devolverte el dinero sin preguntas.</p>
                  <p style="margin:24px 0 0;font-size:14px;color:#7a766f;">Si tienes alguna pregunta sobre tu suscripción, no dudes en responder a este email. Estamos aquí para ayudarte.</p>
                `,
                ctaText: 'Ir a mi dashboard',
                ctaUrl: `${APP_URL}/dashboard`
              })
            }).then(() => console.log('Payment confirmation email sent to', email)).catch(err => console.error('Payment confirmation email failed:', err.message));
          }
        }
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object;
        const status = sub.status; // active, past_due, canceled, unpaid
        const planStatus = status === 'active' ? 'active' : (status === 'canceled' ? 'cancelled' : 'past_due');

        // C6: Refresh plan / workers_limit / billing_cycle / next_billing_date from price.id.
        // Stripe sends this event on plan upgrades, downgrades, and renewal cycles.
        const priceId = sub.items?.data?.[0]?.price?.id;
        let matched = null; // { plan, billing }
        if (priceId) {
          for (const [key, val] of Object.entries(STRIPE_PRICES)) {
            if (val && val === priceId) {
              const idx = key.lastIndexOf('_');
              if (idx > 0) {
                matched = { plan: key.slice(0, idx), billing: key.slice(idx + 1) };
              }
              break;
            }
          }
        }

        if (matched) {
          const workersMap = { starter: 15, pro: 40, business: -1 };
          const workersLimit = workersMap[matched.plan] != null ? workersMap[matched.plan] : 15;
          // Use parameterized UPDATE; match by stripe_subscription_id (reliable) instead of metadata.user_id.
          await pool.query(
            `UPDATE users
               SET plan = $1,
                   workers_limit = $2,
                   billing_cycle = $3,
                   plan_status = $4,
                   next_billing_date = ${sub.current_period_end ? 'TO_TIMESTAMP($6)' : 'next_billing_date'}
             WHERE stripe_subscription_id = $5`,
            sub.current_period_end
              ? [matched.plan, workersLimit, matched.billing, planStatus, sub.id, Number(sub.current_period_end)]
              : [matched.plan, workersLimit, matched.billing, planStatus, sub.id]
          );
          console.log(`Subscription updated → ${matched.plan} (${matched.billing}) status=${status} sub=${sub.id}`);
        } else {
          // Fallback: only refresh plan_status (previous behaviour). Match by sub id (more reliable than metadata).
          await pool.query(
            `UPDATE users SET plan_status = $1 WHERE stripe_subscription_id = $2`,
            [planStatus, sub.id]
          );
          if (sub.metadata?.user_id) {
            await pool.query(
              `UPDATE users SET plan_status = $1 WHERE id = $2`,
              [planStatus, sub.metadata.user_id]
            );
          }
          console.log(`Subscription ${status} (no price match) for sub ${sub.id}`);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        if (sub.metadata?.user_id) {
          const prevUser = await pool.query('SELECT email, name, plan FROM users WHERE id = $1', [sub.metadata.user_id]);
          await pool.query(
            `UPDATE users SET plan = 'trial', plan_status = 'active', workers_limit = 25,
             stripe_subscription_id = NULL, billing_cycle = NULL WHERE id = $1`,
            [sub.metadata.user_id]
          );
          console.log(`Subscription cancelled → trial for user ${sub.metadata.user_id}`);

          // Send cancellation confirmation email
          if (prevUser.rows.length > 0) {
            const { email, name, plan } = prevUser.rows[0];
            const esc = (str) => String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
            const planNames = { starter: 'Starter', pro: 'Pro', business: 'Business' };
            sendMail({
              from: RESEND_FROM,
              to: email,
              replyTo: process.env.SUPPORT_EMAIL || GMAIL_USER,
              subject: 'Tu suscripción a Shiftia ha sido cancelada',
              html: emailTemplate({
                preheader: 'Tu suscripción ha sido cancelada. Puedes reactivarla cuando quieras.',
                headline: 'Suscripción cancelada',
                body: `
                  <p style="margin:0 0 16px;">Hola ${esc(name)},</p>
                  <p style="margin:0 0 16px;">Te confirmamos que tu plan <span style="color:#0e0f0f;">${planNames[plan] || plan}</span> ha sido cancelado. Tu cuenta seguirá activa pero con funcionalidad limitada.</p>
                  <p style="margin:0 0 20px;">Si quieres volver, puedes reactivar tu suscripción en cualquier momento desde tu panel.</p>
                  <p style="margin:24px 0 0;font-size:14px;color:#7a766f;">Te echamos de menos. Si necesitas ayuda, responde a este email.</p>
                `,
                ctaText: 'Reactivar suscripción',
                ctaUrl: `${APP_URL}/dashboard`
              })
            }).then(() => console.log('Cancellation email sent to', email)).catch(err => console.error('Cancellation email failed:', err.message));
          }
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        console.warn('Payment failed for customer:', invoice.customer);

        // Fire-and-forget payment failed dunning email
        const custResult = await pool.query('SELECT id, email, name, plan FROM users WHERE stripe_customer_id = $1', [invoice.customer]);
        if (custResult.rows.length > 0) {
          const { email, name, plan } = custResult.rows[0];
          const planNames = { starter: 'Starter', pro: 'Pro', business: 'Business' };
          const esc = (str) => String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

          sendMail({
            from: RESEND_FROM,
            to: email,
            subject: 'Hay un problema con tu pago — Shiftia',
            html: emailTemplate({
              preheader: 'Actualiza tu método de pago para mantener tu cuenta activa',
              headline: 'Problema con el pago',
              body: `
                <p style="margin:0 0 16px;">Hola ${esc(name)},</p>
                <p style="margin:0 0 20px;">No hemos podido procesar el pago de tu suscripción a Shiftia ${planNames[plan] || plan}. Esto suele ocurrir por una tarjeta caducada o fondos insuficientes — no te preocupes, es fácil de resolver.</p>
                <div style="margin:24px 0;padding:24px;background:#faf9f6;border-radius:10px;border:1px solid #ece9e2;">
                  <p style="color:#7a766f;font-size:12px;text-transform:uppercase;letter-spacing:0.06em;margin:0 0 14px;">Pago no procesado</p>
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr><td style="font-size:13px;color:#7a766f;padding:6px 16px 6px 0;width:160px;">Plan</td><td style="font-size:15px;color:#0e0f0f;">${planNames[plan] || plan}</td></tr>
                    <tr><td style="font-size:13px;color:#7a766f;padding:6px 16px 6px 0;">Fecha del intento</td><td style="font-size:15px;color:#1a1a1a;">${new Date().toLocaleDateString('es-ES')}</td></tr>
                  </table>
                </div>
                <p style="margin:0 0 20px;">Reintentaremos el cobro en 3 días. Para evitar interrupciones en tu servicio, puedes actualizar tu método de pago ahora.</p>
                <p style="margin:24px 0 0;font-size:14px;color:#7a766f;">Si tienes alguna pregunta, responde a este email y te ayudamos.</p>
              `,
              ctaText: 'Actualizar método de pago',
              ctaUrl: `${APP_URL}/dashboard`
            })
          }).then(() => console.log('Payment failed email sent to', email)).catch(err => console.error('Payment failed email failed:', err.message));
        }
        break;
      }
    }
  } catch (err) {
    console.error('Webhook handler error:', event && event.id, event && event.type, err.message);
    // Devolver 500 → Stripe reintentará. Y borramos la fila de dedup para que el
    // retry se procese (en caso contrario el siguiente intento pensaría que ya
    // fue procesado).
    try {
      await pool.query('DELETE FROM stripe_processed_events WHERE event_id = $1', [event.id]);
    } catch (_) { /* swallow */ }
    return res.status(500).json({ error: 'Internal webhook error' });
  }

  res.json({ received: true });
});

// ====== SECURITY & PERFORMANCE MIDDLEWARE ======
// Gzip/brotli compression for all responses
app.use(compression());

// Security headers (lightweight helmet alternative — no extra dependency)
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  // X-XSS-Protection removed: legacy header, deprecated by all major browsers and may
  // introduce vulnerabilities. Modern protection comes via the Content-Security-Policy below.
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  // M3: Content Security Policy — restricts script/style/connect/frame sources.
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' https://js.stripe.com https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: https:; connect-src 'self' https://api.stripe.com; frame-src https://js.stripe.com https://hooks.stripe.com https://checkout.stripe.com; object-src 'none'; base-uri 'self'; form-action 'self';");
  // Strict Transport Security (HTTPS only) — reinforced: 2-year max-age + preload
  if (IS_PRODUCTION) {
    res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  }
  next();
});

app.use(express.json({ limit: '50kb' }));
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: process.env.NODE_ENV === 'production' ? '7d' : 0,
  etag: true,
  lastModified: true,
  setHeaders: (res, filePath) => {
    // Performance: long-cache (30 días) para assets estáticos críticos de la landing,
    // 5 min para HTML para permitir invalidar copy rápidamente.
    const longCacheAssets = new Set([
      'design-system.css',
      'favicon.svg',
      'apple-touch-icon.svg',
      'og-image.svg',
      'product-mockup.svg'
    ]);
    const base = path.basename(filePath);
    const ext = path.extname(filePath).toLowerCase();
    if (longCacheAssets.has(base) || ext === '.woff2') {
      res.setHeader('Cache-Control', 'public, max-age=2592000');
    } else if (ext === '.html') {
      res.setHeader('Cache-Control', 'public, max-age=300');
    }
  }
}));

// ====== DATABASE CONFIG ======
// Filter out undefined values to avoid overriding connectionString
const poolConfig = process.env.DATABASE_URL
  ? { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }
  : {
      host: process.env.PGHOST,
      port: process.env.PGPORT || 5432,
      database: process.env.PGDATABASE,
      user: process.env.PGUSER,
      password: process.env.PGPASSWORD,
    };

const pool = new Pool(poolConfig);

// Test database connection
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

// ====== DATABASE INITIALIZATION ======
async function initializeDatabase() {
  try {
    const client = await pool.connect();

    // Create users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        company VARCHAR(255),
        plan VARCHAR(50) DEFAULT 'trial',
        plan_status VARCHAR(50) DEFAULT 'active',
        workers_limit INTEGER DEFAULT 25,
        next_billing_date DATE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Add Stripe columns if missing
    const stripeCols = [
      { name: 'stripe_customer_id', type: 'VARCHAR(255)' },
      { name: 'stripe_subscription_id', type: 'VARCHAR(255)' },
      { name: 'billing_cycle', type: "VARCHAR(20) DEFAULT 'monthly'" }
    ];
    for (const col of stripeCols) {
      await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}`).catch(() => {});
    }

    // Create support tickets table
    await client.query(`
      CREATE TABLE IF NOT EXISTS support_tickets (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        category VARCHAR(50) DEFAULT 'general',
        subject VARCHAR(500) NOT NULL,
        message TEXT NOT NULL,
        status VARCHAR(50) DEFAULT 'open',
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Create bookings table
    await client.query(`
      CREATE TABLE IF NOT EXISTS bookings (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        phone VARCHAR(50) NOT NULL,
        company VARCHAR(255),
        workers VARCHAR(50),
        department VARCHAR(255),
        message TEXT,
        booking_date DATE NOT NULL,
        booking_time VARCHAR(10) NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Create contact leads table
    await client.query(`
      CREATE TABLE IF NOT EXISTS contact_leads (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        company VARCHAR(255),
        workers VARCHAR(50),
        department VARCHAR(255),
        message TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Create password reset tokens table
    await client.query(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        token VARCHAR(255) UNIQUE NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        used BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Idempotencia de webhooks Stripe — sin esto, los retries duplican efectos.
    await client.query(`
      CREATE TABLE IF NOT EXISTS stripe_processed_events (
        event_id VARCHAR(255) PRIMARY KEY,
        event_type VARCHAR(100),
        processed_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Calendar slots bloqueados por el admin (festivos, vacaciones, etc.)
    await client.query(`
      CREATE TABLE IF NOT EXISTS blocked_dates (
        id SERIAL PRIMARY KEY,
        block_date DATE UNIQUE NOT NULL,
        reason VARCHAR(255),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // ===== Migraciones bookings (Fase 12 booking overhaul) =====
    // 1. Añadir booking_at TIMESTAMPTZ + cancel_token + email_status + audit fields
    const bookingCols = [
      { name: 'booking_at',      type: 'TIMESTAMPTZ' },
      { name: 'cancel_token',    type: 'VARCHAR(64)' },
      { name: 'email_status',    type: "VARCHAR(20) DEFAULT 'pending'" },
      { name: 'email_error',     type: 'TEXT' },
      { name: 'cancelled_at',    type: 'TIMESTAMPTZ' },
      { name: 'cancellation_reason', type: 'TEXT' },
      { name: 'updated_at',      type: 'TIMESTAMPTZ DEFAULT NOW()' },
      { name: 'ip',              type: 'VARCHAR(64)' },
      { name: 'user_agent',      type: 'VARCHAR(255)' }
    ];
    for (const col of bookingCols) {
      await client.query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}`).catch(() => {});
    }
    // Backfill booking_at desde booking_date+booking_time si está vacío
    await client.query(`
      UPDATE bookings
      SET booking_at = ((booking_date::text || ' ' || booking_time)::timestamp AT TIME ZONE 'Europe/Madrid')
      WHERE booking_at IS NULL AND booking_date IS NOT NULL AND booking_time IS NOT NULL
    `).catch(err => console.warn('Booking backfill skipped:', err.message));

    // 2. UNIQUE PARTIAL index — evita doble-booking del mismo slot
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_slot_unique
      ON bookings(booking_at)
      WHERE status != 'cancelled' AND booking_at IS NOT NULL
    `).catch(err => console.warn('Booking unique index skipped:', err.message));

    // 3. Índices auxiliares (Stripe customer, lookups frecuentes)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_users_stripe_customer ON users(stripe_customer_id)`).catch(() => {});
    await client.query(`CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users(LOWER(email))`).catch(() => {});
    await client.query(`CREATE INDEX IF NOT EXISTS idx_prt_token ON password_reset_tokens(token) WHERE used = false`).catch(() => {});
    await client.query(`CREATE INDEX IF NOT EXISTS idx_bookings_email ON bookings(email)`).catch(() => {});
    await client.query(`CREATE INDEX IF NOT EXISTS idx_bookings_status_date ON bookings(status, booking_at)`).catch(() => {});
    await client.query(`CREATE INDEX IF NOT EXISTS idx_contact_leads_created ON contact_leads(created_at DESC)`).catch(() => {});

    // Seed de festivos nacionales ES — solo si la tabla está vacía
    try {
      const c = await client.query('SELECT COUNT(*)::int AS n FROM blocked_dates');
      if (c.rows[0].n === 0) {
        const festivos = [
          // 2026
          ['2026-01-01', 'Año Nuevo'], ['2026-01-06', 'Reyes'],
          ['2026-04-03', 'Viernes Santo'], ['2026-05-01', 'Día del Trabajo'],
          ['2026-08-15', 'Asunción'], ['2026-10-12', 'Fiesta Nacional'],
          ['2026-11-02', 'Todos los Santos (trasladado)'], ['2026-12-07', 'Constitución (trasladado)'],
          ['2026-12-08', 'Inmaculada'], ['2026-12-25', 'Navidad'],
          // 2027
          ['2027-01-01', 'Año Nuevo'], ['2027-01-06', 'Reyes'],
          ['2027-03-26', 'Viernes Santo'],
          ['2027-08-16', 'Asunción (trasladado)'], ['2027-10-12', 'Fiesta Nacional'],
          ['2027-11-01', 'Todos los Santos'], ['2027-12-06', 'Constitución'],
          ['2027-12-08', 'Inmaculada'], ['2027-12-25', 'Navidad']
        ];
        for (const [d, reason] of festivos) {
          await client.query('INSERT INTO blocked_dates (block_date, reason) VALUES ($1, $2) ON CONFLICT DO NOTHING', [d, reason]);
        }
        console.log(`Seeded ${festivos.length} festivos nacionales ES en blocked_dates`);
      }
    } catch (seedErr) {
      console.warn('Festivos seed skipped:', seedErr.message);
    }

    console.log('Database initialized: all tables, indexes and migrations applied');

    // Seed admin user (password from env var — never hardcoded)
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@shiftia.es';
    const adminPassword = process.env.ADMIN_PASSWORD;
    const existingAdmin = await client.query('SELECT id FROM users WHERE email = $1', [adminEmail]);

    if (existingAdmin.rows.length === 0 && adminPassword) {
      const hashedPassword = await bcrypt.hash(adminPassword, 12);
      await client.query(`
        INSERT INTO users (email, password_hash, name, company, plan, plan_status, workers_limit)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [adminEmail, hashedPassword, 'Administrador', 'Shiftia', 'enterprise', 'active', 1000]);
      console.log('Admin user created:', adminEmail);
    } else if (existingAdmin.rows.length === 0 && !adminPassword) {
      console.warn('ADMIN_PASSWORD env var not set — skipping admin seed. Set it in Railway to create admin user.');
    }

    client.release();
  } catch (err) {
    console.error('Database initialization error:', err.message);
    process.exit(1);
  }
}

// ====== MIDDLEWARE ======
// JWT Authentication Middleware
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.slice(7);

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = { id: decoded.userId || decoded.id, email: decoded.email };
    next();
  } catch (err) {
    console.error('Token verification error:', err.message);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// ====== HELPER FUNCTIONS ======
// Validate email format
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// A10: server-side length cap helper (used across auth, contact, support, booking)
function cap(s, n) { return String(s == null ? '' : s).slice(0, n); }

// ====== EMAIL CONFIG ======
const GMAIL_USER = process.env.GMAIL_USER || 'highkeycvsender@gmail.com';
const GMAIL_PASS = process.env.GMAIL_APP_PASSWORD || '';

let transporter = null;
let emailReady = false;
let emailError = null;

// RESEND_API_KEY takes priority (HTTP-based, works everywhere)
// Falls back to GMAIL SMTP if no Resend key
const RESEND_KEY = process.env.RESEND_API_KEY || '';

if (RESEND_KEY) {
  // Resend HTTP API — no SMTP, no blocked ports
  emailReady = true;
  emailError = null;
  console.log('Email OK via Resend API (HTTP)');
} else if (GMAIL_PASS) {
  // Try multiple SMTP configs — some hosts block certain ports
  const smtpConfigs = [
    { name: 'STARTTLS-587', host: 'smtp.gmail.com', port: 587, secure: false },
    { name: 'SSL-465', host: 'smtp.gmail.com', port: 465, secure: true },
    { name: 'service', service: 'gmail' }
  ];

  (async function tryConnect() {
    for (const cfg of smtpConfigs) {
      try {
        const opts = { auth: { user: GMAIL_USER, pass: GMAIL_PASS }, connectionTimeout: 8000, greetingTimeout: 8000, socketTimeout: 8000 };
        if (cfg.service) opts.service = cfg.service;
        else { opts.host = cfg.host; opts.port = cfg.port; opts.secure = cfg.secure; }
        const t = nodemailer.createTransport(opts);
        await t.verify();
        transporter = t;
        emailReady = true;
        emailError = null;
        console.log(`Email OK via Gmail ${cfg.name} as ${GMAIL_USER}`);
        return;
      } catch (err) {
        console.warn(`Gmail ${cfg.name}: ${err.message}`);
        emailError = `${cfg.name}: ${err.message}`;
      }
    }
    emailReady = false;
    console.error('Email FAILED: all SMTP configs failed —', emailError);
    console.error('TIP: Add RESEND_API_KEY for reliable email (resend.com, free 100/day)');
  })();
} else {
  console.warn('Email DISABLED: set RESEND_API_KEY or GMAIL_APP_PASSWORD');
}

// Resend verified domain — change once you verify shiftia.es in Resend dashboard
const RESEND_FROM = process.env.RESEND_FROM || 'Shiftia <onboarding@resend.dev>';

// Safe send helper — uses Resend API or Gmail SMTP
function sendMail(options) {
  if (RESEND_KEY) {
    // Resend free tier: MUST use onboarding@resend.dev (or your verified domain)
    // Extract display name from original "from" for friendlier emails
    const displayMatch = (options.from || '').match(/^"?([^"<]+)"?\s*</);
    const displayName = displayMatch ? displayMatch[1].trim() : 'Shiftia';
    const fromAddr = RESEND_FROM.includes('<') ? RESEND_FROM : `${displayName} <${RESEND_FROM}>`;

    const payload = {
      from: fromAddr,
      to: Array.isArray(options.to) ? options.to : [options.to],
      subject: options.subject,
      html: options.html,
      reply_to: options.replyTo || GMAIL_USER
    };

    console.log(`Resend: sending to ${payload.to.join(', ')} — ${payload.subject}`);

    return fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    .then(async r => {
      const body = await r.json();
      if (!r.ok) {
        console.error('Resend API error:', r.status, JSON.stringify(body));
        throw new Error(body.message || JSON.stringify(body));
      }
      console.log('Email sent OK (Resend):', options.subject, '→', payload.to.join(', '));
      return body;
    })
    .catch(err => { console.error('Resend failed:', err.message); });
  }

  if (transporter && emailReady) {
    return transporter.sendMail(options)
      .then(info => { console.log('Email sent (SMTP):', options.subject); return info; })
      .catch(err => { console.error('SMTP error:', err.message); });
  }

  console.warn('Email skip: no email provider available');
  return Promise.resolve();
}

// ====== EMAIL TEMPLATE — Premium minimal Shiftia ======
// Wrapper coherente con la web: off-white #faf9f6, accent teal #0f7a6d, CTA negro #0e0f0f,
// Instrument Serif (display) + Geist (body) cargados desde Google Fonts (con fallback system-ui),
// max-width 580px, tablas inline para Outlook, preheader oculto para preview en Gmail/Outlook.
//
// Uso:
//   emailTemplate({
//     preheader: 'Texto que aparece en el preview del cliente',
//     headline:  'Título grande en serif',
//     body:      '<p>HTML del cuerpo.</p><p>Otro párrafo.</p>',
//     ctaText:   'Ir a mi dashboard',   // opcional
//     ctaUrl:    'https://...',          // opcional
//     footer:    'Texto adicional para el footer (opcional, debajo de la dirección)'
//   })
function emailTemplate(opts) {
  const {
    preheader = '',
    headline = '',
    body = '',
    ctaText = '',
    ctaUrl = '',
    footer = ''
  } = opts || {};

  const cta = (ctaText && ctaUrl) ? `
                <tr>
                  <td align="left" style="padding:8px 0 4px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td align="center" bgcolor="#0e0f0f" style="background-color:#0e0f0f;border-radius:10px;">
                          <a href="${ctaUrl}" target="_blank" style="display:inline-block;padding:14px 24px;color:#ffffff;font-size:15px;font-weight:500;text-decoration:none;font-family:'Geist',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;letter-spacing:-0.005em;line-height:1;">${ctaText}</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>` : '';

  const footerExtra = footer ? `<p style="margin:0 0 10px;font-size:12px;color:#7a766f;line-height:1.55;">${footer}</p>` : '';

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="color-scheme" content="light only">
  <meta name="supported-color-schemes" content="light">
  <title>Shiftia</title>
  <!--[if mso]>
  <style type="text/css">table{border-collapse:collapse;mso-table-lspace:0;mso-table-rspace:0;} td{mso-line-height-rule:exactly;}</style>
  <![endif]-->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Geist:wght@300;400;500;600&display=swap');
    body{margin:0!important;padding:0!important;width:100%!important;background-color:#faf9f6;}
    table{border-spacing:0;}
    img{border:0;line-height:100%;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;}
    a{color:#0f7a6d;text-decoration:underline;text-underline-offset:2px;}
    .sh-headline{font-family:'Instrument Serif','Times New Roman',Georgia,serif;font-weight:400;color:#0e0f0f;line-height:1.15;letter-spacing:-0.01em;font-size:32px;margin:0 0 20px;}
    @media (max-width:600px){
      .sh-container{width:100%!important;max-width:100%!important;}
      .sh-pad{padding-left:24px!important;padding-right:24px!important;}
      .sh-headline{font-size:26px!important;}
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#faf9f6;font-family:'Geist',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:#1a1a1a;-webkit-font-smoothing:antialiased;">

<!-- Preheader (oculto, aparece como preview en Gmail/Outlook) -->
<div style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;max-height:0;max-width:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;">
  ${preheader}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#faf9f6;">
  <tr>
    <td align="center" style="padding:40px 16px 56px;">
      <table role="presentation" class="sh-container" width="580" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:580px;background-color:#faf9f6;">

        <!-- Brand header -->
        <tr>
          <td class="sh-pad" style="padding:0 40px 32px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="vertical-align:middle;font-family:'Instrument Serif','Times New Roman',Georgia,serif;font-size:24px;font-weight:400;color:#0e0f0f;letter-spacing:-0.01em;line-height:1;">Shiftia</td>
                <td style="vertical-align:middle;padding-left:8px;line-height:1;">
                  <span style="display:inline-block;width:6px;height:6px;background-color:#0f7a6d;border-radius:50%;vertical-align:middle;"></span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Card -->
        <tr>
          <td class="sh-pad" style="padding:0 40px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#ffffff;border:1px solid #ece9e2;border-radius:14px;">
              <tr>
                <td class="sh-pad" style="padding:40px 40px 36px;">
                  <h1 class="sh-headline">${headline}</h1>
                  <div style="font-family:'Geist',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:16px;line-height:1.6;color:#33312d;">
                    ${body}
                  </div>
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:8px;">${cta}
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td class="sh-pad" style="padding:32px 40px 0;">
            ${footerExtra}
            <p style="margin:0 0 10px;font-size:12px;color:#7a766f;line-height:1.55;font-family:'Geist',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
              Shiftia &middot; Planificación de turnos para equipos sanitarios.<br>
              Madrid, España &middot; <a href="mailto:hola@shiftia.es" style="color:#7a766f;text-decoration:underline;">hola@shiftia.es</a>
            </p>
            <p style="margin:0;font-size:12px;color:#9a958c;line-height:1.55;font-family:'Geist',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
              <a href="${APP_URL}/privacidad" style="color:#9a958c;text-decoration:underline;">Privacidad</a>
              &nbsp;&middot;&nbsp;
              <a href="${APP_URL}/dashboard#settings" style="color:#9a958c;text-decoration:underline;">Preferencias</a>
              &nbsp;&middot;&nbsp;
              <a href="${APP_URL}/unsubscribe" style="color:#9a958c;text-decoration:underline;">Darme de baja</a>
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>

</body>
</html>`;
}

// ====== AUTHENTICATION ROUTES ======
// Rate limit middleware for auth endpoints
function authRateLimit(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress;
  if (isRateLimited(ip, RATE_LIMIT_MAX_AUTH)) {
    return res.status(429).json({ error: 'Demasiados intentos. Espera un momento antes de reintentar.' });
  }
  next();
}

// POST /api/auth/register
app.post('/api/auth/register', authRateLimit, async (req, res) => {
  try {
    let { email, password, name, company } = req.body;

    // Validate required fields
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name are required' });
    }

    // A10 + B12: normalize and cap inputs before any validation / DB
    email = String(email || '').trim().toLowerCase();
    if (email.length > 254) {
      return res.status(400).json({ error: 'Email demasiado largo' });
    }
    name    = cap(String(name).trim(), 120);
    company = cap(String(company || '').trim(), 160);

    // Validate email format
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Validate password strength (at least 8 chars)
    if (password.length < 8) {
      return res.status(400).json({ error: 'La contrasena debe tener al menos 8 caracteres' });
    }

    // Check if email already exists (case-insensitive via idx_users_email_lower)
    const existingUser = await pool.query('SELECT id FROM users WHERE LOWER(email) = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'Email already exists' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Insert user
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, name, company, plan, plan_status, workers_limit)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, email, name, company, plan, plan_status, workers_limit, created_at`,
      [email, passwordHash, name, company || null, 'trial', 'active', 25]
    );

    const user = result.rows[0];

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.status(201).json({ token, user });

    // Fire-and-forget welcome email (don't block response)
    const esc = (str) => String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    sendMail({
      from: `"Shiftia" <${GMAIL_USER}>`,
      replyTo: process.env.SUPPORT_EMAIL || GMAIL_USER,
      to: user.email,
      subject: 'Bienvenido a Shiftia — tu planificación de turnos empieza aquí',
      html: emailTemplate({
        preheader: 'Crea tu primera planilla en menos de 5 minutos',
        headline: 'Bienvenido a Shiftia',
        body: `
          <p style="margin:0 0 16px;">Hola ${esc(user.name)},</p>
          <p style="margin:0 0 16px;">Acabas de dar un paso importante para simplificar la planificación de turnos${user.company ? ' en ' + esc(user.company) : ''}. Shiftia se encarga de lo complejo para que tú puedas centrarte en tu equipo.</p>
          <p style="margin:24px 0 12px;font-weight:500;color:#0e0f0f;">Empieza en 3 pasos:</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
            <tr><td style="padding:10px 0;border-bottom:1px solid #ece9e2;font-size:15px;color:#33312d;"><span style="display:inline-block;width:22px;color:#0f7a6d;font-variant-numeric:tabular-nums;">01</span>&nbsp;Crea tu primera planilla con los turnos de tu servicio</td></tr>
            <tr><td style="padding:10px 0;border-bottom:1px solid #ece9e2;font-size:15px;color:#33312d;"><span style="display:inline-block;width:22px;color:#0f7a6d;font-variant-numeric:tabular-nums;">02</span>&nbsp;Añade a los trabajadores de tu equipo</td></tr>
            <tr><td style="padding:10px 0;font-size:15px;color:#33312d;"><span style="display:inline-block;width:22px;color:#0f7a6d;font-variant-numeric:tabular-nums;">03</span>&nbsp;Deja que la IA sugiera las coberturas óptimas</td></tr>
          </table>
          <p style="margin:24px 0 0;font-size:14px;color:#7a766f;">Si necesitas ayuda, responde a este email o agenda una llamada con nuestro equipo. Estamos aquí para hacer tu transición lo más fácil posible.</p>
        `,
        ctaText: 'Ir a mi dashboard',
        ctaUrl: `${APP_URL}/dashboard`
      })
    }).then(() => console.log('Welcome email sent to', user.email)).catch(err => console.error('Welcome email failed:', err.message));

  } catch (err) {
    console.error('Register error:', err.message);
    res.status(500).json({ error: 'Error creating account' });
  }
});

// POST /api/auth/login
app.post('/api/auth/login', authRateLimit, async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user by email (case-insensitive via index idx_users_email_lower)
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const result = await pool.query('SELECT * FROM users WHERE LOWER(email) = $1', [normalizedEmail]);
    if (result.rows.length === 0) {
      // A4: Timing-safe — run a dummy bcrypt compare so response time does not leak email existence
      await bcrypt.compare(password, '$2a$10$abcdefghijklmnopqrstuv.................................').catch(() => {});
      return res.status(401).json({ error: 'Email o contraseña incorrectos' });
    }

    const user = result.rows[0];

    // Compare password
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    // Return user without password_hash
    const { password_hash, ...userWithoutPassword } = user;

    res.json({ token, user: userWithoutPassword });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: 'Login failed' });
  }
});

// POST /api/auth/forgot-password
app.post('/api/auth/forgot-password', authRateLimit, async (req, res) => {
  try {
    let { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // B12: normalize before query
    email = String(email || '').trim().toLowerCase();
    if (email.length > 254) {
      // Same generic response — don't leak length-based info
      return res.json({ message: 'Si el correo existe en nuestro sistema, recibirás instrucciones para restablecer tu contraseña en breve.' });
    }

    // Look up user by email (case-insensitive via idx_users_email_lower)
    const userResult = await pool.query('SELECT id, email, name FROM users WHERE LOWER(email) = $1', [email]);
    const userExists = userResult.rows.length > 0;

    // Always respond with same success message (don't reveal if email exists)
    if (userExists) {
      const user = userResult.rows[0];

      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

      // A2: Invalidate any previous unused tokens for this user before issuing a new one
      await pool.query("UPDATE password_reset_tokens SET used = true WHERE user_id = $1 AND used = false", [user.id]);

      // Store token in database
      await pool.query(
        'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
        [user.id, resetToken, expiresAt]
      );

      // Send email with reset link
      const resetLink = `${APP_URL}/reset-password?token=${resetToken}`;
      const esc = (str) => String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

      sendMail({
        from: `"Shiftia" <${RESEND_FROM}>`,
        to: user.email,
        subject: 'Restablecer tu contraseña - Shiftia',
        html: emailTemplate({
          preheader: 'Restablece tu contraseña en menos de un minuto',
          headline: 'Restablecer contraseña',
          body: `
            <p style="margin:0 0 16px;">Hola ${esc(user.name)},</p>
            <p style="margin:0 0 16px;">Recibimos una solicitud para restablecer tu contraseña. Haz clic en el botón de abajo para crear una nueva contraseña.</p>
            <p style="margin:24px 0 8px;font-size:14px;color:#7a766f;">Este enlace expira en 1 hora. Si no solicitaste cambiar tu contraseña, puedes ignorar este correo.</p>
            <p style="margin:16px 0 0;font-size:13px;color:#7a766f;">O copia este enlace en tu navegador:<br><span style="color:#0f7a6d;word-break:break-all;">${resetLink}</span></p>
          `,
          ctaText: 'Restablecer contraseña',
          ctaUrl: resetLink
        })
      }).then(() => console.log('Password reset email sent to', user.email))
        .catch(err => console.error('Password reset email failed:', err.message));
    }

    // Always send same success message
    res.json({ message: 'Si el correo existe en nuestro sistema, recibirás instrucciones para restablecer tu contraseña en breve.' });
  } catch (err) {
    console.error('Forgot password error:', err.message);
    res.status(500).json({ error: 'Error processing request' });
  }
});

// POST /api/auth/reset-password
app.post('/api/auth/reset-password', authRateLimit, async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ error: 'Token and password are required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
    }

    // Find token in database
    const tokenResult = await pool.query(
      'SELECT id, user_id FROM password_reset_tokens WHERE token = $1 AND used = false AND expires_at > NOW()',
      [token]
    );

    if (tokenResult.rows.length === 0) {
      return res.status(400).json({ error: 'El enlace de restablecimiento es inválido o ha expirado' });
    }

    const { id: tokenId, user_id: userId } = tokenResult.rows[0];

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update user's password
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hashedPassword, userId]);

    // Mark token as used
    await pool.query('UPDATE password_reset_tokens SET used = true WHERE id = $1', [tokenId]);

    // A3: Invalidate ALL remaining tokens for this user (defence in depth)
    await pool.query("UPDATE password_reset_tokens SET used = true WHERE user_id = $1", [userId]);

    console.log(`Password reset for user ${userId}`);
    res.json({ message: 'Tu contraseña ha sido restablecida exitosamente' });
  } catch (err) {
    console.error('Reset password error:', err.message);
    res.status(500).json({ error: 'Error resetting password' });
  }
});

// GET /api/auth/me (protected)
app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, name, company, plan, plan_status, workers_limit, next_billing_date, billing_cycle, stripe_customer_id, stripe_subscription_id, created_at, updated_at FROM users WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: result.rows[0] });
  } catch (err) {
    console.error('Get user error:', err.message);
    res.status(500).json({ error: 'Error fetching user' });
  }
});

// POST /api/auth/logout (B9) — JWT is stateless; client should drop the token.
// Endpoint exists so the client has a stable ack contract.
app.post('/api/auth/logout', authMiddleware, (req, res) => {
  res.json({ ok: true });
});

// PUT /api/auth/update (protected)
app.put('/api/auth/update', authMiddleware, async (req, res) => {
  try {
    let { name, email, company, password, currentPassword } = req.body;
    const userId = req.user.id;

    // Validate at least one field
    if (!name && !email && !company && !password) {
      return res.status(400).json({ error: 'At least one field is required' });
    }

    // A10: server-side caps on inputs
    if (name) name = cap(String(name).trim(), 120);
    if (company) company = cap(String(company).trim(), 160);
    if (email) {
      email = String(email).trim().toLowerCase();
      if (email.length > 254) return res.status(400).json({ error: 'Email demasiado largo' });
    }

    // Start building the update query
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (name) {
      updates.push(`name = $${paramCount}`);
      values.push(name);
      paramCount++;
    }

    if (email) {
      if (!isValidEmail(email)) {
        return res.status(400).json({ error: 'Invalid email format' });
      }
      // Check if email is already taken by another user (case-insensitive)
      const existingUser = await pool.query('SELECT id FROM users WHERE LOWER(email) = $1 AND id != $2', [email, userId]);
      if (existingUser.rows.length > 0) {
        return res.status(409).json({ error: 'Email already in use' });
      }
      updates.push(`email = $${paramCount}`);
      values.push(email);
      paramCount++;
    }

    if (company) {
      updates.push(`company = $${paramCount}`);
      values.push(company);
      paramCount++;
    }

    if (password) {
      if (password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters' });
      }
      // A9: require currentPassword to change password — verify against stored hash
      if (!currentPassword) {
        return res.status(403).json({ error: 'Debes proporcionar tu contraseña actual para cambiarla' });
      }
      const currentRow = await pool.query('SELECT password_hash FROM users WHERE id = $1', [userId]);
      if (currentRow.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
      const currentMatch = await bcrypt.compare(currentPassword, currentRow.rows[0].password_hash);
      if (!currentMatch) {
        return res.status(403).json({ error: 'La contraseña actual es incorrecta' });
      }
      const passwordHash = await bcrypt.hash(password, 10);
      updates.push(`password_hash = $${paramCount}`);
      values.push(passwordHash);
      paramCount++;
    }

    updates.push(`updated_at = NOW()`);

    values.push(userId);

    const query = `
      UPDATE users
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, email, name, company, plan, plan_status, workers_limit, next_billing_date, created_at, updated_at
    `;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: result.rows[0] });
  } catch (err) {
    console.error('Update user error:', err.message);
    res.status(500).json({ error: 'Error updating user' });
  }
});

// POST /api/support (protected)
app.post('/api/support', authMiddleware, async (req, res) => {
  try {
    let { category, subject, message } = req.body;

    // Validate required fields
    if (!subject || !message) {
      return res.status(400).json({ error: 'Subject and message are required' });
    }

    // A10: server-side caps
    subject = cap(String(subject).trim(), 200);
    message = cap(String(message).trim(), 5000);

    // Get user details
    const userResult = await pool.query(
      'SELECT email, name, company FROM users WHERE id = $1',
      [req.user.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];
    const cat = ['general', 'bug', 'billing', 'feature'].includes(category) ? category : 'general';
    const catLabels = { general: 'Consulta general', bug: 'Reporte de error', billing: 'Facturación', feature: 'Sugerencia de mejora' };

    // HTML-escape helper for email content
    const esc = (str) => String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    // Save ticket to database (primary)
    try {
      await pool.query(
        'INSERT INTO support_tickets (user_id, category, subject, message) VALUES ($1, $2, $3, $4)',
        [req.user.id, cat, subject, message]
      );
    } catch (dbErr) {
      if (dbErr.message.includes('does not exist')) {
        await pool.query(`
          CREATE TABLE IF NOT EXISTS support_tickets (
            id SERIAL PRIMARY KEY, user_id INTEGER, category VARCHAR(50) DEFAULT 'general',
            subject VARCHAR(500) NOT NULL, message TEXT NOT NULL,
            status VARCHAR(50) DEFAULT 'open', created_at TIMESTAMP DEFAULT NOW()
          );
        `);
        await pool.query(
          'INSERT INTO support_tickets (user_id, category, subject, message) VALUES ($1, $2, $3, $4)',
          [req.user.id, cat, subject, message]
        );
      } else {
        console.warn('DB insert ticket failed (continuing):', dbErr.message);
      }
    }

    console.log(`Support ticket from ${user.name} <${user.email}>: [${cat}] ${subject}`);
    res.json({ ok: true });

    // Fire-and-forget email (don't block response)
    sendMail({
          from: `"Shiftia Support" <${GMAIL_USER}>`,
          to: process.env.SUPPORT_EMAIL || GMAIL_USER,
          subject: `[Soporte - ${catLabels[cat] || cat}] ${esc(subject)}`,
          html: emailTemplate({
            preheader: `Nuevo ticket de soporte: ${esc(subject)}`,
            headline: `${esc(catLabels[cat] || cat)}`,
            body: `
              <p style="margin:0 0 20px;font-size:17px;color:#0e0f0f;font-weight:500;">${esc(subject)}</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;border-top:1px solid #ece9e2;">
                <tr><td style="padding:12px 0;color:#7a766f;font-size:13px;width:120px;border-bottom:1px solid #ece9e2;">Nombre</td><td style="padding:12px 0;color:#1a1a1a;font-size:14px;border-bottom:1px solid #ece9e2;">${esc(user.name)}</td></tr>
                <tr><td style="padding:12px 0;color:#7a766f;font-size:13px;border-bottom:1px solid #ece9e2;">Email</td><td style="padding:12px 0;font-size:14px;border-bottom:1px solid #ece9e2;"><a href="mailto:${esc(user.email)}" style="color:#0f7a6d;">${esc(user.email)}</a></td></tr>
                ${user.company ? `<tr><td style="padding:12px 0;color:#7a766f;font-size:13px;border-bottom:1px solid #ece9e2;">Empresa</td><td style="padding:12px 0;color:#1a1a1a;font-size:14px;border-bottom:1px solid #ece9e2;">${esc(user.company)}</td></tr>` : ''}
                <tr><td style="padding:12px 0;color:#7a766f;font-size:13px;">Categoría</td><td style="padding:12px 0;color:#1a1a1a;font-size:14px;">${esc(catLabels[cat] || cat)}</td></tr>
              </table>
              <div style="padding:20px;background:#faf9f6;border-radius:10px;border:1px solid #ece9e2;">
                <p style="color:#7a766f;font-size:12px;text-transform:uppercase;letter-spacing:0.06em;margin:0 0 10px;">Mensaje</p>
                <p style="color:#1a1a1a;line-height:1.6;margin:0;white-space:pre-wrap;font-size:15px;">${esc(message)}</p>
              </div>
            `
          })
        });
  } catch (err) {
    console.error('Support ticket error:', err.message);
    res.status(500).json({ error: 'Error sending support request' });
  }
});

// ====== STRIPE CHECKOUT API ======

// Create Checkout Session (requires auth)
app.post('/api/stripe/checkout', authMiddleware, async (req, res) => {
  if (!stripe) return res.status(400).json({ error: 'Stripe no configurado. Contacta con soporte.' });

  try {
    const userResult = await pool.query('SELECT id, email, name, plan, stripe_customer_id FROM users WHERE id = $1', [req.user.id]);
    if (userResult.rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
    const user = userResult.rows[0];

    const { plan, billing } = req.body;

    // Validate plan and billing values
    const validPlans = ['starter', 'pro', 'business'];
    const validBillings = ['monthly', 'annual'];
    if (!validPlans.includes(plan) || !validBillings.includes(billing)) {
      return res.status(400).json({ error: 'Plan o período de facturación no válido' });
    }

    const priceKey = `${plan}_${billing}`;
    const priceId = STRIPE_PRICES[priceKey];

    if (!priceId) return res.status(400).json({ error: `Precio no configurado para: ${plan} (${billing})` });

    // Reuse or create Stripe customer
    let customerId = user.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name,
        metadata: { user_id: String(user.id) }
      });
      customerId = customer.id;
      await pool.query('UPDATE users SET stripe_customer_id = $1 WHERE id = $2', [customerId, user.id]);
    }

    // Create Checkout Session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: { user_id: String(user.id), plan, billing },
      subscription_data: {
        metadata: { user_id: String(user.id), plan, billing }
      },
      success_url: `${APP_URL}/dashboard?checkout=success&plan=${plan}`,
      cancel_url: `${APP_URL}/dashboard?checkout=cancel`,
      locale: 'es',
      allow_promotion_codes: true,
    });

    console.log(`Checkout session created: user ${user.id} → ${plan} (${billing}) — ${session.id}`);
    res.json({ url: session.url });

  } catch (err) {
    console.error('Stripe checkout error:', err.message);
    res.status(500).json({ error: 'Error al crear sesión de pago' });
  }
});

// Customer portal (manage subscription, cancel, update card)
app.post('/api/stripe/portal', authMiddleware, async (req, res) => {
  if (!stripe) return res.status(400).json({ error: 'Stripe no configurado' });

  try {
    const userResult = await pool.query('SELECT stripe_customer_id FROM users WHERE id = $1', [req.user.id]);
    if (userResult.rows.length === 0 || !userResult.rows[0].stripe_customer_id) {
      return res.status(400).json({ error: 'No tienes una suscripción activa' });
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: userResult.rows[0].stripe_customer_id,
      return_url: `${APP_URL}/dashboard`,
    });

    res.json({ url: portalSession.url });
  } catch (err) {
    console.error('Stripe portal error:', err.message);
    res.status(500).json({ error: 'Error al abrir el portal de pagos' });
  }
});

// Get available prices for frontend
app.get('/api/stripe/prices', (req, res) => {
  const configured = Object.values(STRIPE_PRICES).some(v => v);
  res.json({
    configured,
    plans: {
      starter:  { monthly: 20,  annual: 192,  monthlyEquiv: 16 },
      pro:      { monthly: 30,  annual: 288,  monthlyEquiv: 24 },
      business: { monthly: 50,  annual: 480,  monthlyEquiv: 40 }
    }
  });
});

// ====== RATE LIMITING ======
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX_GENERAL = 3;
const RATE_LIMIT_MAX_AUTH = 5;

function isRateLimited(ip, maxAttempts = RATE_LIMIT_MAX_GENERAL) {
  const now = Date.now();
  const attempts = rateLimitMap.get(ip) || [];
  const recent = attempts.filter(t => now - t < RATE_LIMIT_WINDOW);
  if (recent.length === 0) { rateLimitMap.delete(ip); return false; }
  rateLimitMap.set(ip, recent);
  if (recent.length >= maxAttempts) return true;
  recent.push(now);
  rateLimitMap.set(ip, recent);
  return false;
}

// Periodic cleanup every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, attempts] of rateLimitMap) {
    const recent = attempts.filter(t => now - t < RATE_LIMIT_WINDOW);
    if (recent.length === 0) rateLimitMap.delete(ip);
    else rateLimitMap.set(ip, recent);
  }
}, 5 * 60 * 1000);

// ====== CONTACT FORM API ======
app.post('/api/contact', async (req, res) => {
  try {
    // Rate limiting
    const clientIP = req.ip || req.connection.remoteAddress;
    if (isRateLimited(clientIP)) {
      return res.status(429).json({ error: 'Demasiadas solicitudes. Espera un momento.' });
    }

    let { name, email, company, workers, department, message } = req.body;

    // Validate required fields
    if (!name || !email) {
      return res.status(400).json({ error: 'Nombre y email son obligatorios' });
    }

    // A10: server-side caps
    name       = cap(String(name).trim(), 120);
    email      = String(email || '').trim().toLowerCase();
    if (email.length > 254) return res.status(400).json({ error: 'Email demasiado largo' });
    company    = cap(String(company || '').trim(), 160);
    workers    = cap(String(workers || '').trim(), 32);
    department = cap(String(department || '').trim(), 120);
    message    = cap(String(message || '').trim(), 5000);

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Email no valido' });
    }

    // Sanitize HTML to prevent XSS in emails
    const esc = (str) => String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const safeName = esc(name);
    const safeEmail = esc(email);
    const safeCompany = esc(company);
    const safeWorkers = esc(workers);
    const safeDepartment = esc(department);
    const safeMessage = esc(message);

    // 1. Save lead to database (primary)
    try {
      await pool.query(
        'INSERT INTO contact_leads (name, email, company, workers, department, message) VALUES ($1, $2, $3, $4, $5, $6)',
        [name, email, company || null, workers || null, department || null, message || null]
      );
    } catch (dbErr) {
      // Table might not exist yet — create it and retry
      if (dbErr.message.includes('does not exist')) {
        await pool.query(`
          CREATE TABLE IF NOT EXISTS contact_leads (
            id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL, email VARCHAR(255) NOT NULL,
            company VARCHAR(255), workers VARCHAR(50), department VARCHAR(255),
            message TEXT, created_at TIMESTAMP DEFAULT NOW()
          );
        `);
        await pool.query(
          'INSERT INTO contact_leads (name, email, company, workers, department, message) VALUES ($1, $2, $3, $4, $5, $6)',
          [name, email, company || null, workers || null, department || null, message || null]
        );
      } else {
        console.warn('DB insert lead failed (continuing):', dbErr.message);
      }
    }

    console.log(`Contact lead saved: ${name} <${email}> — ${company || 'N/A'}`);
    res.json({ ok: true });

    // Fire-and-forget emails (don't block response)
    sendMail({
          from: `"Shiftia HUB" <${GMAIL_USER}>`,
          to: process.env.SUPPORT_EMAIL || GMAIL_USER,
          subject: `Nueva solicitud de demo — ${safeName} (${safeCompany || 'Sin empresa'})`,
          html: emailTemplate({
            preheader: `Nueva solicitud de demo de ${safeName}`,
            headline: 'Nueva solicitud de demo',
            body: `
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;border-top:1px solid #ece9e2;">
                <tr><td style="padding:12px 0;color:#7a766f;font-size:13px;width:140px;border-bottom:1px solid #ece9e2;">Nombre</td><td style="padding:12px 0;color:#1a1a1a;font-size:14px;border-bottom:1px solid #ece9e2;">${safeName}</td></tr>
                <tr><td style="padding:12px 0;color:#7a766f;font-size:13px;border-bottom:1px solid #ece9e2;">Email</td><td style="padding:12px 0;font-size:14px;border-bottom:1px solid #ece9e2;"><a href="mailto:${safeEmail}" style="color:#0f7a6d;">${safeEmail}</a></td></tr>
                ${safeCompany ? `<tr><td style="padding:12px 0;color:#7a766f;font-size:13px;border-bottom:1px solid #ece9e2;">Empresa</td><td style="padding:12px 0;color:#1a1a1a;font-size:14px;border-bottom:1px solid #ece9e2;">${safeCompany}</td></tr>` : ''}
                ${safeWorkers ? `<tr><td style="padding:12px 0;color:#7a766f;font-size:13px;border-bottom:1px solid #ece9e2;">Trabajadores</td><td style="padding:12px 0;color:#1a1a1a;font-size:14px;border-bottom:1px solid #ece9e2;">${safeWorkers}</td></tr>` : ''}
                ${safeDepartment ? `<tr><td style="padding:12px 0;color:#7a766f;font-size:13px;">Departamento</td><td style="padding:12px 0;color:#1a1a1a;font-size:14px;">${safeDepartment}</td></tr>` : ''}
              </table>
              ${safeMessage ? `
                <div style="padding:20px;background:#faf9f6;border-radius:10px;border:1px solid #ece9e2;margin-bottom:16px;">
                  <p style="color:#7a766f;font-size:12px;text-transform:uppercase;letter-spacing:0.06em;margin:0 0 10px;">Mensaje</p>
                  <p style="color:#1a1a1a;line-height:1.6;margin:0;font-size:15px;">${safeMessage}</p>
                </div>
              ` : ''}
              <p style="color:#9a958c;font-size:12px;margin:16px 0 0;">Enviado desde www.shiftia.es — ${new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })}</p>
            `
          })
        });

    sendMail({
          from: `"Shiftia" <${GMAIL_USER}>`,
          to: email,
          subject: 'Hemos recibido tu solicitud — Shiftia',
          html: emailTemplate({
            preheader: 'Te contactaremos en menos de 24 horas laborables',
            headline: `Hola ${safeName.split(' ')[0]}`,
            body: `
              <p style="margin:0 0 16px;">Hemos recibido tu solicitud correctamente. Nuestro equipo la revisará y te contactaremos en <strong style="color:#0e0f0f;font-weight:500;">menos de 24 horas laborables</strong> con una propuesta personalizada.</p>
              <p style="margin:0 0 16px;">Mientras tanto, si tienes cualquier duda, puedes responder a este email directamente.</p>
              <div style="margin:24px 0;padding:24px;background:#faf9f6;border-radius:10px;border:1px solid #ece9e2;">
                <p style="color:#0e0f0f;margin:0 0 12px;font-weight:500;font-size:15px;">Lo que incluye tu demo:</p>
                <p style="color:#33312d;margin:0 0 8px;font-size:15px;line-height:1.55;"><span style="color:#0f7a6d;">—</span>&nbsp;Configuración con los datos de tu equipo</p>
                <p style="color:#33312d;margin:0 0 8px;font-size:15px;line-height:1.55;"><span style="color:#0f7a6d;">—</span>&nbsp;Demo en vivo del motor IA de coberturas</p>
                <p style="color:#33312d;margin:0;font-size:15px;line-height:1.55;"><span style="color:#0f7a6d;">—</span>&nbsp;30 días de garantía de reembolso en todos los planes</p>
              </div>
              <p style="color:#33312d;margin:24px 0 0;">Un saludo,<br><span style="color:#0e0f0f;">El equipo de Shiftia</span></p>
            `
          })
        });

  } catch (err) {
    console.error('Contact form error:', err.message);
    if (!res.headersSent) res.status(500).json({ error: 'Error al enviar. Intentalo de nuevo.' });
  }
});

// ====== CALL BOOKING API (v2 — TIMESTAMPTZ + integridad + .ics + cancel) ======
// Helpers de booking — todos en zona Europe/Madrid.
const ESC_HTML = (str) => String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// `cap` is defined globally in HELPER FUNCTIONS section above.

// Genera lista de slots HH:MM válidos del día según BOOKING_HOUR_START/END/SLOT_MINUTES
// y excluye los del bloque de comida.
function generateDaySlots() {
  const slots = [];
  const stepMin = BOOKING_SLOT_MINUTES;
  for (let h = BOOKING_HOUR_START; h < BOOKING_HOUR_END; h++) {
    for (let m = 0; m < 60; m += stepMin) {
      const t = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      if (!BOOKING_LUNCH_BLOCK.includes(t)) slots.push(t);
    }
  }
  return slots;
}

// Construye un ISO con offset correcto para Europe/Madrid en una fecha/hora dada.
// Maneja DST sin libs externas usando Intl.DateTimeFormat.
function madridIsoFromLocal(dateStr /* YYYY-MM-DD */, timeStr /* HH:MM */) {
  // Construir Date como si fuera UTC, luego corregir el offset que Madrid tendría a esa fecha
  const utcGuess = new Date(dateStr + 'T' + timeStr + ':00Z');
  // Calcular offset (en minutos) que Europe/Madrid tiene en ese momento
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: BOOKING_TIMEZONE,
    timeZoneName: 'shortOffset',
    year: 'numeric'
  });
  const parts = fmt.formatToParts(utcGuess);
  const offTok = parts.find(p => p.type === 'timeZoneName').value; // e.g. "GMT+2"
  const m = offTok.match(/GMT([+-])(\d+)(?::(\d+))?/);
  const sign = m && m[1] === '-' ? -1 : 1;
  const hh = m ? Number(m[2]) : 0;
  const mm = m && m[3] ? Number(m[3]) : 0;
  const offMin = sign * (hh * 60 + mm);
  // El instante real en UTC es: localGuess - offset
  return new Date(utcGuess.getTime() - offMin * 60000);
}

function prettyDateMadrid(d) {
  return new Intl.DateTimeFormat('es-ES', {
    timeZone: BOOKING_TIMEZONE,
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  }).format(d);
}
function prettyTimeMadrid(d) {
  return new Intl.DateTimeFormat('es-ES', {
    timeZone: BOOKING_TIMEZONE, hour: '2-digit', minute: '2-digit', hour12: false
  }).format(d);
}

// Token de cancelación HMAC firmado — sin guardarlo, validable on-demand.
function makeCancelToken(bookingId, email) {
  const payload = `${bookingId}.${email}`;
  return crypto.createHmac('sha256', BOOKING_CANCEL_SECRET).update(payload).digest('hex').slice(0, 32);
}
function verifyCancelToken(bookingId, email, token) {
  if (!token) return false;
  const expected = makeCancelToken(bookingId, email);
  return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
}

// .ics para Google/Outlook/Apple
function buildIcs({ uid, startUtc, endUtc, summary, description, location, organizerEmail, attendeeEmail }) {
  const fmt = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Shiftia//Booking//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${uid}@shiftia.es`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(startUtc)}`,
    `DTEND:${fmt(endUtc)}`,
    `SUMMARY:${summary.replace(/[\n,;]/g, ' ')}`,
    `DESCRIPTION:${(description || '').replace(/\n/g, '\\n').replace(/[,;]/g, ' ')}`,
    `LOCATION:${(location || '').replace(/[,;]/g, ' ')}`,
    `ORGANIZER;CN=Shiftia:mailto:${organizerEmail}`,
    `ATTENDEE;CN=${attendeeEmail};RSVP=TRUE:mailto:${attendeeEmail}`,
    'STATUS:CONFIRMED',
    'BEGIN:VALARM',
    'TRIGGER:-PT15M',
    'ACTION:DISPLAY',
    'DESCRIPTION:Recordatorio',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR'
  ];
  return lines.join('\r\n');
}

// GET slots — devuelve disponibilidad real de un día
app.get('/api/booking/slots', async (req, res) => {
  try {
    const { date } = req.query;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) {
      return res.status(400).json({ error: 'date inválido' });
    }
    // Slots posibles del día
    const allSlots = generateDaySlots();

    // Slots ya reservados (consulta sobre booking_at extrayendo HH:MM en Europe/Madrid)
    let bookedRows = { rows: [] };
    try {
      bookedRows = await pool.query(
        `SELECT to_char(booking_at AT TIME ZONE $2, 'HH24:MI') AS hhmm
         FROM bookings
         WHERE (booking_at AT TIME ZONE $2)::date = $1::date
           AND status != 'cancelled'`,
        [date, BOOKING_TIMEZONE]
      );
    } catch (e) {
      if (!/does not exist/i.test(e.message)) console.error('slots query err:', e.message);
    }
    const booked = new Set(bookedRows.rows.map(r => r.hhmm));

    // Día bloqueado por admin?
    let blocked = false;
    let blockedReason = null;
    try {
      const b = await pool.query('SELECT reason FROM blocked_dates WHERE block_date = $1 LIMIT 1', [date]);
      if (b.rows.length > 0) { blocked = true; blockedReason = b.rows[0].reason; }
    } catch (_) {}

    // Lead-time mínimo (no permitimos reservar el mismo día con < BOOKING_MIN_LEAD_HOURS)
    const now = new Date();
    const available = allSlots.map(t => {
      const slotInstant = madridIsoFromLocal(date, t);
      const tooSoon = (slotInstant.getTime() - now.getTime()) < BOOKING_MIN_LEAD_HOURS * 3600 * 1000;
      return {
        time: t,
        booked: booked.has(t),
        tooSoon,
        available: !blocked && !booked.has(t) && !tooSoon
      };
    });

    res.json({
      date,
      timezone: BOOKING_TIMEZONE,
      blocked,
      blockedReason,
      slots: available,
      // backward-compat con el frontend antiguo
      booked: Array.from(booked)
    });
  } catch (err) {
    console.error('booking/slots error:', err.message);
    res.json({ booked: [], slots: [] });
  }
});

// POST booking — la cita real
app.post('/api/booking', async (req, res) => {
  try {
    // Rate limiting
    const clientIP = req.ip || req.connection.remoteAddress;
    if (isRateLimited(clientIP)) {
      return res.status(429).json({ error: 'Demasiadas solicitudes. Espera un momento.' });
    }

    const body = req.body || {};

    // Honeypot anti-bot — campo invisible que solo bots rellenan
    if (body.website && String(body.website).trim() !== '') {
      console.log('Booking honeypot triggered from', clientIP);
      return res.json({ ok: true }); // fingimos OK para no señalar al bot
    }

    let { name, email, phone, company, workers, department, message, date, time } = body;

    // Required
    if (!name || !email || !phone || !date || !time) {
      return res.status(400).json({ error: 'Nombre, email, teléfono, fecha y hora son obligatorios' });
    }

    // Caps de longitud (defensivos)
    name       = cap(String(name).trim(), 120);
    email      = cap(String(email).trim().toLowerCase(), 254);
    phone      = cap(String(phone).trim(), 32);
    company    = cap(String(company || '').trim(), 160);
    workers    = cap(String(workers || '').trim(), 20);
    department = cap(String(department || '').trim(), 120);
    message    = cap(String(message || '').trim(), 2000);

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Email no válido' });
    }
    // Phone: validación tolerante (dígitos + opcional + - espacios paréntesis), 7-20 dígitos
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 7 || digits.length > 18) {
      return res.status(400).json({ error: 'Teléfono no válido' });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'Formato de fecha no válido' });
    }
    if (!/^\d{2}:(00|30)$/.test(time)) {
      return res.status(400).json({ error: 'Hora inválida (sólo en :00 o :30)' });
    }
    const [hh, mm] = time.split(':').map(Number);
    if (hh < BOOKING_HOUR_START || hh >= BOOKING_HOUR_END) {
      return res.status(400).json({ error: `Horario disponible: ${BOOKING_HOUR_START}:00–${BOOKING_HOUR_END}:00 (Europe/Madrid)` });
    }
    if (BOOKING_LUNCH_BLOCK.includes(time)) {
      return res.status(400).json({ error: 'Esa franja está bloqueada (pausa de comida)' });
    }

    // Fin de semana — usamos getDay() en UTC sobre el instante Madrid 12:00
    const probe = madridIsoFromLocal(date, '12:00');
    const dowMadrid = new Intl.DateTimeFormat('en-US', {
      timeZone: BOOKING_TIMEZONE, weekday: 'short'
    }).format(probe);
    if (dowMadrid === 'Sat' || dowMadrid === 'Sun') {
      return res.status(400).json({ error: 'Solo se puede agendar de lunes a viernes' });
    }

    // Día bloqueado por admin (vacaciones, festivo)
    try {
      const b = await pool.query('SELECT reason FROM blocked_dates WHERE block_date = $1 LIMIT 1', [date]);
      if (b.rows.length > 0) {
        return res.status(400).json({ error: 'Ese día no está disponible. Por favor, elige otro.' });
      }
    } catch (_) {}

    // Lead-time mínimo
    const slotInstant = madridIsoFromLocal(date, time);
    const now = new Date();
    if (slotInstant.getTime() - now.getTime() < BOOKING_MIN_LEAD_HOURS * 3600 * 1000) {
      return res.status(400).json({ error: `Reserva con al menos ${BOOKING_MIN_LEAD_HOURS}h de antelación.` });
    }
    // Horizonte máximo
    if (slotInstant.getTime() - now.getTime() > BOOKING_HORIZON_DAYS * 86400 * 1000) {
      return res.status(400).json({ error: `Solo se puede reservar hasta ${BOOKING_HORIZON_DAYS} días en el futuro.` });
    }

    // INSERT atómico — la UNIQUE INDEX captura el conflicto
    let inserted;
    try {
      inserted = await pool.query(
        `INSERT INTO bookings (
           name, email, phone, company, workers, department, message,
           booking_date, booking_time, booking_at, ip, user_agent, status, email_status
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'pending','pending') RETURNING id`,
        [
          name, email, phone, company || null, workers || null, department || null, message || null,
          date, time, slotInstant,
          clientIP || null,
          cap(req.headers['user-agent'] || '', 255)
        ]
      );
    } catch (dbErr) {
      // 23505 = unique_violation — slot ya reservado (race condition resuelta por DB)
      if (dbErr.code === '23505') {
        return res.status(409).json({ error: 'Esa hora ya ha sido reservada por otra persona. Por favor, elige otra.' });
      }
      console.error('Booking INSERT failed:', dbErr.code, dbErr.message);
      return res.status(500).json({ error: 'Error guardando la reserva. Inténtalo de nuevo.' });
    }

    if (!inserted || inserted.rowCount !== 1 || !inserted.rows[0] || !inserted.rows[0].id) {
      console.error('Booking INSERT returned no row');
      return res.status(500).json({ error: 'Error guardando la reserva. Inténtalo de nuevo.' });
    }
    const bookingId = inserted.rows[0].id;

    // Generar y guardar token de cancelación
    const cancelToken = makeCancelToken(bookingId, email);
    await pool.query('UPDATE bookings SET cancel_token = $1 WHERE id = $2', [cancelToken, bookingId]).catch(() => {});

    // Construir strings legibles en TZ Madrid
    const prettyDate = prettyDateMadrid(slotInstant);
    const prettyTime = prettyTimeMadrid(slotInstant);

    // .ics adjunto (30 min de duración)
    const slotEnd = new Date(slotInstant.getTime() + 30 * 60 * 1000);
    const icsContent = buildIcs({
      uid: `booking-${bookingId}`,
      startUtc: slotInstant,
      endUtc: slotEnd,
      summary: `Llamada con Shiftia — ${name}${company ? ' (' + company + ')' : ''}`,
      description: `Demo personalizada de Shiftia.\n\nContacto: ${name}\nEmpresa: ${company || '-'}\nTeléfono: ${phone}\n${message ? 'Mensaje: ' + message : ''}`,
      location: 'Llamada por teléfono',
      organizerEmail: process.env.SUPPORT_EMAIL || GMAIL_USER,
      attendeeEmail: email
    });
    const icsAttachment = {
      filename: 'shiftia-llamada.ics',
      content: icsContent,
      contentType: 'text/calendar; method=REQUEST; charset=UTF-8'
    };

    const cancelUrl = `${APP_URL}/booking/cancel?id=${bookingId}&token=${cancelToken}`;
    const supportEmail = process.env.SUPPORT_EMAIL || GMAIL_USER;

    // Responder OK al cliente DESPUÉS de confirmar la fila en BD
    console.log(`Booking #${bookingId} OK: ${email} ${digits} — ${date} ${time} (Madrid)`);
    res.json({
      ok: true,
      bookingId,
      cancelUrl,
      prettyDate,
      prettyTime,
      timezone: BOOKING_TIMEZONE
    });

    // Emails fire-and-forget DESPUÉS de responder, pero registramos su estado
    // 1. Notificación interna
    Promise.resolve(sendMail({
      from: `"Shiftia Booking" <${GMAIL_USER}>`,
      to: supportEmail,
      replyTo: email,
      subject: `Nueva llamada agendada — ${ESC_HTML(name)} (${ESC_HTML(company || 'N/A')}) — ${prettyDate} ${prettyTime}`,
      attachments: [icsAttachment],
      html: emailTemplate({
        preheader: `${prettyDate} a las ${prettyTime} — ${ESC_HTML(name)}`,
        headline: 'Nueva llamada agendada',
        body: `
          <div style="background:#faf9f6;padding:20px;border-radius:10px;border:1px solid #ece9e2;margin-bottom:24px;">
            <p style="margin:0;font-size:17px;color:#0e0f0f;font-family:'Instrument Serif','Times New Roman',Georgia,serif;line-height:1.3;">${prettyDate} a las ${prettyTime}</p>
            <p style="margin:6px 0 0;font-size:12px;color:#7a766f;">Hora de Madrid (Europe/Madrid)</p>
          </div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #ece9e2;">
            <tr><td style="padding:12px 0;color:#7a766f;font-size:13px;width:130px;border-bottom:1px solid #ece9e2;">Nombre</td><td style="padding:12px 0;color:#1a1a1a;font-size:14px;border-bottom:1px solid #ece9e2;">${ESC_HTML(name)}</td></tr>
            <tr><td style="padding:12px 0;color:#7a766f;font-size:13px;border-bottom:1px solid #ece9e2;">Email</td><td style="padding:12px 0;font-size:14px;border-bottom:1px solid #ece9e2;"><a href="mailto:${ESC_HTML(email)}" style="color:#0f7a6d;">${ESC_HTML(email)}</a></td></tr>
            <tr><td style="padding:12px 0;color:#7a766f;font-size:13px;border-bottom:1px solid #ece9e2;">Teléfono</td><td style="padding:12px 0;font-size:14px;border-bottom:1px solid #ece9e2;"><a href="tel:${ESC_HTML(phone)}" style="color:#0f7a6d;">${ESC_HTML(phone)}</a></td></tr>
            ${company ? `<tr><td style="padding:12px 0;color:#7a766f;font-size:13px;border-bottom:1px solid #ece9e2;">Empresa</td><td style="padding:12px 0;color:#1a1a1a;font-size:14px;border-bottom:1px solid #ece9e2;">${ESC_HTML(company)}</td></tr>` : ''}
            ${workers ? `<tr><td style="padding:12px 0;color:#7a766f;font-size:13px;border-bottom:1px solid #ece9e2;">Trabajadores</td><td style="padding:12px 0;color:#1a1a1a;font-size:14px;border-bottom:1px solid #ece9e2;">${ESC_HTML(workers)}</td></tr>` : ''}
            ${department ? `<tr><td style="padding:12px 0;color:#7a766f;font-size:13px;">Departamento</td><td style="padding:12px 0;color:#1a1a1a;font-size:14px;">${ESC_HTML(department)}</td></tr>` : ''}
          </table>
          ${message ? `<div style="margin-top:20px;padding:20px;background:#faf9f6;border-radius:10px;border:1px solid #ece9e2;"><p style="color:#7a766f;font-size:12px;text-transform:uppercase;letter-spacing:0.06em;margin:0 0 10px;">Mensaje</p><p style="color:#1a1a1a;line-height:1.6;margin:0;font-size:15px;">${ESC_HTML(message)}</p></div>` : ''}
          <p style="color:#9a958c;font-size:12px;margin:20px 0 0;">Booking #${bookingId} · IP ${ESC_HTML(clientIP || '-')} · ${new Date().toLocaleString('es-ES', { timeZone: BOOKING_TIMEZONE })}</p>
        `
      })
    })).then(() => {
      pool.query("UPDATE bookings SET email_status='sent' WHERE id=$1", [bookingId]).catch(() => {});
    }).catch((err) => {
      console.error('Internal notif email failed for booking', bookingId, err.message);
      pool.query("UPDATE bookings SET email_status='failed', email_error=$2 WHERE id=$1", [bookingId, cap(err.message, 500)]).catch(() => {});
    });

    // 2. Confirmación al cliente
    sendMail({
      from: `"Shiftia" <${GMAIL_USER}>`,
      replyTo: supportEmail,
      to: email,
      subject: `Llamada confirmada — ${prettyDate} a las ${prettyTime} — Shiftia`,
      attachments: [icsAttachment],
      html: emailTemplate({
        preheader: `Tu llamada está confirmada para ${prettyDate} a las ${prettyTime}`,
        headline: `Hola ${ESC_HTML(name).split(' ')[0]}`,
        body: `
          <p style="margin:0 0 20px;">Tu llamada con el equipo de Shiftia ha quedado confirmada.</p>
          <div style="margin:24px 0;padding:28px 24px;background:#faf9f6;border-radius:12px;border:1px solid #ece9e2;text-align:center;">
            <p style="margin:0;font-size:12px;color:#7a766f;text-transform:uppercase;letter-spacing:0.08em;">Fecha y hora</p>
            <p style="margin:14px 0 4px;font-size:24px;color:#0e0f0f;font-family:'Instrument Serif','Times New Roman',Georgia,serif;line-height:1.2;">${prettyDate}</p>
            <p style="margin:0;font-size:32px;color:#0f7a6d;font-family:'Instrument Serif','Times New Roman',Georgia,serif;line-height:1.1;font-style:italic;">${prettyTime}</p>
            <p style="margin:12px 0 0;font-size:12px;color:#9a958c;">Hora de Madrid (Europe/Madrid)</p>
          </div>
          <p style="margin:0 0 16px;">Te llamaremos al teléfono <span style="color:#0e0f0f;">${ESC_HTML(phone)}</span>. Adjuntamos un evento de calendario para que lo añadas a Google, Outlook o Apple en un clic.</p>
          <p style="margin:20px 0 0;font-size:14px;color:#7a766f;">¿Necesitas cambiarla? <a href="${cancelUrl}" style="color:#0f7a6d;">Cancelar o reagendar</a>.</p>
          <p style="color:#33312d;margin:24px 0 0;">Un saludo,<br><span style="color:#0e0f0f;">El equipo de Shiftia</span></p>
        `
      })
    });

  } catch (err) {
    console.error('Booking error:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Error al agendar. Inténtalo de nuevo.' });
    }
  }
});

// Cancelación de booking via link firmado HMAC. Página HTML simple (no API).
app.get('/booking/cancel', async (req, res) => {
  const id = parseInt(req.query.id, 10);
  const token = String(req.query.token || '');
  if (!id || !token) return res.status(400).send('Parámetros inválidos.');

  try {
    const r = await pool.query('SELECT id, email, name, status, cancel_token, booking_at FROM bookings WHERE id = $1', [id]);
    if (r.rows.length === 0) return res.status(404).send('Reserva no encontrada.');
    const b = r.rows[0];

    if (!b.cancel_token || b.cancel_token.length !== token.length ||
        !crypto.timingSafeEqual(Buffer.from(b.cancel_token), Buffer.from(token))) {
      return res.status(403).send('Token no válido.');
    }

    if (b.status === 'cancelled') {
      return res.status(200).send(htmlPage('Reserva ya cancelada', 'Esta reserva ya estaba cancelada.'));
    }

    await pool.query(
      "UPDATE bookings SET status='cancelled', cancelled_at=NOW(), updated_at=NOW(), cancellation_reason='client_link' WHERE id=$1",
      [id]
    );

    // Notificación interna de cancelación
    sendMail({
      from: `"Shiftia Booking" <${GMAIL_USER}>`,
      to: process.env.SUPPORT_EMAIL || GMAIL_USER,
      subject: `Cancelación de llamada #${id} — ${b.email}`,
      html: emailTemplate({
        preheader: `Cancelación de llamada #${id}`,
        headline: `Llamada #${id} cancelada`,
        body: `<p style="margin:0;">El cliente <span style="color:#0e0f0f;">${ESC_HTML(b.name)}</span> &lt;<a href="mailto:${ESC_HTML(b.email)}" style="color:#0f7a6d;">${ESC_HTML(b.email)}</a>&gt; ha cancelado su llamada del <span style="color:#0e0f0f;">${prettyDateMadrid(b.booking_at)}</span> a las <span style="color:#0e0f0f;">${prettyTimeMadrid(b.booking_at)}</span>.</p>`
      })
    }).catch(() => {});

    return res.status(200).send(htmlPage('Reserva cancelada', `Tu llamada del ${ESC_HTML(prettyDateMadrid(b.booking_at))} a las ${ESC_HTML(prettyTimeMadrid(b.booking_at))} ha quedado cancelada. Si lo deseas, <a href="${APP_URL}/#contact">reserva otra fecha</a>.`));
  } catch (err) {
    console.error('Booking cancel error:', err.message);
    return res.status(500).send('Error procesando la cancelación.');
  }
});

// ====== ADMIN BOOKING ENDPOINTS ======
// Protegidos por ADMIN_API_KEY (no JWT, son endpoints de owner). Sin la key
// devuelven 404 para no leak de su existencia.
function requireAdminKey(req, res) {
  const adminKey = process.env.ADMIN_API_KEY;
  if (!adminKey || (req.query.key !== adminKey && req.headers['x-admin-key'] !== adminKey)) {
    res.status(404).end();
    return false;
  }
  return true;
}

// Listar bookings (próximos primero)
app.get('/api/admin/bookings', async (req, res) => {
  if (!requireAdminKey(req, res)) return;
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
    const status = req.query.status; // 'pending' | 'completed' | 'cancelled' | 'no_show' | undefined
    const params = [];
    let where = '';
    if (status) { params.push(status); where = `WHERE status = $${params.length}`; }
    const r = await pool.query(
      `SELECT id, name, email, phone, company, workers, department, message,
              booking_at, status, email_status, email_error, created_at,
              cancelled_at, cancellation_reason, ip
       FROM bookings ${where}
       ORDER BY booking_at DESC NULLS LAST
       LIMIT ${limit}`,
      params
    );
    res.json({ count: r.rowCount, bookings: r.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Cambiar status de una booking
app.post('/api/admin/bookings/:id/status', express.json(), async (req, res) => {
  if (!requireAdminKey(req, res)) return;
  const id = parseInt(req.params.id, 10);
  const status = String((req.body && req.body.status) || '').toLowerCase();
  const reason = String((req.body && req.body.reason) || '').slice(0, 500);
  const allowed = ['pending', 'confirmed', 'completed', 'cancelled', 'no_show'];
  if (!allowed.includes(status)) return res.status(400).json({ error: 'status inválido' });
  try {
    const setExtra = status === 'cancelled'
      ? ", cancelled_at = NOW(), cancellation_reason = $3"
      : '';
    const params = setExtra ? [status, id, reason] : [status, id];
    const r = await pool.query(
      `UPDATE bookings SET status = $1, updated_at = NOW() ${setExtra} WHERE id = $2 RETURNING id`,
      params
    );
    if (r.rowCount === 0) return res.status(404).json({ error: 'No encontrada' });
    res.json({ ok: true, id, status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Bloquear/desbloquear un día completo (vacaciones, conferencia, etc.)
app.post('/api/admin/blocked-dates', express.json(), async (req, res) => {
  if (!requireAdminKey(req, res)) return;
  const date = String((req.body && req.body.date) || '');
  const reason = String((req.body && req.body.reason) || '').slice(0, 200);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'date YYYY-MM-DD' });
  try {
    await pool.query(
      'INSERT INTO blocked_dates (block_date, reason) VALUES ($1, $2) ON CONFLICT (block_date) DO UPDATE SET reason = EXCLUDED.reason',
      [date, reason || null]
    );
    res.json({ ok: true, date, reason });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/admin/blocked-dates/:date', async (req, res) => {
  if (!requireAdminKey(req, res)) return;
  const date = req.params.date;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'date YYYY-MM-DD' });
  try {
    await pool.query('DELETE FROM blocked_dates WHERE block_date = $1', [date]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Listar días bloqueados
app.get('/api/admin/blocked-dates', async (req, res) => {
  if (!requireAdminKey(req, res)) return;
  try {
    const r = await pool.query("SELECT block_date, reason FROM blocked_dates WHERE block_date >= CURRENT_DATE ORDER BY block_date ASC");
    res.json({ blocked: r.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Export CSV de bookings
app.get('/api/admin/bookings.csv', async (req, res) => {
  if (!requireAdminKey(req, res)) return;
  try {
    const r = await pool.query(
      `SELECT id, name, email, phone, company, workers, department, message,
              to_char(booking_at AT TIME ZONE 'Europe/Madrid', 'YYYY-MM-DD HH24:MI') AS booking_at_madrid,
              status, email_status, created_at
       FROM bookings ORDER BY booking_at DESC NULLS LAST LIMIT 5000`
    );
    const esc = (v) => v == null ? '' : '"' + String(v).replace(/"/g, '""').replace(/\r?\n/g, ' ') + '"';
    const header = 'id,name,email,phone,company,workers,department,message,booking_at_madrid,status,email_status,created_at\n';
    const body = r.rows.map(row =>
      [row.id, esc(row.name), esc(row.email), esc(row.phone), esc(row.company), esc(row.workers),
       esc(row.department), esc(row.message), esc(row.booking_at_madrid), esc(row.status),
       esc(row.email_status), esc(row.created_at && row.created_at.toISOString())].join(',')
    ).join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="bookings-${new Date().toISOString().slice(0,10)}.csv"`);
    res.send(header + body);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

function htmlPage(title, body) {
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} — Shiftia</title>
  <style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:linear-gradient(135deg,#f0fdf9,#eff6ff);min-height:100vh;display:flex;align-items:center;justify-content:center;margin:0;padding:24px;color:#1e293b}main{background:#fff;padding:40px;border-radius:16px;max-width:480px;box-shadow:0 8px 32px rgba(0,0,0,0.06);text-align:center}h1{margin:0 0 12px;color:#2980b9}p{color:#475569;line-height:1.6}a{color:#4ecdc4}</style>
  </head><body><main><h1>${title}</h1><p>${body}</p><p><a href="${APP_URL}/">Volver a Shiftia</a></p></main></body></html>`;
}

// ====== STATIC ROUTES ======
// Serve login.html
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Serve reset-password.html
app.get('/reset-password', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'reset-password.html'));
});

// Serve dashboard.html
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Serve docs.html
app.get('/docs', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'docs.html'));
});

// Serve legal pages
app.get('/privacidad', (req, res) => res.sendFile(path.join(__dirname, 'public', 'privacidad.html')));
app.get('/terminos',   (req, res) => res.sendFile(path.join(__dirname, 'public', 'terminos.html')));
app.get('/cookies',    (req, res) => res.sendFile(path.join(__dirname, 'public', 'cookies.html')));
app.get('/forgot-password', (req, res) => res.sendFile(path.join(__dirname, 'public', 'forgot-password.html')));

// Health check público — minimalista, no expone diagnóstico interno
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Health check completo — solo con ADMIN_API_KEY
app.get('/api/health/full', (req, res) => {
  const adminKey = process.env.ADMIN_API_KEY;
  if (!adminKey || req.query.key !== adminKey) return res.status(404).end();
  res.json({
    status: 'ok',
    version: require('./package.json').version,
    auth: 'enabled',
    email: {
      provider: RESEND_KEY ? 'resend' : (GMAIL_PASS ? 'gmail-smtp' : 'none'),
      from: RESEND_KEY ? RESEND_FROM : GMAIL_USER,
      ready: emailReady,
      error: emailError ? '(set)' : null
    }
  });
});

// Test email endpoint — protegido contra abuso. Requiere ADMIN_API_KEY que solo el
// owner conoce. Sin esa key el endpoint devuelve 404 (no leak de su existencia).
app.get('/api/test-email', async (req, res) => {
  const adminKey = process.env.ADMIN_API_KEY;
  if (!adminKey) return res.status(404).end();
  if (req.query.key !== adminKey) return res.status(404).end();

  const to = req.query.to;
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to) || to.length > 254) {
    return res.status(400).json({ ok: false, error: 'Param "to" inválido' });
  }
  try {
    const result = await sendMail({
      from: `"Shiftia Test" <${GMAIL_USER}>`,
      to: to,
      subject: 'Test email desde Shiftia — ' + new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' }),
      html: emailTemplate({
        preheader: 'Email de prueba — Shiftia',
        headline: 'Email de prueba',
        body: `
          <p style="margin:0 0 16px;">Si ves esto, los emails de Shiftia funcionan correctamente.</p>
          <p style="margin:24px 0 0;font-size:13px;color:#9a958c;">Enviado: ${new Date().toISOString()}</p>
        `
      })
    });
    res.json({ ok: true, to, result: result || 'sent (no response body)', provider: RESEND_KEY ? 'resend' : 'smtp' });
  } catch (err) {
    res.json({ ok: false, to, error: err.message, provider: RESEND_KEY ? 'resend' : 'smtp' });
  }
});

// API 404 — sin esto, una /api/typo cae en el SPA fallback y devuelve HTML
// rompiendo el JSON.parse() del cliente.
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Endpoint no encontrado' });
});

// SPA fallback (solo para rutas no-API)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ====== GLOBAL ERROR HANDLER ======
app.use((err, req, res, next) => {
  console.error('[ERROR]', req.method, req.path, err.message);
  if (process.env.NODE_ENV !== 'production') console.error(err.stack);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Error interno del servidor'
      : err.message
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received — shutting down gracefully');
  await pool.end();
  process.exit(0);
});

// ====== SERVER STARTUP ======
async function startServer() {
  try {
    // Initialize database
    await initializeDatabase();

    app.listen(PORT, () => {
      console.log(`Shiftia HUB v2.3 running on port ${PORT}`);
      console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`  Auth: enabled | Compression: enabled`);
      console.log(`  Email: ${RESEND_KEY ? 'Resend' : (GMAIL_PASS ? 'Gmail SMTP' : 'DISABLED')}`);
      console.log(`  Stripe: ${stripe ? 'configured' : 'NOT configured'}`);
      console.log(`  APP_URL: ${APP_URL}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  }
}

startServer();
