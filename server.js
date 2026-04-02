const express = require('express');
const path = require('path');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const Stripe = require('stripe');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'shiftia-fallback-change-me-in-production';
if (!process.env.JWT_SECRET) {
  console.warn('WARNING: JWT_SECRET env var not set — using insecure fallback. Set it in Railway for production.');
}

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
  if (!stripe) return res.status(400).json({ error: 'Stripe not configured' });

  let event;
  try {
    if (STRIPE_WEBHOOK_SECRET) {
      event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], STRIPE_WEBHOOK_SECRET);
    } else {
      event = JSON.parse(req.body);
    }
  } catch (err) {
    console.error('Stripe webhook signature failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log('Stripe webhook:', event.type);

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
              html: `
                <!DOCTYPE html>
                <html lang="es">
                <head>
                  <meta charset="UTF-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                  <title>Plan activado</title>
                  <!--[if mso]>
                  <style>table { border-collapse: collapse; } .gradient-header { background: #2980b9 !important; }</style>
                  <![endif]-->
                </head>
                <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">

                <!-- Preheader -->
                <div style="display: none; max-height: 0; overflow: hidden; font-size: 1px; color: #f8fafc;">
                  Tu suscripción a Shiftia ha sido activada correctamente
                  &nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
                </div>

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc;">
                  <tr>
                    <td align="center" style="padding: 40px 16px;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto;">

                        <!-- Header with gradient -->
                        <tr>
                          <td class="gradient-header" style="background: linear-gradient(135deg, #4ecdc4, #2980b9); padding: 32px 40px; border-radius: 12px 12px 0 0;">
                            <table role="presentation" cellpadding="0" cellspacing="0">
                              <tr>
                                <td style="padding-bottom: 20px;">
                                  <span style="color: white; font-size: 22px; font-weight: 800; letter-spacing: -0.02em;">Shiftia</span>
                                </td>
                              </tr>
                              <tr>
                                <td>
                                  <h1 style="color: white; margin: 0; font-size: 1.4rem; font-weight: 600; line-height: 1.3;">
                                    Plan activado
                                  </h1>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>

                        <!-- Body -->
                        <tr>
                          <td style="background-color: #ffffff; padding: 40px; border: 1px solid #e2e8f0; border-top: none;">

                            <p style="margin: 0 0 20px; font-size: 15px; color: #334155; line-height: 1.7;">
                              Hola ${esc(name)},
                            </p>
                            <p style="margin: 0 0 24px; font-size: 15px; color: #334155; line-height: 1.7;">
                              ¡Tu suscripción a Shiftia ha sido activada correctamente! Gracias por confiar en nosotros.
                            </p>

                            <!-- Info box -->
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 24px 0; background: #f0fdf9; border-radius: 10px; border-left: 4px solid #4ecdc4;">
                              <tr>
                                <td style="padding: 20px;">
                                  <p style="margin: 0 0 8px; font-size: 14px; font-weight: 600; color: #1e293b;">
                                    Detalles de tu suscripción
                                  </p>
                                  <table role="presentation" cellpadding="0" cellspacing="0">
                                    <tr><td style="font-size: 13px; color: #64748b; padding: 4px 16px 4px 0; font-weight: 600;">Plan</td><td style="font-size: 14px; color: #1e293b; font-weight: 600;">${planNames[plan]}</td></tr>
                                    <tr><td style="font-size: 13px; color: #64748b; padding: 4px 16px 4px 0; font-weight: 600;">Ciclo de facturación</td><td style="font-size: 14px; color: #1e293b;">${billing === 'annual' ? 'Anual' : 'Mensual'}</td></tr>
                                    <tr><td style="font-size: 13px; color: #64748b; padding: 4px 16px 4px 0; font-weight: 600;">Importe</td><td style="font-size: 14px; color: #1e293b; font-weight: 700;">${amount}</td></tr>
                                  </table>
                                </td>
                              </tr>
                            </table>

                            <p style="margin: 0 0 20px; font-size: 14px; color: #334155; line-height: 1.6;">
                              Tienes acceso completo a todas las características de tu plan. Si en los próximos 30 días no estás completamente satisfecho, podemos devolverte el dinero sin preguntas.
                            </p>

                            <!-- CTA -->
                            <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
                              <tr>
                                <td style="background: #2980b9; border-radius: 8px;">
                                  <a href="${APP_URL}/dashboard" target="_blank" style="display: inline-block; padding: 14px 32px; color: #ffffff; font-size: 15px; font-weight: 600; text-decoration: none; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                                    Ir a mi dashboard
                                  </a>
                                </td>
                              </tr>
                            </table>

                            <p style="margin: 0; font-size: 14px; color: #64748b; line-height: 1.6;">
                              Si tienes alguna pregunta sobre tu suscripción, no dudes en responder a este email. Estamos aquí para ayudarte.
                            </p>
                          </td>
                        </tr>

                        <!-- Footer -->
                        <tr>
                          <td style="background-color: #ffffff; padding: 0 40px 32px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                              <tr>
                                <td style="border-top: 1px solid #e2e8f0; padding-top: 24px;">
                                  <p style="margin: 0; font-size: 12px; color: #94a3b8; line-height: 1.6;">
                                    Este email fue enviado por <a href="https://shiftia.es" style="color: #2980b9; text-decoration: none;">Shiftia</a>.
                                    <br>Planificación inteligente de turnos hospitalarios.
                                  </p>
                                  <p style="margin: 12px 0 0; font-size: 12px; color: #94a3b8;">
                                    <a href="${APP_URL}/dashboard#settings" style="color: #94a3b8; text-decoration: underline;">Gestionar preferencias</a>
                                    &nbsp;&bull;&nbsp;
                                    <a href="${APP_URL}/unsubscribe?email=${encodeURIComponent(email)}" style="color: #94a3b8; text-decoration: underline;">Darme de baja</a>
                                  </p>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>

                      </table>
                    </td>
                  </tr>
                </table>

                </body>
                </html>
              `
            }).then(() => console.log('Payment confirmation email sent to', email)).catch(err => console.error('Payment confirmation email failed:', err.message));
          }
        }
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object;
        const status = sub.status; // active, past_due, canceled, unpaid
        if (sub.metadata?.user_id) {
          const planStatus = status === 'active' ? 'active' : (status === 'canceled' ? 'cancelled' : 'past_due');
          await pool.query(
            `UPDATE users SET plan_status = $1 WHERE id = $2`,
            [planStatus, sub.metadata.user_id]
          );
          console.log(`Subscription ${status} for user ${sub.metadata.user_id}`);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        if (sub.metadata?.user_id) {
          await pool.query(
            `UPDATE users SET plan = 'trial', plan_status = 'active', workers_limit = 25,
             stripe_subscription_id = NULL, billing_cycle = NULL WHERE id = $1`,
            [sub.metadata.user_id]
          );
          console.log(`Subscription cancelled → trial for user ${sub.metadata.user_id}`);
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
            html: `
              <!DOCTYPE html>
              <html lang="es">
              <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Problema con el pago</title>
                <!--[if mso]>
                <style>table { border-collapse: collapse; } .gradient-header { background: #2980b9 !important; }</style>
                <![endif]-->
              </head>
              <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">

              <!-- Preheader -->
              <div style="display: none; max-height: 0; overflow: hidden; font-size: 1px; color: #f8fafc;">
                Actualiza tu método de pago para mantener tu cuenta activa
                &nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
              </div>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc;">
                <tr>
                  <td align="center" style="padding: 40px 16px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto;">

                      <!-- Header with gradient -->
                      <tr>
                        <td class="gradient-header" style="background: linear-gradient(135deg, #4ecdc4, #2980b9); padding: 32px 40px; border-radius: 12px 12px 0 0;">
                          <table role="presentation" cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="padding-bottom: 20px;">
                                <span style="color: white; font-size: 22px; font-weight: 800; letter-spacing: -0.02em;">Shiftia</span>
                              </td>
                            </tr>
                            <tr>
                              <td>
                                <h1 style="color: white; margin: 0; font-size: 1.4rem; font-weight: 600; line-height: 1.3;">
                                  Problema con el pago
                                </h1>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>

                      <!-- Body -->
                      <tr>
                        <td style="background-color: #ffffff; padding: 40px; border: 1px solid #e2e8f0; border-top: none;">

                          <p style="margin: 0 0 20px; font-size: 15px; color: #334155; line-height: 1.7;">
                            Hola ${esc(name)},
                          </p>
                          <p style="margin: 0 0 20px; font-size: 15px; color: #334155; line-height: 1.7;">
                            No hemos podido procesar el pago de tu suscripción a Shiftia ${planNames[plan] || plan}.
                            Esto suele ocurrir por una tarjeta caducada o fondos insuficientes — no te preocupes,
                            es fácil de resolver.
                          </p>

                          <!-- Payment details -->
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 24px 0; background: #fef2f2; border-radius: 10px; border-left: 4px solid #ef4444;">
                            <tr>
                              <td style="padding: 20px;">
                                <p style="margin: 0 0 8px; font-size: 14px; font-weight: 600; color: #991b1b;">Pago no procesado</p>
                                <table role="presentation" cellpadding="0" cellspacing="0">
                                  <tr><td style="font-size: 13px; color: #64748b; padding: 4px 16px 4px 0; font-weight: 600;">Plan</td><td style="font-size: 14px; color: #1e293b;">${planNames[plan] || plan}</td></tr>
                                  <tr><td style="font-size: 13px; color: #64748b; padding: 4px 16px 4px 0; font-weight: 600;">Fecha del intento</td><td style="font-size: 14px; color: #1e293b;">${new Date().toLocaleDateString('es-ES')}</td></tr>
                                </table>
                              </td>
                            </tr>
                          </table>

                          <p style="margin: 0 0 8px; font-size: 14px; color: #334155; line-height: 1.6;">
                            Reintentaremos el cobro en 3 días. Para evitar interrupciones en tu servicio, puedes
                            actualizar tu método de pago ahora:
                          </p>

                          <!-- CTA -->
                          <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
                            <tr>
                              <td style="background: #2980b9; border-radius: 8px;">
                                <a href="${APP_URL}/dashboard" target="_blank" style="display: inline-block; padding: 14px 32px; color: #ffffff; font-size: 15px; font-weight: 600; text-decoration: none; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                                  Actualizar método de pago
                                </a>
                              </td>
                            </tr>
                          </table>

                          <p style="margin: 0; font-size: 14px; color: #64748b; line-height: 1.6;">
                            Si tienes alguna pregunta, responde a este email y te ayudamos.
                          </p>
                        </td>
                      </tr>

                      <!-- Footer -->
                      <tr>
                        <td style="background-color: #ffffff; padding: 0 40px 32px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="border-top: 1px solid #e2e8f0; padding-top: 24px;">
                                <p style="margin: 0; font-size: 12px; color: #94a3b8; line-height: 1.6;">
                                  Este email fue enviado por <a href="https://shiftia.es" style="color: #2980b9; text-decoration: none;">Shiftia</a>.
                                  <br>Planificación inteligente de turnos hospitalarios.
                                </p>
                                <p style="margin: 12px 0 0; font-size: 12px; color: #94a3b8;">
                                  <a href="${APP_URL}/dashboard#settings" style="color: #94a3b8; text-decoration: underline;">Gestionar preferencias</a>
                                  &nbsp;&bull;&nbsp;
                                  <a href="${APP_URL}/unsubscribe?email=${encodeURIComponent(email)}" style="color: #94a3b8; text-decoration: underline;">Darme de baja</a>
                                </p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>

                    </table>
                  </td>
                </tr>
              </table>

              </body>
              </html>
            `
          }).then(() => console.log('Payment failed email sent to', email)).catch(err => console.error('Payment failed email failed:', err.message));
        }
        break;
      }
    }
  } catch (err) {
    console.error('Webhook handler error:', err.message);
  }

  res.json({ received: true });
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

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
        user_id INTEGER REFERENCES users(id),
        token VARCHAR(255) UNIQUE NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        used BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    console.log('Database initialized: all tables created');

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

// ====== AUTHENTICATION ROUTES ======
// POST /api/auth/register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name, company } = req.body;

    // Validate required fields
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name are required' });
    }

    // Validate email format
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Validate password strength (at least 8 chars)
    if (password.length < 8) {
      return res.status(400).json({ error: 'La contrasena debe tener al menos 8 caracteres' });
    }

    // Check if email already exists
    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
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
      [email.toLowerCase(), passwordHash, name, company || null, 'trial', 'active', 25]
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
      html: `
        <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Bienvenido a Shiftia</title>
          <!--[if mso]>
          <style>table { border-collapse: collapse; } .gradient-header { background: #2980b9 !important; }</style>
          <![endif]-->
        </head>
        <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">

        <!-- Preheader -->
        <div style="display: none; max-height: 0; overflow: hidden; font-size: 1px; color: #f8fafc;">
          Crea tu primera planilla en menos de 5 minutos
          &nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
        </div>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc;">
          <tr>
            <td align="center" style="padding: 40px 16px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto;">

                <!-- Header with gradient -->
                <tr>
                  <td class="gradient-header" style="background: linear-gradient(135deg, #4ecdc4, #2980b9); padding: 32px 40px; border-radius: 12px 12px 0 0;">
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding-bottom: 20px;">
                          <span style="color: white; font-size: 22px; font-weight: 800; letter-spacing: -0.02em;">Shiftia</span>
                        </td>
                      </tr>
                      <tr>
                        <td>
                          <h1 style="color: white; margin: 0; font-size: 1.4rem; font-weight: 600; line-height: 1.3;">
                            Bienvenido a Shiftia
                          </h1>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Body -->
                <tr>
                  <td style="background-color: #ffffff; padding: 40px; border: 1px solid #e2e8f0; border-top: none;">

                    <p style="margin: 0 0 20px; font-size: 15px; color: #334155; line-height: 1.7;">
                      Hola ${esc(user.name)},
                    </p>
                    <p style="margin: 0 0 20px; font-size: 15px; color: #334155; line-height: 1.7;">
                      Acabas de dar un paso importante para simplificar la planificación de turnos${user.company ? ' en ' + esc(user.company) : ''}. Shiftia se encarga de lo complejo para que tú puedas centrarte en tu equipo.
                    </p>

                    <!-- 3 steps -->
                    <p style="margin: 0 0 16px; font-size: 14px; font-weight: 600; color: #1e293b;">
                      Empieza en 3 pasos:
                    </p>

                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 24px;">
                      <tr>
                        <td style="padding: 12px 0; border-bottom: 1px solid #f1f5f9;">
                          <table role="presentation" cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="width: 32px; height: 32px; background: linear-gradient(135deg, #4ecdc4, #2980b9); border-radius: 50%; text-align: center; vertical-align: middle; color: white; font-size: 14px; font-weight: 700;">1</td>
                              <td style="padding-left: 14px; font-size: 14px; color: #334155;">Crea tu primera planilla con los turnos de tu servicio</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 0; border-bottom: 1px solid #f1f5f9;">
                          <table role="presentation" cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="width: 32px; height: 32px; background: linear-gradient(135deg, #4ecdc4, #2980b9); border-radius: 50%; text-align: center; vertical-align: middle; color: white; font-size: 14px; font-weight: 700;">2</td>
                              <td style="padding-left: 14px; font-size: 14px; color: #334155;">Añade a los trabajadores de tu equipo</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 0;">
                          <table role="presentation" cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="width: 32px; height: 32px; background: linear-gradient(135deg, #4ecdc4, #2980b9); border-radius: 50%; text-align: center; vertical-align: middle; color: white; font-size: 14px; font-weight: 700;">3</td>
                              <td style="padding-left: 14px; font-size: 14px; color: #334155;">Deja que la IA sugiera las coberturas óptimas</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>

                    <!-- CTA -->
                    <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 8px 0 24px;">
                      <tr>
                        <td style="background: #2980b9; border-radius: 8px;">
                          <a href="${APP_URL}/dashboard" target="_blank" style="display: inline-block; padding: 14px 32px; color: #ffffff; font-size: 15px; font-weight: 600; text-decoration: none; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                            Ir a mi dashboard
                          </a>
                        </td>
                      </tr>
                    </table>

                    <p style="margin: 0; font-size: 14px; color: #64748b; line-height: 1.6;">
                      Si necesitas ayuda, responde a este email o agenda una llamada con nuestro equipo.
                      Estamos aquí para hacer tu transición lo más fácil posible.
                    </p>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="background-color: #ffffff; padding: 0 40px 32px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="border-top: 1px solid #e2e8f0; padding-top: 24px;">
                          <p style="margin: 0; font-size: 12px; color: #94a3b8; line-height: 1.6;">
                            Este email fue enviado por <a href="https://shiftia.es" style="color: #2980b9; text-decoration: none;">Shiftia</a>.
                            <br>Planificación inteligente de turnos hospitalarios.
                          </p>
                          <p style="margin: 12px 0 0; font-size: 12px; color: #94a3b8;">
                            <a href="${APP_URL}/dashboard#settings" style="color: #94a3b8; text-decoration: underline;">Gestionar preferencias</a>
                            &nbsp;&bull;&nbsp;
                            <a href="${APP_URL}/unsubscribe?email=${encodeURIComponent(user.email)}" style="color: #94a3b8; text-decoration: underline;">Darme de baja</a>
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>

        </body>
        </html>
      `
    }).then(() => console.log('Welcome email sent to', user.email)).catch(err => console.error('Welcome email failed:', err.message));

  } catch (err) {
    console.error('Register error:', err.message);
    res.status(500).json({ error: 'Error creating account' });
  }
});

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user by email
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
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
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Look up user by email (case-insensitive)
    const userResult = await pool.query('SELECT id, email, name FROM users WHERE LOWER(email) = LOWER($1)', [email]);
    const userExists = userResult.rows.length > 0;

    // Always respond with same success message (don't reveal if email exists)
    if (userExists) {
      const user = userResult.rows[0];

      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

      // Store token in database
      await pool.query(
        'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
        [user.id, resetToken, expiresAt]
      );

      // Send email with reset link
      const resetLink = `${APP_URL}/reset-password?token=${resetToken}`;

      sendMail({
        from: `"Shiftia" <${RESEND_FROM}>`,
        to: user.email,
        subject: 'Restablecer tu contraseña - Shiftia',
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 0;">
            <div style="background: linear-gradient(135deg, #4ecdc4, #2980b9); padding: 40px 32px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 1.6rem; font-weight: 700;">Shiftia</h1>
              <p style="color: rgba(255, 255, 255, 0.9); margin: 12px 0 0 0; font-size: 0.95rem;">Planificación de Turnos Hospitalarios</p>
            </div>
            <div style="background: #f8fafc; padding: 40px 32px; border-bottom: 1px solid #e2e8f0;">
              <p style="color: #1e293b; font-size: 1rem; margin: 0 0 24px 0; line-height: 1.6;">
                Hola ${esc(user.name)},
              </p>
              <p style="color: #475569; font-size: 0.95rem; margin: 0 0 24px 0; line-height: 1.6;">
                Recibimos una solicitud para restablecer tu contraseña. Haz clic en el botón de abajo para crear una nueva contraseña.
              </p>
              <div style="text-align: center; margin: 32px 0;">
                <a href="${resetLink}" style="background: linear-gradient(135deg, #4ecdc4, #2980b9); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 0.95rem; display: inline-block; transition: transform 0.3s ease;">
                  Restablecer Contraseña
                </a>
              </div>
              <p style="color: #64748b; font-size: 0.85rem; margin: 32px 0 0 0; padding-top: 24px; border-top: 1px solid #e2e8f0;">
                Este enlace expira en 1 hora. Si no solicitaste cambiar tu contraseña, puedes ignorar este correo.
              </p>
              <p style="color: #64748b; font-size: 0.85rem; margin: 16px 0 0 0;">
                O copia este enlace en tu navegador:<br/>
                <span style="color: #2980b9; word-break: break-all;">${resetLink}</span>
              </p>
            </div>
            <div style="background: white; padding: 24px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="color: #64748b; font-size: 0.8rem; margin: 0;">
                © 2026 Shiftia. Todos los derechos reservados.
              </p>
            </div>
          </div>
        `
      });

      console.log(`Password reset email sent to ${user.email}`);
    }

    // Always send same success message
    res.json({ message: 'Si el correo existe en nuestro sistema, recibirás instrucciones para restablecer tu contraseña en breve.' });
  } catch (err) {
    console.error('Forgot password error:', err.message);
    res.status(500).json({ error: 'Error processing request' });
  }
});

// POST /api/auth/reset-password
app.post('/api/auth/reset-password', async (req, res) => {
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

// PUT /api/auth/update (protected)
app.put('/api/auth/update', authMiddleware, async (req, res) => {
  try {
    const { name, email, company, password } = req.body;
    const userId = req.user.id;

    // Validate at least one field
    if (!name && !email && !company && !password) {
      return res.status(400).json({ error: 'At least one field is required' });
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
      // Check if email is already taken by another user
      const existingUser = await pool.query('SELECT id FROM users WHERE email = $1 AND id != $2', [email.toLowerCase(), userId]);
      if (existingUser.rows.length > 0) {
        return res.status(409).json({ error: 'Email already in use' });
      }
      updates.push(`email = $${paramCount}`);
      values.push(email.toLowerCase());
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
    const { category, subject, message } = req.body;

    // Validate required fields
    if (!subject || !message) {
      return res.status(400).json({ error: 'Subject and message are required' });
    }

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
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px;">
              <div style="background: linear-gradient(135deg, #4ecdc4, #2980b9); padding: 24px 32px; border-radius: 12px 12px 0 0;">
                <h1 style="color: white; margin: 0; font-size: 1.4rem;">${esc(catLabels[cat] || cat)}: ${esc(subject)}</h1>
              </div>
              <div style="background: #f8fafc; padding: 32px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
                  <tr><td style="padding: 10px 0; color: #64748b; font-weight: 600; width: 110px;">Nombre</td><td style="padding: 10px 0; color: #1e293b;">${esc(user.name)}</td></tr>
                  <tr><td style="padding: 10px 0; color: #64748b; font-weight: 600;">Email</td><td style="padding: 10px 0;"><a href="mailto:${esc(user.email)}" style="color: #2980b9;">${esc(user.email)}</a></td></tr>
                  ${user.company ? `<tr><td style="padding: 10px 0; color: #64748b; font-weight: 600;">Empresa</td><td style="padding: 10px 0; color: #1e293b;">${esc(user.company)}</td></tr>` : ''}
                  <tr><td style="padding: 10px 0; color: #64748b; font-weight: 600;">Categoría</td><td style="padding: 10px 0; color: #1e293b;">${esc(catLabels[cat] || cat)}</td></tr>
                </table>
                <div style="padding: 20px; background: white; border-radius: 8px; border: 1px solid #e2e8f0;">
                  <p style="color: #64748b; font-weight: 600; margin-bottom: 12px;">Mensaje:</p>
                  <p style="color: #1e293b; line-height: 1.6; margin: 0; white-space: pre-wrap;">${esc(message)}</p>
                </div>
              </div>
            </div>
          `
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
const rateLimit = new Map();
function isRateLimited(ip) {
  const now = Date.now();
  const attempts = rateLimit.get(ip) || [];
  const recent = attempts.filter(t => now - t < 60000); // 1 minute window
  rateLimit.set(ip, recent);
  if (recent.length >= 3) return true; // Max 3 per minute
  recent.push(now);
  rateLimit.set(ip, recent);
  return false;
}

// ====== CONTACT FORM API ======
app.post('/api/contact', async (req, res) => {
  try {
    // Rate limiting
    const clientIP = req.ip || req.connection.remoteAddress;
    if (isRateLimited(clientIP)) {
      return res.status(429).json({ error: 'Demasiadas solicitudes. Espera un momento.' });
    }

    const { name, email, company, workers, department, message } = req.body;

    // Validate required fields
    if (!name || !email) {
      return res.status(400).json({ error: 'Nombre y email son obligatorios' });
    }

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
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px;">
              <div style="background: linear-gradient(135deg, #4ecdc4, #2980b9); padding: 24px 32px; border-radius: 12px 12px 0 0;">
                <h1 style="color: white; margin: 0; font-size: 1.4rem;">Nueva solicitud de demo</h1>
              </div>
              <div style="background: #f8fafc; padding: 32px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
                <table style="width: 100%; border-collapse: collapse;">
                  <tr><td style="padding: 10px 0; color: #64748b; font-weight: 600; width: 140px;">Nombre</td><td style="padding: 10px 0; color: #1e293b;">${safeName}</td></tr>
                  <tr><td style="padding: 10px 0; color: #64748b; font-weight: 600;">Email</td><td style="padding: 10px 0;"><a href="mailto:${safeEmail}" style="color: #2980b9;">${safeEmail}</a></td></tr>
                  ${safeCompany ? `<tr><td style="padding: 10px 0; color: #64748b; font-weight: 600;">Empresa</td><td style="padding: 10px 0; color: #1e293b;">${safeCompany}</td></tr>` : ''}
                  ${safeWorkers ? `<tr><td style="padding: 10px 0; color: #64748b; font-weight: 600;">Trabajadores</td><td style="padding: 10px 0; color: #1e293b;">${safeWorkers}</td></tr>` : ''}
                  ${safeDepartment ? `<tr><td style="padding: 10px 0; color: #64748b; font-weight: 600;">Departamento</td><td style="padding: 10px 0; color: #1e293b;">${safeDepartment}</td></tr>` : ''}
                </table>
                ${safeMessage ? `
                  <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
                    <p style="color: #64748b; font-weight: 600; margin-bottom: 8px;">Mensaje:</p>
                    <p style="color: #1e293b; line-height: 1.6; background: white; padding: 16px; border-radius: 8px; border: 1px solid #e2e8f0;">${safeMessage}</p>
                  </div>
                ` : ''}
                <p style="color: #94a3b8; font-size: 0.82rem; margin-top: 24px;">Enviado desde www.shiftia.es — ${new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })}</p>
              </div>
            </div>
          `
        });

    sendMail({
          from: `"Shiftia" <${GMAIL_USER}>`,
          to: email,
          subject: 'Hemos recibido tu solicitud — Shiftia',
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px;">
              <div style="background: linear-gradient(135deg, #4ecdc4, #2980b9); padding: 24px 32px; border-radius: 12px 12px 0 0; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 1.5rem;">Shiftia</h1>
              </div>
              <div style="background: #ffffff; padding: 32px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
                <h2 style="color: #1e293b; margin-top: 0;">Hola ${safeName.split(' ')[0]},</h2>
                <p style="color: #475569; line-height: 1.7;">Hemos recibido tu solicitud correctamente. Nuestro equipo la revisara y te contactaremos en <strong>menos de 24 horas laborables</strong> con una propuesta personalizada.</p>
                <p style="color: #475569; line-height: 1.7;">Mientras tanto, si tienes cualquier duda, puedes responder a este email directamente.</p>
                <div style="margin: 28px 0; padding: 20px; background: #f0fdf9; border-radius: 8px; border-left: 4px solid #4ecdc4;">
                  <p style="color: #1e293b; margin: 0; font-weight: 600;">Lo que incluye tu demo:</p>
                  <ul style="color: #475569; line-height: 1.8; padding-left: 20px;">
                    <li>Configuracion con los datos de tu equipo</li>
                    <li>Demo en vivo del motor IA de coberturas</li>
                    <li>30 dias de garantia de reembolso en todos los planes</li>
                  </ul>
                </div>
                <p style="color: #475569;">Un saludo,<br><strong>El equipo de Shiftia</strong></p>
              </div>
              <p style="text-align: center; color: #94a3b8; font-size: 0.78rem; margin-top: 20px;">www.shiftia.es</p>
            </div>
          `
        });

  } catch (err) {
    console.error('Contact form error:', err.message);
    if (!res.headersSent) res.status(500).json({ error: 'Error al enviar. Intentalo de nuevo.' });
  }
});

// ====== CALL BOOKING API ======
// GET booked slots for a date (so frontend can disable them)
app.get('/api/booking/slots', async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.json({ booked: [] });
    const result = await pool.query(
      "SELECT booking_time FROM bookings WHERE booking_date = $1 AND status != 'cancelled'",
      [date]
    );
    res.json({ booked: result.rows.map(r => r.booking_time) });
  } catch (err) {
    // Table might not exist
    res.json({ booked: [] });
  }
});

app.post('/api/booking', async (req, res) => {
  try {
    // Rate limiting
    const clientIP = req.ip || req.connection.remoteAddress;
    if (isRateLimited(clientIP)) {
      return res.status(429).json({ error: 'Demasiadas solicitudes. Espera un momento.' });
    }

    const { name, email, phone, company, workers, department, message, date, time } = req.body;

    // Validate required fields
    if (!name || !email || !phone || !date || !time) {
      return res.status(400).json({ error: 'Nombre, email, teléfono, fecha y hora son obligatorios' });
    }

    // Validate email
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Email no válido' });
    }

    // Validate date format (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'Formato de fecha no válido' });
    }

    // Validate time format (HH:MM)
    if (!/^\d{2}:\d{2}$/.test(time)) {
      return res.status(400).json({ error: 'Formato de hora no válido' });
    }

    // Validate date is weekday and not in the past
    const bookingDate = new Date(date + 'T00:00:00');
    if (isNaN(bookingDate.getTime())) {
      return res.status(400).json({ error: 'Fecha no válida' });
    }
    const dow = bookingDate.getDay();
    if (dow === 0 || dow === 6) {
      return res.status(400).json({ error: 'Solo se puede agendar de lunes a viernes' });
    }

    // Check date is not in the past
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (bookingDate < today) {
      return res.status(400).json({ error: 'No se puede agendar en una fecha pasada' });
    }

    // Validate time is 8-18
    const hour = parseInt(time.split(':')[0], 10);
    if (hour < 8 || hour > 18) {
      return res.status(400).json({ error: 'Horario disponible: 8:00 - 18:00' });
    }

    const esc = (str) => String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    // Check for conflicting booking (same day + same hour)
    try {
      const conflict = await pool.query(
        'SELECT id FROM bookings WHERE booking_date = $1 AND booking_time = $2 AND status != $3 LIMIT 1',
        [date, time, 'cancelled']
      );
      if (conflict.rows.length > 0) {
        return res.status(409).json({ error: 'Esa hora ya está reservada. Por favor, elige otra.' });
      }
    } catch (conflictErr) {
      // Table might not exist yet — that's fine, no conflict possible
      if (!conflictErr.message.includes('does not exist')) {
        console.error('Conflict check failed:', conflictErr.message);
        return res.status(500).json({ error: 'Error al verificar disponibilidad. Inténtalo de nuevo.' });
      }
    }

    // Save booking to database
    try {
      await pool.query(
        'INSERT INTO bookings (name, email, phone, company, workers, department, message, booking_date, booking_time) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
        [name, email, phone, company || null, workers || null, department || null, message || null, date, time]
      );
    } catch (dbErr) {
      if (dbErr.message.includes('does not exist')) {
        await pool.query(`
          CREATE TABLE IF NOT EXISTS bookings (
            id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL, email VARCHAR(255) NOT NULL,
            phone VARCHAR(50) NOT NULL, company VARCHAR(255), workers VARCHAR(50),
            department VARCHAR(255), message TEXT, booking_date DATE NOT NULL,
            booking_time VARCHAR(10) NOT NULL, status VARCHAR(50) DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT NOW()
          );
        `);
        await pool.query(
          'INSERT INTO bookings (name, email, phone, company, workers, department, message, booking_date, booking_time) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
          [name, email, phone, company || null, workers || null, department || null, message || null, date, time]
        );
      } else {
        console.warn('DB insert booking failed:', dbErr.message);
      }
    }

    // Format date for emails
    const dayNames = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
    const monthNames = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
    const prettyDate = `${dayNames[bookingDate.getDay()]} ${bookingDate.getDate()} de ${monthNames[bookingDate.getMonth()]} de ${bookingDate.getFullYear()}`;

    // Respond immediately — don't wait for emails
    console.log(`Booking: ${name} <${email}> tel:${phone} — ${date} ${time}`);
    res.json({ ok: true });

    // Fire-and-forget email notifications (don't block the response)
    // 1. Notification to Diego
    sendMail({
          from: `"Shiftia Booking" <${GMAIL_USER}>`,
          to: process.env.SUPPORT_EMAIL || GMAIL_USER,
          subject: `📞 Nueva llamada agendada — ${esc(name)} (${esc(company || 'N/A')}) — ${prettyDate} ${time}h`,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #4ecdc4, #2980b9); padding: 24px 32px; border-radius: 12px 12px 0 0;">
                <h1 style="color: white; margin: 0; font-size: 1.3rem;">📞 Llamada agendada</h1>
              </div>
              <div style="background: #f8fafc; padding: 32px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
                <div style="background: #f0fdf9; padding: 20px; border-radius: 10px; border-left: 4px solid #4ecdc4; margin-bottom: 24px;">
                  <p style="margin: 0; font-size: 1.1rem; font-weight: 700; color: #1e293b;">📅 ${prettyDate} a las ${time}h</p>
                </div>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr><td style="padding: 10px 0; color: #64748b; font-weight: 600; width: 130px;">Nombre</td><td style="padding: 10px 0; color: #1e293b;">${esc(name)}</td></tr>
                  <tr><td style="padding: 10px 0; color: #64748b; font-weight: 600;">Email</td><td style="padding: 10px 0;"><a href="mailto:${esc(email)}" style="color: #2980b9;">${esc(email)}</a></td></tr>
                  <tr><td style="padding: 10px 0; color: #64748b; font-weight: 600;">Teléfono</td><td style="padding: 10px 0; color: #1e293b; font-weight: 700;"><a href="tel:${esc(phone)}" style="color: #2980b9;">${esc(phone)}</a></td></tr>
                  ${company ? `<tr><td style="padding: 10px 0; color: #64748b; font-weight: 600;">Empresa</td><td style="padding: 10px 0; color: #1e293b;">${esc(company)}</td></tr>` : ''}
                  ${workers ? `<tr><td style="padding: 10px 0; color: #64748b; font-weight: 600;">Trabajadores</td><td style="padding: 10px 0; color: #1e293b;">${esc(workers)}</td></tr>` : ''}
                  ${department ? `<tr><td style="padding: 10px 0; color: #64748b; font-weight: 600;">Departamento</td><td style="padding: 10px 0; color: #1e293b;">${esc(department)}</td></tr>` : ''}
                </table>
                ${message ? `<div style="margin-top: 20px; padding: 16px; background: white; border-radius: 8px; border: 1px solid #e2e8f0;"><p style="color: #64748b; font-weight: 600; margin: 0 0 8px 0;">Mensaje:</p><p style="color: #1e293b; line-height: 1.6; margin: 0;">${esc(message)}</p></div>` : ''}
                <p style="color: #94a3b8; font-size: 0.82rem; margin-top: 24px;">Reservado desde shiftia.es — ${new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })}</p>
              </div>
            </div>
          `
        });

    // 2. Confirmation to client
    sendMail({
          from: `"Shiftia" <${GMAIL_USER}>`,
          replyTo: process.env.SUPPORT_EMAIL || GMAIL_USER,
          to: email,
          subject: `Llamada confirmada — ${prettyDate} a las ${time}h — Shiftia`,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #4ecdc4, #2980b9); padding: 24px 32px; border-radius: 12px 12px 0 0; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 1.5rem;">Shiftia</h1>
              </div>
              <div style="background: #ffffff; padding: 32px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
                <h2 style="color: #1e293b; margin-top: 0;">Hola ${esc(name).split(' ')[0]},</h2>
                <p style="color: #475569; line-height: 1.7;">Tu llamada ha sido agendada correctamente. Aquí tienes los detalles:</p>
                <div style="margin: 24px 0; padding: 24px; background: linear-gradient(135deg, rgba(78,205,196,0.08), rgba(41,128,185,0.08)); border-radius: 12px; border: 1px solid rgba(78,205,196,0.2); text-align: center;">
                  <p style="margin: 0 0 4px 0; font-size: 0.85rem; color: #64748b;">Fecha y hora</p>
                  <p style="margin: 0; font-size: 1.25rem; font-weight: 700; color: #2980b9;">${prettyDate}</p>
                  <p style="margin: 4px 0 0 0; font-size: 1.5rem; font-weight: 800; color: #4ecdc4;">${time}h</p>
                </div>
                <p style="color: #475569; line-height: 1.7;">Nos pondremos en contacto contigo al teléfono <strong>${esc(phone)}</strong> o por email para coordinar los detalles de la reunión.</p>
                <p style="color: #475569; line-height: 1.7;">Si necesitas cancelar o cambiar la hora, responde a este email.</p>
                <p style="color: #475569; margin-top: 24px;">Un saludo,<br><strong>El equipo de Shiftia</strong></p>
              </div>
              <p style="text-align: center; color: #94a3b8; font-size: 0.78rem; margin-top: 20px;">www.shiftia.es</p>
            </div>
          `
        });

  } catch (err) {
    console.error('Booking error:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Error al agendar. Inténtalo de nuevo.' });
    }
  }
});

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

// Health check with email diagnostics
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '2.3.0',
    auth: 'enabled',
    email: {
      provider: RESEND_KEY ? 'resend' : (GMAIL_PASS ? 'gmail-smtp' : 'none'),
      from: RESEND_KEY ? RESEND_FROM : GMAIL_USER,
      ready: emailReady,
      error: emailError,
      user: GMAIL_USER
    }
  });
});

// Test email endpoint — send a test to verify delivery
app.get('/api/test-email', async (req, res) => {
  const to = req.query.to || process.env.SUPPORT_EMAIL || GMAIL_USER;
  try {
    const result = await sendMail({
      from: `"Shiftia Test" <${GMAIL_USER}>`,
      to: to,
      subject: 'Test email desde Shiftia — ' + new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' }),
      html: '<div style="font-family:sans-serif;padding:20px;"><h2 style="color:#2980b9;">Email de prueba</h2><p>Si ves esto, los emails de Shiftia funcionan correctamente.</p><p style="color:#64748b;font-size:0.85rem;">Enviado: ' + new Date().toISOString() + '</p></div>'
    });
    res.json({ ok: true, to, result: result || 'sent (no response body)', provider: RESEND_KEY ? 'resend' : 'smtp' });
  } catch (err) {
    res.json({ ok: false, to, error: err.message, provider: RESEND_KEY ? 'resend' : 'smtp' });
  }
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ====== SERVER STARTUP ======
async function startServer() {
  try {
    // Initialize database
    await initializeDatabase();

    app.listen(PORT, () => {
      console.log(`Shiftia HUB v2.0 running on port ${PORT}`);
      console.log('Authentication enabled');
      console.log(`Database connected`);
    });
  } catch (err) {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  }
}

startServer();
