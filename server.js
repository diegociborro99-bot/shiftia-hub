const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const rateLimit = require('express-rate-limit');

const compression = require('compression');
const multer = require('multer');
const bookingLib = require('./lib/booking');
const nurture = require('./lib/nurture');
const auditAI = require('./lib/audit-ai');
const { analyzeSchedule } = require('./lib/audit');
const { buildAuditPdf } = require('./lib/audit-pdf');

const app = express();
app.disable('x-powered-by');
const PORT = process.env.PORT || 3000;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// ====== VERSION BANNER ======
// Visible en logs de Railway para confirmar qué build está corriendo.
const PKG_VERSION = require('./package.json').version;
// BUILD_ID: identifica el contenido publicado. Cambia cuando cambia index.html,
// así el service worker se reversiona solo (sin tocar CACHE_NAME a mano).
let BUILD_ID = PKG_VERSION;
try {
  const idx = fs.readFileSync(path.join(__dirname, 'public', 'index.html'));
  BUILD_ID = PKG_VERSION + '-' + crypto.createHash('sha1').update(idx).digest('hex').slice(0, 8);
} catch (_) { /* fallback a PKG_VERSION */ }
console.log('========================================');
console.log(`  Shiftia HUB v${PKG_VERSION} starting`);
console.log(`  NODE_ENV=${process.env.NODE_ENV || 'development'}`);
console.log(`  PORT=${PORT}`);
console.log('========================================');

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

// ====== SEO: canonical host + HTTPS redirect ======
// Forzamos www.shiftia.es + HTTPS para que Google no indexe duplicados.
// Solo activo en producción (Railway, Fly, etc.) — en dev no toca.
const CANONICAL_HOST = process.env.CANONICAL_HOST || 'www.shiftia.es';
const FORCE_HTTPS = process.env.NODE_ENV === 'production';
app.use((req, res, next) => {
  if (!FORCE_HTTPS) return next();
  const proto = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
  const host = req.headers.host || '';
  // Saltamos health checks internos de Railway sin hostname
  if (!host) return next();
  if (proto !== 'https' || host !== CANONICAL_HOST) {
    return res.redirect(301, 'https://' + CANONICAL_HOST + req.originalUrl);
  }
  next();
});

// ====== TIMEZONE BOOKING ======
// Toda la aplicación de booking opera en horario de Madrid (Europe/Madrid).
const BOOKING_TIMEZONE = process.env.BOOKING_TIMEZONE || 'Europe/Madrid';
const BOOKING_MIN_LEAD_HOURS = Number(process.env.BOOKING_MIN_LEAD_HOURS || 4);
const BOOKING_HORIZON_DAYS = Number(process.env.BOOKING_HORIZON_DAYS || 60);
const BOOKING_LUNCH_BLOCK = (process.env.BOOKING_LUNCH_BLOCK || '14:00,14:30,15:00').split(',').map(s => s.trim()).filter(Boolean);
const BOOKING_SLOT_MINUTES = Number(process.env.BOOKING_SLOT_MINUTES || 30); // 30 → :00 y :30; 60 → solo :00
const BOOKING_HOUR_START = Number(process.env.BOOKING_HOUR_START || 9);
const BOOKING_HOUR_END = Number(process.env.BOOKING_HOUR_END || 18);
// Independent secret for HMAC cancel tokens — never fall back to JWT_SECRET so a leak
// of one doesn't compromise the other. In dev we generate an ephemeral secret.
let BOOKING_CANCEL_SECRET = process.env.BOOKING_CANCEL_SECRET;
if (!BOOKING_CANCEL_SECRET) {
  if (IS_PRODUCTION) {
    console.error('FATAL: BOOKING_CANCEL_SECRET env var not set in production — refusing to start.');
    process.exit(1);
  }
  BOOKING_CANCEL_SECRET = 'shiftia-dev-booking-cancel-' + crypto.randomBytes(8).toString('hex');
  console.warn('WARNING: BOOKING_CANCEL_SECRET not set — using ephemeral dev secret.');
}

// Single source of truth for bcrypt cost. OWASP 2024 recommends >=10; we use 12.
const BCRYPT_ROUNDS = Math.max(10, parseInt(process.env.BCRYPT_ROUNDS, 10) || 12);

// ====== APP CONFIG ======
// El dominio raíz (shiftia.es) hace 301 → www.shiftia.es. Los clientes de correo
// NO siguen redirecciones al cargar imágenes (logo) ni queda fino en enlaces, así
// que normalizamos siempre a www para que las imágenes/enlaces resuelvan directos.
const APP_URL = (process.env.APP_URL || 'https://www.shiftia.es').replace(/^https?:\/\/shiftia\.es(?=\/|$)/, 'https://www.shiftia.es');

// ====== THIRD-PARTY ANALYTICS / CHAT (server-side injection) ======
// Snippets are injected into the <head> of every HTML response ONLY if the env
// var is set. Without env vars, the public HTML stays clean — no placeholders,
// no commented-out tracking, no leaks of which vendor we use.
const CRISP_WEBSITE_ID = (process.env.CRISP_WEBSITE_ID || '').trim();
const POSTHOG_API_KEY = (process.env.POSTHOG_API_KEY || '').trim();
const POSTHOG_HOST = (process.env.POSTHOG_HOST || 'https://eu.i.posthog.com').trim();

function buildThirdPartySnippets() {
  let out = '';
  if (CRISP_WEBSITE_ID && /^[a-f0-9-]{20,}$/i.test(CRISP_WEBSITE_ID)) {
    out += `<script>window.$crisp=[];window.CRISP_WEBSITE_ID=${JSON.stringify(CRISP_WEBSITE_ID)};(function(){var d=document,s=d.createElement('script');s.src='https://client.crisp.chat/l.js';s.async=1;d.getElementsByTagName('head')[0].appendChild(s);})();</script>`;
  }
  if (POSTHOG_API_KEY && /^phc_[A-Za-z0-9]{30,}$/.test(POSTHOG_API_KEY)) {
    const cfg = JSON.stringify({ api_host: POSTHOG_HOST, capture_pageview: true, persistence: 'localStorage+cookie' });
    out += `<script>!function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split('.');2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement('script')).type='text/javascript',p.async=!0,p.src=s.api_host+'/static/array.js',(r=t.getElementsByTagName('script')[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a='posthog',u.people=u.people||[],u.toString=function(t){var e='posthog';return'posthog'!==a&&(e+='.'+a),t||(e+=' (stub)'),e},u.people.toString=function(){return u.toString(1)+'.people (stub)'},o='capture identify alias people.set people.set_once set_config register register_once unregister opt_out_capturing has_opted_out_capturing opt_in_capturing reset isFeatureEnabled onFeatureFlags getFeatureFlag getFeatureFlagPayload reloadFeatureFlags group updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures getActiveMatchingSurveys getSurveys getNextSurveyStep onSessionId'.split(' '),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);posthog.init(${JSON.stringify(POSTHOG_API_KEY)},${cfg});</script>`;
  }
  return out;
}
const THIRD_PARTY_SNIPPETS = buildThirdPartySnippets();
const HAS_THIRD_PARTY = THIRD_PARTY_SNIPPETS.length > 0;
if (HAS_THIRD_PARTY) {
  console.log('Third-party widgets enabled:', [CRISP_WEBSITE_ID && 'Crisp', POSTHOG_API_KEY && 'PostHog'].filter(Boolean).join(', '));
}

// Map of pretty routes (without .html) to the file under public/ that serves them.
// Every public HTML page must be listed here to receive the analytics snippets.
const PRETTY_HTML_ROUTES = {
  '/':         'index.html',
  '/login':    'login.html',
  '/dashboard':'dashboard.html',
  '/docs':     'docs.html',
  '/demo':     'demo.html',
  '/sobre-nosotros': 'sobre-nosotros.html',
  '/recursos': 'recursos/index.html',
  '/recursos/descanso-minimo-entre-turnos': 'recursos/descanso-minimo-entre-turnos.html',
  '/recursos/calculadora-equidad-nocturna': 'recursos/calculadora-equidad-nocturna.html',
  '/recursos/excel-vs-software-turnos':     'recursos/excel-vs-software-turnos.html',
  '/recursos/auditoria-cuadrante':          'recursos/auditoria-cuadrante.html',
  '/recursos/plantilla-excel-cuadrante-turnos': 'recursos/plantilla-excel-cuadrante-turnos.html',
};
const PUBLIC_DIR = path.resolve(__dirname, 'public');

// CSP compartida entre el header global y el de las respuestas HTML con nonce.
// Con nonce, los navegadores modernos ignoran 'unsafe-inline' en script-src
// (queda solo como fallback para navegadores antiguos): un XSS inyectado ya no
// puede ejecutar <script> inline porque no conoce el nonce de la respuesta.
// Los handlers inline (onclick=...) se eliminaron de todas las páginas por esto.
function buildCsp(nonce) {
  const noncePart = nonce ? ` 'nonce-${nonce}'` : '';
  return "default-src 'self'; " +
    `script-src 'self'${noncePart} 'unsafe-inline' https://cdnjs.cloudflare.com https://client.crisp.chat https://*.posthog.com; ` +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://client.crisp.chat; " +
    "font-src 'self' https://fonts.gstatic.com https://client.crisp.chat data:; " +
    "img-src 'self' data: https:; " +
    "connect-src 'self' https://client.crisp.chat wss://client.relay.crisp.chat https://*.posthog.com; " +
    "frame-src https://client.crisp.chat; frame-ancestors 'none'; object-src 'none'; " +
    "base-uri 'self'; form-action 'self'; upgrade-insecure-requests";
}

// Sirve un HTML de public/ transformado: snippets de terceros (si los hay) +
// nonce por-respuesta en cada <script> + CSP con ese nonce. Único camino de
// salida para el HTML propio (rutas bonitas, *.html y fallback SPA).
function sendPublicHtml(res, fileName, next) {
  const filePath = path.resolve(PUBLIC_DIR, fileName);
  // Defense-in-depth: ensure the resolved file is inside public/, never escape.
  if (!filePath.startsWith(PUBLIC_DIR + path.sep)) return next ? next() : res.status(404).end();

  fs.promises.readFile(filePath, 'utf8').then((html) => {
    let out = html;
    if (HAS_THIRD_PARTY && out.includes('</head>')) {
      out = out.replace('</head>', THIRD_PARTY_SNIPPETS + '</head>');
    }
    const nonce = crypto.randomBytes(16).toString('base64');
    out = out.replace(/<script(?=[\s>])/g, `<script nonce="${nonce}"`);
    res.setHeader('Content-Security-Policy', buildCsp(nonce));
    res.type('html');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.send(out);
  }).catch((err) => {
    if (next) return next();
    console.error('sendPublicHtml falló:', fileName, err && err.message);
    res.status(500).end();
  });
}

// Mapa inverso: /index.html → /, /recursos/index.html → /recursos, etc.
// Los duplicados *.html de rutas bonitas se redirigen 301 a la canónica
// (Google los veía como "página alternativa" y diluían la indexación).
const HTML_TO_PRETTY = Object.fromEntries(
  Object.entries(PRETTY_HTML_ROUTES).map(([pretty, file]) => ['/' + file, pretty])
);

// Middleware: intercepta rutas bonitas y *.html antes de express.static.
function serveOwnHtml(req, res, next) {
  if (req.method !== 'GET') return next();
  if (req.path.endsWith('.html') && HTML_TO_PRETTY[req.path]) {
    return res.redirect(301, HTML_TO_PRETTY[req.path]);
  }
  let fileName = PRETTY_HTML_ROUTES[req.path];
  if (!fileName) {
    if (!req.path.endsWith('.html')) return next();
    fileName = req.path.replace(/^\//, '');
  }
  sendPublicHtml(res, fileName, next);
}

// ====== SECURITY & PERFORMANCE MIDDLEWARE ======
// Gzip/brotli compression for all responses
app.use(compression());

// Security headers (lightweight helmet alternative — no extra dependency)
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // Clickjacking protection lives in CSP frame-ancestors below; modern browsers
  // ignore X-Frame-Options when both are present, so we drop the duplicate header.
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  // CSP base sin nonce (assets, API). Las respuestas HTML propias la
  // sobreescriben con la variante con nonce en sendPublicHtml().
  res.setHeader('Content-Security-Policy', buildCsp(null));
  // Strict Transport Security (HTTPS only) — 2-year max-age + preload
  if (IS_PRODUCTION) {
    res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  }
  next();
});

app.use(express.json({ limit: '50kb' }));

// HTML propio (rutas bonitas + *.html): snippets de terceros + CSP con nonce.
// DEBE ir antes de express.static para poder transformar la respuesta.
app.use(serveOwnHtml);

// Service worker dinámico: inyecta BUILD_ID en CACHE_NAME para invalidar la
// caché en cada build automáticamente. DEBE ir antes de express.static.
app.get('/sw.js', (req, res, next) => {
  fs.promises.readFile(path.join(PUBLIC_DIR, 'sw.js'), 'utf8')
    .then((js) => {
      res.type('application/javascript');
      // El navegador revalida siempre; y a Cloudflare le decimos explícitamente
      // que NO cachee el SW (CDN-Cache-Control tiene prioridad en su edge).
      res.setHeader('Cache-Control', 'no-cache, must-revalidate');
      res.setHeader('CDN-Cache-Control', 'no-store');
      res.setHeader('Service-Worker-Allowed', '/');
      res.send(js.split('__BUILD__').join(BUILD_ID));
    })
    .catch(() => next());
});

app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: process.env.NODE_ENV === 'production' ? '7d' : 0,
  etag: true,
  lastModified: true,
  dotfiles: 'deny',
  setHeaders: (res, filePath) => {
    // Performance: long-cache (30 días) para assets estáticos críticos de la landing,
    // 5 min para HTML para permitir invalidar copy rápidamente.
    const longCacheAssets = new Set([
      'design-system.css',
      'landing.css', // versionado con ?v= en el <link> de index.html
      'favicon.svg',
      'apple-touch-icon.svg',
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

// Límites explícitos del pool: sin ellos, un pico de tráfico puede agotar las
// conexiones del plan de Postgres o dejar requests colgados indefinidamente.
poolConfig.max = Number(process.env.PG_POOL_MAX || 10);
poolConfig.idleTimeoutMillis = Number(process.env.PG_IDLE_TIMEOUT_MS || 30000);
poolConfig.connectionTimeoutMillis = Number(process.env.PG_CONNECT_TIMEOUT_MS || 10000);
// Corta cualquier query zombi en el servidor antes de que bloquee el pool.
poolConfig.statement_timeout = Number(process.env.PG_STATEMENT_TIMEOUT_MS || 15000);

const pool = new Pool(poolConfig);

// Test database connection — swallow idle errors to keep landing online.
pool.on('error', (err) => {
  if (global.__shiftiaDbReady) {
    console.error('Unexpected error on idle client', err && err.message);
  }
  // Else: DB never came up, ignore noise.
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

    // password_changed_at — usado para invalidar JWTs tras cambio de password
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`).catch(() => {});

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

    // Leads de herramientas gratuitas (calculadoras + auditoría de cuadrante)
    await client.query(`
      CREATE TABLE IF NOT EXISTS tool_leads (
        id SERIAL PRIMARY KEY,
        tool VARCHAR(50) NOT NULL,
        name VARCHAR(255),
        email VARCHAR(255) NOT NULL,
        sector VARCHAR(100),
        workers VARCHAR(50),
        summary TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    await client.query('CREATE INDEX IF NOT EXISTS idx_tool_leads_email ON tool_leads (LOWER(email));').catch(() => {});
    // Columnas de la secuencia de seguimiento (nurture) — idempotente.
    await client.query('ALTER TABLE tool_leads ADD COLUMN IF NOT EXISTS nurture_stage SMALLINT NOT NULL DEFAULT 0;').catch(() => {});
    await client.query('ALTER TABLE tool_leads ADD COLUMN IF NOT EXISTS nurture_last_at TIMESTAMPTZ;').catch(() => {});
    await client.query('ALTER TABLE tool_leads ADD COLUMN IF NOT EXISTS unsubscribed BOOLEAN NOT NULL DEFAULT FALSE;').catch(() => {});
    // Resultado del informe automático (para personalizar el seguimiento).
    await client.query('ALTER TABLE tool_leads ADD COLUMN IF NOT EXISTS audit_score SMALLINT;').catch(() => {});
    await client.query('ALTER TABLE tool_leads ADD COLUMN IF NOT EXISTS audit_meta TEXT;').catch(() => {});
    // Estado interno de la app (p. ej. cuándo se envió el último resumen semanal).
    await client.query('CREATE TABLE IF NOT EXISTS app_state (key TEXT PRIMARY KEY, value TEXT);').catch(() => {});

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

    // Migration: tokens written before the sha256-at-rest change are now unusable
    // (column stores hashes, code looks up by hash). Invalidate any in-flight ones
    // so they don't linger as ghost rows. Safe to run every boot — idempotent.
    await client.query(
      "UPDATE password_reset_tokens SET used = true WHERE used = false AND length(token) = 64 AND token ~ '^[0-9a-f]+$' AND created_at < NOW() - INTERVAL '1 hour'"
    ).catch(() => {});

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
      { name: 'user_agent',      type: 'VARCHAR(255)' },
      { name: 'reminder_24h_at', type: 'TIMESTAMPTZ' },
      { name: 'reminder_1h_at',  type: 'TIMESTAMPTZ' }
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
      const hashedPassword = await bcrypt.hash(adminPassword, BCRYPT_ROUNDS);
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
    // DB init is NON-FATAL. Landing pública sigue viva aunque no haya Postgres.
    // Endpoints que necesiten DB devolverán 503 vía requireDB middleware.
    global.__shiftiaDbReady = false;
    console.warn('Database unavailable — running in degraded mode (landing only).');
    console.warn('  message :', err && err.message);
    console.warn('  code    :', err && err.code);
    console.warn('  DATABASE_URL set:', !!process.env.DATABASE_URL);
    console.warn('  PGHOST set      :', !!process.env.PGHOST);
    console.warn('Para activar back-office, provisiona Postgres en Railway y define DATABASE_URL.');
    return;
  }
  global.__shiftiaDbReady = true;
}

// Middleware: blocks DB-dependent endpoints when DB is offline.
function requireDB(req, res, next) {
  if (global.__shiftiaDbReady) return next();
  return res.status(503).json({
    error: 'Servicio no disponible temporalmente',
    detail: 'La base de datos no está conectada. Contacta con el administrador.'
  });
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
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    // Invalida tokens emitidos antes del último cambio de password.
    // Migración suave: tokens viejos sin `pca` se aceptan hasta su expiración natural.
    if (typeof decoded.pca === 'number' && typeof decoded.iat === 'number' && decoded.iat < decoded.pca) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
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

// PII-safe log identifier: short stable hash of the email — enough to correlate
// log lines for one user without leaking the address into Railway logs.
function emailTag(email) {
  if (!email) return '<no-email>';
  return 'u:' + crypto.createHash('sha256').update(String(email).toLowerCase()).digest('hex').slice(0, 8);
}

// ====== EMAIL CONFIG ======
// Tanto GMAIL_USER como GMAIL_APP_PASSWORD deben venir SIEMPRE de env vars.
// Si falta GMAIL_USER, el SMTP queda deshabilitado (Resend se usa como provider primario).
const GMAIL_USER = process.env.GMAIL_USER || '';
const GMAIL_PASS = process.env.GMAIL_APP_PASSWORD || '';
// Buzón de empresa al que llegan TODAS las notificaciones internas (llamadas
// agendadas, solicitudes de demo, contacto, cancelaciones) y al que responden
// los clientes (reply-to). info@shiftia.es ya está activo.
// Se puede sobreescribir con SUPPORT_EMAIL en el entorno si hiciera falta.
const NOTIFY_EMAIL = process.env.SUPPORT_EMAIL || 'info@shiftia.es';

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
// Remitente para AVISOS INTERNOS (a info@shiftia.es).
// IMPORTANTE: debe salir del DOMINIO VERIFICADO en Resend (shiftia.es). NO usar
// onboarding@resend.dev: Resend solo permite enviar desde esa dirección a tu
// propio email de cuenta, y rechaza el envío a info@shiftia.es.
// Con DMARC + DKIM ya configurados, hola@shiftia.es entrega bien a info@.
const INTERNAL_RESEND_FROM = process.env.INTERNAL_RESEND_FROM || RESEND_FROM;
// Logo incrustado (CID) en todos los emails: se ve aunque el cliente bloquee
// imágenes remotas (Apple Mail privacy, Gmail, etc.). Se referencia como cid:shiftialogo.
let LOGO_BUF = null;
try { LOGO_BUF = fs.readFileSync(path.join(__dirname, 'public', 'email-logo.png')); }
catch (e) { console.warn('email-logo.png no encontrado para inline:', e.message); }

// Safe send helper — uses Resend API or Gmail SMTP
function sendMail(options) {
  if (RESEND_KEY) {
    // Resend free tier: MUST use onboarding@resend.dev (or your verified domain)
    // Extract display name from original "from" for friendlier emails
    const displayMatch = (options.from || '').match(/^"?([^"<]+)"?\s*</);
    const displayName = displayMatch ? displayMatch[1].trim() : 'Shiftia';
    // resendFrom: remitente explícito para casos que deben NO salir de @shiftia.es
    // (avisos internos a info@: si salieran de @shiftia.es, M365 los pone en
    // cuarentena por "suplantación del propio dominio").
    const fromAddr = options.resendFrom
      ? options.resendFrom
      : (RESEND_FROM.includes('<') ? RESEND_FROM : `${displayName} <${RESEND_FROM}>`);

    const payload = {
      from: fromAddr,
      to: Array.isArray(options.to) ? options.to : [options.to],
      subject: options.subject,
      html: options.html,
      reply_to: options.replyTo || NOTIFY_EMAIL
    };
    // Adjuntos (logo inline + .ics) — Resend los acepta en base64.
    const resAtts = [];
    if (LOGO_BUF) resAtts.push({ filename: 'shiftia-logo.png', content: LOGO_BUF.toString('base64'), content_type: 'image/png', content_id: 'shiftialogo' });
    if (options.attachments && options.attachments.length) {
      options.attachments.forEach(a => resAtts.push({ filename: a.filename, content: Buffer.from(a.content).toString('base64') }));
    }
    if (resAtts.length) payload.attachments = resAtts;

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
    // OJO: sendMail PROPAGA los fallos (antes se tragaban aquí y un email
    // perdido era invisible: el recordatorio se marcaba como enviado y el
    // email_status='failed' del booking no se activaba nunca). Todo call
    // site fire-and-forget debe llevar su propio .catch con log.
    .catch(err => { console.error('Resend failed:', err.message); throw err; });
  }

  if (transporter && emailReady) {
    if (LOGO_BUF) {
      options.attachments = (options.attachments || []).concat([{ filename: 'shiftia-logo.png', content: LOGO_BUF, cid: 'shiftialogo' }]);
    }
    return transporter.sendMail(options)
      .then(info => { console.log('Email sent (SMTP):', options.subject); return info; })
      .catch(err => { console.error('SMTP error:', err.message); throw err; });
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
          <td class="sh-pad" align="center" style="padding:0 40px 30px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
              <tr>
                <td style="vertical-align:middle;line-height:1;padding-right:12px;">
                  <img src="cid:shiftialogo" width="50" height="50" alt="Shiftia" style="display:block;border-radius:12px;width:50px;height:50px;">
                </td>
                <td style="vertical-align:middle;font-family:'Instrument Serif','Times New Roman',Georgia,serif;font-size:30px;font-weight:400;letter-spacing:-0.01em;line-height:1;">
                  <span style="color:#0e0f0f;">Shift</span><span style="color:#0f7a6d;">ia</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Card -->
        <tr>
          <td class="sh-pad" style="padding:0 40px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#ffffff;border:1px solid #ece9e2;border-radius:14px;overflow:hidden;">
              <tr>
                <td bgcolor="#2980b9" height="4" style="height:4px;font-size:0;line-height:0;background:linear-gradient(90deg,#4ecdc4 0%,#2980b9 100%);">&nbsp;</td>
              </tr>
              <tr>
                <td class="sh-pad" style="padding:38px 40px 36px;">
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
              Shiftia &middot; Planificación inteligente de turnos y cuadrantes.<br>
              Asturias, España &middot; <a href="mailto:info@shiftia.es" style="color:#7a766f;text-decoration:underline;">info@shiftia.es</a>
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

// ====== RATE LIMITING (express-rate-limit) ======
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes, intenta de nuevo más tarde' }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // stricter limit for auth endpoints
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Espera un momento antes de reintentar.' }
});

// Contact/booking forms are spam magnets — much stricter than apiLimiter.
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes. Intenta de nuevo en unos minutos.' }
});

// ====== AUTHENTICATION ROUTES ======

// POST /api/auth/register
app.post('/api/auth/register', authLimiter, async (req, res) => {
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

    // Anti-enumeration: respond with a uniform 200 + generic message whether the
    // email exists or not, and burn bcrypt cycles either way to flatten timing.
    // Front-end relies on `data.token` to decide auto-login; absence of a token
    // shows the generic message and leaves the form in place.
    const existingUser = await pool.query('SELECT id FROM users WHERE LOWER(email) = $1', [email]);
    if (existingUser.rows.length > 0) {
      // Constant-time work to match the happy-path latency (one bcrypt hash).
      await bcrypt.hash(password, BCRYPT_ROUNDS).catch(() => {});
      return res.status(200).json({
        message: 'Si los datos son correctos, podrás acceder con tu cuenta.'
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // Insert user
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, name, company, plan, plan_status, workers_limit)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, email, name, company, plan, plan_status, workers_limit, created_at, password_changed_at`,
      [email, passwordHash, name, company || null, 'trial', 'active', 25]
    );

    const user = result.rows[0];

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email, pca: Math.floor(new Date(user.password_changed_at).getTime() / 1000) },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Don't expose password_changed_at to clients
    const { password_changed_at, ...userPublic } = user;
    res.status(201).json({ token, user: userPublic });

    // Fire-and-forget welcome email (don't block response)
    const esc = bookingLib.escHtml;
    sendMail({
      from: `"Shiftia" <${GMAIL_USER}>`,
      replyTo: NOTIFY_EMAIL,
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
app.post('/api/auth/login', authLimiter, async (req, res) => {
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
      return res.status(401).json({ error: 'Email o contraseña incorrectos' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email, pca: Math.floor(new Date(user.password_changed_at).getTime() / 1000) },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Return user without password_hash or password_changed_at
    const { password_hash, password_changed_at, ...userWithoutPassword } = user;

    res.json({ token, user: userWithoutPassword });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: 'Login failed' });
  }
});

// POST /api/auth/forgot-password
app.post('/api/auth/forgot-password', authLimiter, async (req, res) => {
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

      // Generate reset token. The plaintext goes in the email; only the sha256
      // digest is stored in DB. A DB leak no longer yields working reset tokens.
      // sha256 (not bcrypt) is used because 32 random bytes already have full
      // entropy and we need exact-match lookup on the hash column.
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

      // A2: Invalidate any previous unused tokens for this user before issuing a new one
      await pool.query("UPDATE password_reset_tokens SET used = true WHERE user_id = $1 AND used = false", [user.id]);

      // Store ONLY the hash; the plaintext token never persists.
      await pool.query(
        'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
        [user.id, resetTokenHash, expiresAt]
      );

      // Send email with reset link
      const resetLink = `${APP_URL}/reset-password?token=${resetToken}`;
      const esc = bookingLib.escHtml;

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
app.post('/api/auth/reset-password', authLimiter, async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ error: 'Token and password are required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
    }

    // Look up by sha256(plaintext) — the DB never holds the usable token.
    const tokenHash = crypto.createHash('sha256').update(String(token)).digest('hex');
    const tokenResult = await pool.query(
      'SELECT id, user_id FROM password_reset_tokens WHERE token = $1 AND used = false AND expires_at > NOW()',
      [tokenHash]
    );

    if (tokenResult.rows.length === 0) {
      return res.status(400).json({ error: 'El enlace de restablecimiento es inválido o ha expirado' });
    }

    const { id: tokenId, user_id: userId } = tokenResult.rows[0];

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // Update user's password
    await pool.query('UPDATE users SET password_hash = $1, password_changed_at = NOW() WHERE id = $2', [hashedPassword, userId]);

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
      'SELECT id, email, name, company, plan, plan_status, workers_limit, next_billing_date, billing_cycle, created_at, updated_at FROM users WHERE id = $1',
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
      const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
      updates.push(`password_hash = $${paramCount}`);
      values.push(passwordHash);
      paramCount++;
      updates.push(`password_changed_at = NOW()`);
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
    const esc = bookingLib.escHtml;

    // Save ticket to database (primary)
    try {
      await pool.query(
        'INSERT INTO support_tickets (user_id, category, subject, message) VALUES ($1, $2, $3, $4)',
        [req.user.id, cat, subject, message]
      );
    } catch (dbErr) {
      // La tabla se crea en initializeDatabase; si el INSERT falla es un problema
      // real de esquema/conexión que hay que ver en logs, no parchear al vuelo
      // (el CREATE TABLE de emergencia enmascaraba divergencias de esquema).
      console.error('DB insert ticket failed (continuing, email igual sale):', dbErr.message);
    }

    console.log(`Support ticket from ${emailTag(user.email)} [${cat}] (${subject.length} chars)`);
    res.json({ ok: true });

    // Fire-and-forget email (don't block response)
    sendMail({
          from: `"Shiftia Support" <${GMAIL_USER}>`,
          to: NOTIFY_EMAIL,
          resendFrom: INTERNAL_RESEND_FROM,
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
    }).catch(err => console.error('Email fire-and-forget falló:', err && err.message));
  } catch (err) {
    console.error('Support ticket error:', err.message);
    res.status(500).json({ error: 'Error sending support request' });
  }
});

// ====== CONTACT FORM API ======
app.post('/api/contact', contactLimiter, async (req, res) => {
  try {
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
    const esc = bookingLib.escHtml;
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
      // La tabla se crea en initializeDatabase; ver comentario en support_tickets.
      console.error('DB insert lead failed (continuing, email igual sale):', dbErr.message);
    }

    console.log(`Contact lead saved: ${emailTag(email)} company=${company ? 'yes' : 'no'}`);
    res.json({ ok: true });

    // Fire-and-forget emails (don't block response)
    sendMail({
          from: `"Shiftia HUB" <${GMAIL_USER}>`,
          to: NOTIFY_EMAIL,
          resendFrom: INTERNAL_RESEND_FROM,
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
    }).catch(err => console.error('Email fire-and-forget falló:', err && err.message));

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
    }).catch(err => console.error('Email fire-and-forget falló:', err && err.message));

  } catch (err) {
    console.error('Contact form error:', err.message);
    if (!res.headersSent) res.status(500).json({ error: 'Error al enviar. Intentalo de nuevo.' });
  }
});

// ====== CALL BOOKING API (v2 — TIMESTAMPTZ + integridad + .ics + cancel) ======
// Helpers de booking — todos en zona Europe/Madrid.
const ESC_HTML = bookingLib.escHtml;
// `cap` is defined globally in HELPER FUNCTIONS section above.

// Lógica pura de reservas extraída a ./lib/booking.js (testeable en aislamiento,
// ver test/booking.test.js). Aquí quedan wrappers finos con la config del entorno
// para no tocar ningún call site.
const generateDaySlots = () => bookingLib.generateDaySlots({
  hourStart: BOOKING_HOUR_START,
  hourEnd: BOOKING_HOUR_END,
  slotMinutes: BOOKING_SLOT_MINUTES,
  lunchBlock: BOOKING_LUNCH_BLOCK
});
const madridIsoFromLocal = (dateStr, timeStr) => bookingLib.madridIsoFromLocal(dateStr, timeStr, BOOKING_TIMEZONE);
const prettyDateMadrid = (d) => bookingLib.prettyDateMadrid(d, BOOKING_TIMEZONE);
const prettyTimeMadrid = (d) => bookingLib.prettyTimeMadrid(d, BOOKING_TIMEZONE);
const makeCancelToken = (bookingId, email) => bookingLib.makeCancelToken(bookingId, email, BOOKING_CANCEL_SECRET);
const verifyCancelToken = (bookingId, email, token) => bookingLib.verifyCancelToken(bookingId, email, token, BOOKING_CANCEL_SECRET);
const buildIcs = bookingLib.buildIcs;

// ====== HERRAMIENTAS GRATUITAS — captura de leads ======
// 1) "Envíame este análisis por email" desde las calculadoras de /recursos.
//    El cliente manda un resumen en texto plano (≤2000 chars) que nosotros
//    escapamos y envolvemos en la plantilla de marca. Guarda lead en tool_leads.
const TOOL_NAMES = {
  equidad: 'Calculadora de equidad nocturna',
  descanso: 'Calculadora de descanso entre turnos'
};

app.post('/api/tools/email-results', contactLimiter, async (req, res) => {
  try {
    const { tool, email, summary, website } = req.body || {};
    if (website) return res.json({ ok: true }); // honeypot anti-bot
    if (!TOOL_NAMES[tool]) return res.status(400).json({ error: 'Herramienta desconocida' });
    if (!email || !isValidEmail(email) || String(email).length > 255) {
      return res.status(400).json({ error: 'Email no válido' });
    }
    const cleanSummary = cap(summary, 2000).trim();
    if (!cleanSummary) return res.status(400).json({ error: 'No hay resultados que enviar' });

    if (global.__shiftiaDbReady) {
      pool.query('INSERT INTO tool_leads (tool, email, summary) VALUES ($1, $2, $3)', [tool, email, cleanSummary])
        .catch(err => console.error('tool_leads insert falló:', err.message));
    }
    res.json({ ok: true });

    const esc = bookingLib.escHtml;
    const summaryHtml = cleanSummary.split('\n').filter(Boolean).map(l =>
      `<p style="margin:0 0 8px;color:#1a1a1a;font-size:15px;line-height:1.55;">${esc(l)}</p>`
    ).join('');
    sendMail({
      from: `"Shiftia" <${GMAIL_USER}>`,
      replyTo: NOTIFY_EMAIL,
      to: email,
      subject: `Tu análisis — ${TOOL_NAMES[tool]} · Shiftia`,
      html: emailTemplate({
        preheader: 'El análisis que generaste en shiftia.es, guardado en tu correo',
        headline: 'Tu análisis, guardado',
        body: `
          <p style="margin:0 0 18px;">Aquí tienes el resultado que generaste con la ${esc(TOOL_NAMES[tool].toLowerCase())} de Shiftia:</p>
          <div style="background:#faf9f6;padding:20px;border-radius:10px;border:1px solid #ece9e2;margin-bottom:22px;">${summaryHtml}</div>
          <p style="margin:0 0 8px;color:#1a1a1a;line-height:1.6;font-size:15px;">Si quieres que esto se calcule solo cada mes — con tu plantilla, tu convenio y tus reglas — te lo enseñamos en una llamada de 15 minutos.</p>
          <p style="margin:16px 0 0;"><a href="${APP_URL}/#contact" style="display:inline-block;background:#0e0f0f;color:#faf9f6;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:600;">Agendar llamada gratuita</a></p>
        `
      })
    }).catch(err => console.error('Email de herramienta falló:', err && err.message));
  } catch (err) {
    console.error('email-results error:', err.message);
    if (!res.headersSent) res.status(500).json({ error: 'Error interno' });
  }
});

// 1b) Plantilla Excel de cuadrante: lead magnet — se envía el .xlsx por email.
// El .xlsx vive FUERA de public/ a propósito: la puerta es el email.
const PLANTILLA_PATH = path.join(__dirname, 'assets', 'downloads', 'plantilla-cuadrante-turnos-shiftia.xlsx');
let __plantillaBuf = null;
function plantillaBuffer() {
  if (!__plantillaBuf) __plantillaBuf = fs.readFileSync(PLANTILLA_PATH);
  return __plantillaBuf;
}

app.post('/api/tools/plantilla', contactLimiter, async (req, res) => {
  try {
    const { name, email, website } = req.body || {};
    if (website) return res.json({ ok: true }); // honeypot
    const cleanName = cap(name, 255).trim();
    if (!cleanName) return res.status(400).json({ error: 'Falta el nombre' });
    if (!email || !isValidEmail(email) || String(email).length > 255) {
      return res.status(400).json({ error: 'Email no válido' });
    }

    if (global.__shiftiaDbReady) {
      pool.query('INSERT INTO tool_leads (tool, name, email) VALUES ($1, $2, $3)', ['plantilla', cleanName, email])
        .catch(err => console.error('tool_leads (plantilla) insert falló:', err.message));
    }
    res.json({ ok: true });

    const esc = bookingLib.escHtml;
    const first = esc(cleanName.split(' ')[0]);
    sendMail({
      from: `"Shiftia" <${GMAIL_USER}>`,
      replyTo: NOTIFY_EMAIL,
      to: email,
      subject: 'Tu plantilla de cuadrante de turnos · Shiftia',
      attachments: [{ filename: 'plantilla-cuadrante-turnos-shiftia.xlsx', content: plantillaBuffer() }],
      html: emailTemplate({
        preheader: 'La plantilla va adjunta — con recuentos automáticos y avisos de cobertura.',
        headline: 'Tu plantilla, adjunta',
        body: `
          <p style="margin:0 0 16px;color:#1a1a1a;line-height:1.65;font-size:15px;">Hola ${first}, aquí tienes la plantilla de cuadrante mensual (va adjunta en este correo). Tres cosas para sacarle partido en dos minutos:</p>
          <ul style="margin:0 0 16px;padding-left:20px;">
            <li style="margin:0 0 8px;color:#1a1a1a;line-height:1.6;font-size:15px;">Pon el <strong>año y el mes</strong> arriba a la izquierda: fechas y findes se recolocan solos.</li>
            <li style="margin:0 0 8px;color:#1a1a1a;line-height:1.6;font-size:15px;">Rellena los turnos con <strong>M, T, N, L, V o B</strong> — las noches se sombrean y los recuentos por persona se actualizan.</li>
            <li style="margin:0 0 8px;color:#1a1a1a;line-height:1.6;font-size:15px;">Ajusta la fila <strong>"Mínimo por turno"</strong>: la cobertura se pone en rojo el día que no llegas.</li>
          </ul>
          <p style="margin:0 0 16px;color:#1a1a1a;line-height:1.65;font-size:15px;">Un aviso honesto: la plantilla cuenta, pero no vigila los descansos legales (12 h entre turnos, 36 h semanales) ni la equidad del reparto. Si quieres ese análisis de tu cuadrante real, la auditoría gratuita te lo devuelve en PDF en minutos.</p>
          <p style="margin:16px 0 0;"><a href="${APP_URL}/recursos/auditoria-cuadrante?utm_source=plantilla_email" style="display:inline-block;background:#0e0f0f;color:#faf9f6;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:600;">Auditar mi cuadrante gratis</a></p>
        `
      })
    }).catch(err => console.error('Email de plantilla falló:', err && err.message));

    // Aviso interno ligero
    sendMail({
      from: `"Shiftia Leads" <${GMAIL_USER}>`,
      to: NOTIFY_EMAIL,
      resendFrom: INTERNAL_RESEND_FROM,
      replyTo: email,
      subject: `[Plantilla] ${esc(cleanName)} · ${esc(email)}`,
      html: emailTemplate({
        preheader: 'Nuevo lead de la plantilla Excel',
        headline: 'Lead: plantilla Excel',
        body: `<p style="margin:0;color:#1a1a1a;font-size:14px;">${esc(cleanName)} — <a href="mailto:${esc(email)}" style="color:#0f7a6d;">${esc(email)}</a> ha pedido la plantilla de cuadrante. Entra en la secuencia de seguimiento automática.</p>${nurtureStopFooter(email)}`
      })
    }).catch(() => {});
  } catch (err) {
    console.error('plantilla error:', err.message);
    if (!res.headersSent) res.status(500).json({ error: 'Error interno' });
  }
});

// 1c) Baja de la secuencia de nurture con token HMAC — un clic desde el
//     correo, sin login. OJO: debe registrarse ANTES del catch-all /api 404.
app.get('/api/nurture/unsubscribe', async (req, res) => {
  const email = (() => { try { return Buffer.from(String(req.query.e || ''), 'base64url').toString('utf8'); } catch (e) { return ''; } })();
  const page = (title, text) =>
    `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>${title} · Shiftia</title></head>` +
    `<body style="margin:0;background:#faf9f6;font-family:Georgia,serif;color:#0e0f0f;"><div style="max-width:480px;margin:18vh auto 0;padding:0 24px;text-align:center;">` +
    `<p style="font-style:italic;font-size:28px;margin:0 0 12px;">Shiftia</p><h1 style="font-weight:400;font-size:22px;margin:0 0 10px;">${title}</h1>` +
    `<p style="font-family:system-ui,sans-serif;font-size:15px;color:#4a4a47;line-height:1.6;">${text}</p></div></body></html>`;
  if (!email || !isValidEmail(email) || !nurture.verifyUnsubToken(email, req.query.t, JWT_SECRET)) {
    return res.status(400).type('html').send(page('Enlace no válido', 'El enlace de baja no es válido o está incompleto. Escríbenos a info@shiftia.es y te damos de baja a mano.'));
  }
  try {
    if (global.__shiftiaDbReady) {
      await pool.query('UPDATE tool_leads SET unsubscribed=TRUE WHERE LOWER(email)=LOWER($1)', [email]);
    }
    if (req.query.via === 'interno') {
      return res.type('html').send(page('Seguimiento detenido', `Este lead (${bookingLib.escHtml(email)}) ya no recibirá más correos automáticos de la secuencia.`));
    }
    res.type('html').send(page('Baja confirmada', 'No te enviaremos más correos de seguimiento. Las herramientas gratuitas siguen a tu disposición cuando quieras.'));
  } catch (e) {
    res.status(500).type('html').send(page('Algo falló', 'No hemos podido procesar la baja. Escríbenos a info@shiftia.es y lo hacemos a mano.'));
  }
});

// 2) Auditoría gratuita de cuadrante: formulario con archivo adjunto (PDF/Excel/foto).
//    v1 manual: el cuadrante llega a info@ con los datos del lead y respondemos a mano.
const auditUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => cb(null, /\.(pdf|xlsx?|csv|png|jpe?g)$/i.test(file.originalname || ''))
});

// --- Informe de auditoría automática (IA lee el documento; los números
//     salen SOLO de lib/audit.js, matemática determinista y testeada) ---
function buildAuditReportBody({ metrics, summary, firstName }) {
  const esc = bookingLib.escHtml;
  const m = metrics;
  const verdictLabel = { justo: 'Justo', mejorable: 'Mejorable', critico: 'Crítico' }[m.nights.verdict] || m.nights.verdict;
  const verdictColor = { justo: '#0a5950', mejorable: '#8a6220', critico: '#a31c22' }[m.nights.verdict] || '#0e0f0f';

  const summaryHtml = String(summary || '').split(/\n\s*\n/).filter(Boolean)
    .map(p => `<p style="margin:0 0 14px;color:#1a1a1a;line-height:1.65;font-size:15px;">${esc(p)}</p>`).join('');

  const nightsRows = m.nights.per_worker.slice(0, 14).map(x =>
    `<tr><td style="padding:8px 0;font-size:14px;color:#1a1a1a;border-bottom:1px solid #ece9e2;">${esc(x.name)}${m.nights.overloaded.includes(x.name) ? ' <span style="color:#a31c22;font-size:11px;font-weight:700;">▲ sobrecarga</span>' : ''}</td><td style="padding:8px 0;font-size:14px;color:#0e0f0f;text-align:right;border-bottom:1px solid #ece9e2;font-variant-numeric:tabular-nums;">${x.nights}</td></tr>`
  ).join('');

  const violationsRows = m.rest_violations.slice(0, 12).map(v =>
    `<tr><td style="padding:8px 0;font-size:13px;color:#1a1a1a;border-bottom:1px solid #ece9e2;">${esc(v.worker)}</td><td style="padding:8px 0;font-size:13px;color:#4a4a47;border-bottom:1px solid #ece9e2;">${esc(v.from)} → ${esc(v.to)}</td><td style="padding:8px 0;font-size:13px;color:#a31c22;text-align:right;border-bottom:1px solid #ece9e2;font-variant-numeric:tabular-nums;">${String(v.rest_hours).replace('.', ',')} h</td></tr>`
  ).join('');

  const streaksHtml = m.night_streaks.slice(0, 8).map(s =>
    `<li style="margin:0 0 6px;color:#1a1a1a;font-size:14px;">${esc(s.worker)}: <strong>${s.length} noches seguidas</strong> (hasta ${esc(s.end_date)})</li>`
  ).join('');

  const scoreColor = m.score >= 85 ? '#0a5950' : (m.score >= 65 ? '#8a6220' : '#a31c22');
  return `
    <p style="margin:0 0 20px;color:#1a1a1a;line-height:1.6;font-size:15px;">Hola ${esc(firstName)}, tu diagnóstico está listo (${m.workers_count} personas · ${m.total_shifts} turnos analizados). <strong>El informe completo va adjunto en PDF</strong> — esto es el resumen.</p>
    <div style="margin:24px 0;padding:28px 24px;background:#faf9f6;border-radius:12px;border:1px solid #ece9e2;text-align:center;">
      <p style="margin:0;font-size:12px;color:#7a766f;text-transform:uppercase;letter-spacing:0.08em;">Puntuación de tu cuadrante</p>
      <p style="margin:14px 0 4px;font-size:44px;color:${scoreColor};font-family:'Instrument Serif','Times New Roman',Georgia,serif;line-height:1;font-style:italic;">${m.score}<span style="font-size:20px;color:#9a958c;font-style:normal;">/100</span></p>
      <p style="margin:0;font-size:15px;color:#0e0f0f;font-family:'Instrument Serif','Times New Roman',Georgia,serif;">${esc(m.score_label)}</p>
      <p style="margin:14px 0 0;font-size:12px;color:#9a958c;">Equidad nocturna: <strong style="color:${verdictColor};">${verdictLabel}</strong> &nbsp;·&nbsp; Descansos &lt;12 h: <strong style="color:${m.rest_violations.length ? '#a31c22' : '#0a5950'};">${m.rest_violations.length}</strong> &nbsp;·&nbsp; Rachas ≥3 noches: <strong style="color:${m.night_streaks.length ? '#8a6220' : '#0a5950'};">${m.night_streaks.length}</strong></p>
      <p style="margin:8px 0 0;font-size:12px;color:#9a958c;">Sin descanso semanal 36 h: <strong style="color:${m.weekly_rest_issues.length ? '#a31c22' : '#0a5950'};">${m.weekly_rest_issues.length}</strong> &nbsp;·&nbsp; Tramos ≥7 días seguidos: <strong style="color:${m.consecutive_work_runs.length ? '#8a6220' : '#0a5950'};">${m.consecutive_work_runs.length}</strong> &nbsp;·&nbsp; ${m.coverage.source === 'minimos_declarados'
        ? `Días bajo tu mínimo: <strong style="color:${m.coverage.below_minimum.length ? '#a31c22' : '#0a5950'};">${m.coverage.below_minimum.length}</strong>`
        : `Huecos de cobertura: <strong style="color:${m.coverage.empty_slots.length ? '#8a6220' : '#0a5950'};">${m.coverage.evaluated ? m.coverage.empty_slots.length : '—'}</strong>`} &nbsp;·&nbsp; Rotaciones antihorarias: <strong style="color:${m.backward_rotations.total ? '#8a6220' : '#0a5950'};">${m.backward_rotations.total}</strong></p>
    </div>
    ${summaryHtml}
    <p style="margin:22px 0 8px;font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#7a766f;">Reparto de noches</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #ece9e2;">${nightsRows}</table>
    ${m.rest_violations.length ? `
      <p style="margin:22px 0 8px;font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#7a766f;">Descansos por debajo de 12 h (art. 34.3 ET)</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #ece9e2;">${violationsRows}</table>
      ${m.rest_violations.length > 12 ? `<p style="margin:8px 0 0;font-size:12px;color:#7a766f;">…y ${m.rest_violations.length - 12} más.</p>` : ''}` : ''}
    ${m.night_streaks.length ? `
      <p style="margin:22px 0 8px;font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#7a766f;">Rachas de noches</p>
      <ul style="margin:0;padding-left:18px;">${streaksHtml}</ul>` : ''}
    <p style="margin:24px 0 0;color:#1a1a1a;line-height:1.6;font-size:15px;">Si quieres que esto no vuelva a pasar — la IA de Shiftia genera el cuadrante respetando descansos, equidad y tu convenio — te lo enseñamos con tus datos en una llamada de 15 minutos.</p>
    <p style="margin:16px 0 0;"><a href="${APP_URL}/#contact" style="display:inline-block;background:#0e0f0f;color:#faf9f6;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:600;">Agendar llamada gratuita</a></p>
    <p style="margin:22px 0 0;color:#9a958c;font-size:12px;line-height:1.6;">Supuestos del cálculo: descanso mínimo ${m.assumptions.min_rest_hours} h entre fin e inicio de turno; horarios ${bookingLib.escHtml(m.assumptions.assumed_defs || m.assumptions.shift_definitions.join(', '))}. Los números salen de un cálculo automático verificado — la IA solo lee el documento, no calcula. Tu cuadrante se elimina tras el análisis. Este diagnóstico es informativo y no constituye asesoramiento legal.</p>
  `;
}

function sendManualAuditEmails({ cleanName, email, cleanSector, cleanWorkers, cleanMessage, file, statusNote }) {
  const esc = bookingLib.escHtml;
  const atts = [];
  if (file) atts.push({ filename: cap(file.originalname, 120) || 'cuadrante', content: file.buffer });

  sendMail({
    from: `"Shiftia Auditoría" <${GMAIL_USER}>`,
    to: NOTIFY_EMAIL,
    resendFrom: INTERNAL_RESEND_FROM,
    replyTo: email,
    subject: `[Auditoría de cuadrante] ${esc(cleanName)}${cleanSector ? ' · ' + esc(cleanSector) : ''}${cleanWorkers ? ' · ' + esc(cleanWorkers) + ' trab.' : ''}`,
    attachments: atts,
    html: emailTemplate({
      preheader: `Nueva auditoría solicitada por ${esc(cleanName)}`,
      headline: 'Nueva auditoría de cuadrante',
      body: `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #ece9e2;">
          <tr><td style="padding:12px 0;color:#7a766f;font-size:13px;width:130px;border-bottom:1px solid #ece9e2;">Nombre</td><td style="padding:12px 0;color:#1a1a1a;font-size:14px;border-bottom:1px solid #ece9e2;">${esc(cleanName)}</td></tr>
          <tr><td style="padding:12px 0;color:#7a766f;font-size:13px;border-bottom:1px solid #ece9e2;">Email</td><td style="padding:12px 0;font-size:14px;border-bottom:1px solid #ece9e2;"><a href="mailto:${esc(email)}" style="color:#0f7a6d;">${esc(email)}</a></td></tr>
          ${cleanSector ? `<tr><td style="padding:12px 0;color:#7a766f;font-size:13px;border-bottom:1px solid #ece9e2;">Sector</td><td style="padding:12px 0;color:#1a1a1a;font-size:14px;border-bottom:1px solid #ece9e2;">${esc(cleanSector)}</td></tr>` : ''}
          ${cleanWorkers ? `<tr><td style="padding:12px 0;color:#7a766f;font-size:13px;border-bottom:1px solid #ece9e2;">Trabajadores</td><td style="padding:12px 0;color:#1a1a1a;font-size:14px;border-bottom:1px solid #ece9e2;">${esc(cleanWorkers)}</td></tr>` : ''}
          <tr><td style="padding:12px 0;color:#7a766f;font-size:13px;">Cuadrante</td><td style="padding:12px 0;color:#1a1a1a;font-size:14px;">${file ? esc(file.originalname) + ' (adjunto)' : 'sin archivo — pedirlo por email'}</td></tr>
        </table>
        ${cleanMessage ? `<div style="margin-top:20px;padding:20px;background:#faf9f6;border-radius:10px;border:1px solid #ece9e2;"><p style="color:#7a766f;font-size:12px;text-transform:uppercase;letter-spacing:0.06em;margin:0 0 10px;">Contexto</p><p style="color:#1a1a1a;line-height:1.6;margin:0;font-size:15px;">${esc(cleanMessage)}</p></div>` : ''}
        <p style="color:#9a958c;font-size:12px;margin:20px 0 0;">${esc(statusNote || 'Requiere análisis manual.')} Compromiso público: diagnóstico en 24-48 h laborables. Responde directamente a este correo (reply-to = cliente).</p>
        ${nurtureStopFooter(email)}
      `
    })
  }).catch(err => console.error('Aviso interno de auditoría falló:', err && err.message));

  sendMail({
    from: `"Shiftia" <${GMAIL_USER}>`,
    replyTo: NOTIFY_EMAIL,
    to: email,
    subject: 'Recibido — tu cuadrante está en cola de auditoría · Shiftia',
    html: emailTemplate({
      preheader: 'Te enviaremos el diagnóstico en 24-48 h laborables',
      headline: `Hola ${esc(cleanName.split(' ')[0])}, lo tenemos`,
      body: `
        <p style="margin:0 0 16px;color:#1a1a1a;line-height:1.6;font-size:15px;">Hemos recibido tu ${file ? 'cuadrante' : 'solicitud'} y ya está en cola de auditoría. En <span style="color:#0e0f0f;font-weight:600;">24-48 h laborables</span> te enviaremos a este correo un diagnóstico con lo que encontremos: equidad del reparto de noches, descansos mínimos y puntos de riesgo.</p>
        ${file ? '' : `<p style="margin:0 0 16px;color:#1a1a1a;line-height:1.6;font-size:15px;">No adjuntaste ningún archivo: responde a este correo con tu cuadrante (PDF, Excel o una foto legible) y lo metemos en cola.</p>`}
        <p style="margin:0;color:#7a766f;font-size:13px;line-height:1.6;">Tu cuadrante solo se usa para este análisis. No lo compartimos con nadie y lo eliminamos al terminar.</p>
      `
    })
  }).catch(err => console.error('Confirmación de auditoría falló:', err && err.message));
}

// Auditoría automática: extracción con IA → validación de confianza →
// métricas deterministas → resumen anclado → informe al cliente + copia interna.
// Cualquier fallo o baja confianza cae al flujo manual sin romper nada.
async function runAutoAudit(lead, file) {
  const esc = bookingLib.escHtml;
  const t0 = Date.now();
  const schedule = await auditAI.extractSchedule(file, { staffingNeeds: lead.staffing_needs });
  if (!schedule) throw Object.assign(new Error('formato no auto-analizable'), { manualReason: 'Formato no auto-analizable (¿Excel?).' });

  const conf = Number(schedule.confidence || 0);
  const workersOk = Array.isArray(schedule.workers) && schedule.workers.length >= 2;
  const shiftsCount = workersOk ? schedule.workers.reduce((a, w) => a + ((w.shifts && w.shifts.length) || 0), 0) : 0;
  if (conf < auditAI.MIN_CONFIDENCE || !workersOk || shiftsCount < 8) {
    throw Object.assign(new Error('extracción de baja confianza'), {
      manualReason: `Extracción IA descartada (confianza ${conf.toFixed(2)}, ${schedule.workers ? schedule.workers.length : 0} personas, ${shiftsCount} turnos). Notas: ${(schedule.notes || []).join(' · ') || 'ninguna'}.`
    });
  }

  // Mínimos por franja: los interpreta la extracción a partir de la
  // descripción libre del formulario cruzada con el cuadrante; el motor
  // determinista es quien audita contra ellos (la IA no calcula nada).
  const staffingMin = schedule.staffing_minimums || null;
  const metrics = analyzeSchedule(schedule, { sector: lead.sector, minimums: staffingMin, expectLeaders: lead.has_leaders });
  const extractionNotes = (schedule.notes || []).concat(staffingMin && staffingMin.notes ? [`Interpretación de necesidades de personal: ${staffingMin.notes}`] : []);
  const summary = await auditAI.writeSummary({ metrics, lead, extractionNotes });
  if (!summary) throw Object.assign(new Error('resumen no disponible'), { manualReason: 'El resumen IA no se generó.' });

  const body = buildAuditReportBody({ metrics, summary, firstName: lead.cleanName.split(' ')[0] });
  const generatedAt = new Intl.DateTimeFormat('es-ES', { dateStyle: 'long', timeStyle: 'short', timeZone: BOOKING_TIMEZONE }).format(new Date()) + ' (hora de Madrid)';
  const pdfBuffer = await buildAuditPdf({ metrics, summary, lead, generatedAt });
  const pdfAttachment = { filename: 'auditoria-cuadrante-shiftia.pdf', content: pdfBuffer };
  const seconds = Math.round((Date.now() - t0) / 1000);

  await sendMail({
    from: `"Shiftia" <${GMAIL_USER}>`,
    replyTo: NOTIFY_EMAIL,
    to: lead.email,
    subject: 'Tu auditoría de cuadrante — informe PDF · Shiftia',
    attachments: [pdfAttachment],
    html: emailTemplate({
      preheader: `Equidad ${metrics.nights.verdict} · ${metrics.rest_violations.length} descansos <12h · ${metrics.night_streaks.length} rachas`,
      headline: 'Tu diagnóstico, listo',
      body
    })
  });

  // Guarda el resultado en el lead: personaliza el seguimiento del día 2.
  const auditMeta = {
    label: metrics.score_label,
    rest: metrics.rest_violations.length,
    streaks: metrics.night_streaks.length,
    below_min: metrics.coverage.below_minimum.length,
    weekly: metrics.weekly_rest_issues.length
  };
  lead.leadIdPromise.then(id => {
    if (!id || !global.__shiftiaDbReady) return;
    return pool.query('UPDATE tool_leads SET audit_score=$2, audit_meta=$3 WHERE id=$1',
      [id, metrics.score, JSON.stringify(auditMeta)]);
  }).catch(err => console.error('Guardar score en lead falló:', err && err.message));

  // Semáforo interno: cuadrante malo + plantilla grande = llamada de hoy.
  const teamSize = metrics.workers_count >= 10 || (parseInt(lead.workers, 10) || 0) >= 10;
  const hot = metrics.score < 65 && teamSize;

  // Copia interna con el informe + el archivo original.
  sendMail({
    from: `"Shiftia Auditoría" <${GMAIL_USER}>`,
    to: NOTIFY_EMAIL,
    resendFrom: INTERNAL_RESEND_FROM,
    replyTo: lead.email,
    subject: `${hot ? '🔥 ' : ''}[Auditoría AUTO ✓] ${esc(lead.cleanName)} · ${metrics.score}/100 · ${metrics.rest_violations.length} descansos · ${seconds}s`,
    attachments: [pdfAttachment].concat(file ? [{ filename: cap(file.originalname, 120) || 'cuadrante', content: file.buffer }] : []),
    html: emailTemplate({
      preheader: `Informe automático enviado a ${esc(lead.email)}`,
      headline: hot ? 'Lead caliente: informe enviado' : 'Informe automático enviado',
      body: `<p style="margin:0 0 16px;color:#1a1a1a;font-size:14px;">Enviado a <a href="mailto:${esc(lead.email)}" style="color:#0f7a6d;">${esc(lead.email)}</a> en ${seconds}s (modelo ${esc(auditAI.MODEL)}, confianza ${conf.toFixed(2)}).${hot ? ' <strong>Cuadrante con problemas serios y equipo grande — merece llamada hoy.</strong>' : ''} Copia del informe:</p><div style="border:1px solid #ece9e2;border-radius:10px;padding:16px;">${body}</div>${nurtureStopFooter(lead.email)}`
    })
  }).catch(err => console.error('Copia interna de auditoría auto falló:', err && err.message));

  console.log(`Auditoría AUTO OK · ${lead.cleanName} · ${metrics.workers_count} personas · ${seconds}s`);
}

app.post('/api/audit-request', contactLimiter, (req, res) => {
  auditUpload.single('file')(req, res, async (upErr) => {
    try {
      if (upErr) return res.status(400).json({ error: 'Archivo no válido o demasiado grande (máx. 8 MB, PDF/Excel/CSV/imagen)' });
      const { name, email, sector, workers, message, website, staffing_needs, has_leaders } = req.body || {};
      if (website) return res.json({ ok: true }); // honeypot
      const cleanName = cap(name, 255).trim();
      if (!cleanName) return res.status(400).json({ error: 'Falta el nombre' });
      if (!email || !isValidEmail(email) || String(email).length > 255) {
        return res.status(400).json({ error: 'Email no válido' });
      }
      const cleanSector = cap(sector, 100).trim();
      const cleanWorkers = cap(workers, 50).trim();
      const cleanMessage = cap(message, 1500).trim();
      // Datos de certeza del formulario: necesidades de personal en texto
      // libre (las interpreta la IA junto con la planilla) y encargados.
      const cleanStaffing = cap(staffing_needs, 600).trim();
      const hasLeaders = has_leaders === 'si' ? true : has_leaders === 'no' ? false : null;

      // Se captura el id para guardar después el score del informe en el
      // mismo lead (personaliza el seguimiento automático).
      let leadIdPromise = Promise.resolve(null);
      if (global.__shiftiaDbReady) {
        leadIdPromise = pool.query(
          'INSERT INTO tool_leads (tool, name, email, sector, workers, summary) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
          ['auditoria', cleanName, email, cleanSector || null, cleanWorkers || null,
            [cleanMessage, cleanStaffing ? `[necesidades: ${cleanStaffing}]` : '', hasLeaders === null ? '' : `[encargados: ${hasLeaders ? 'sí' : 'no'}]`].filter(Boolean).join(' ') || null]
        ).then(r => r.rows[0] && r.rows[0].id).catch(err => { console.error('tool_leads (auditoría) insert falló:', err.message); return null; });
      }
      res.json({ ok: true, auto: auditAI.isEnabled() && !!req.file });

      const lead = { cleanName, email, sector: cleanSector, workers: cleanWorkers, message: cleanMessage, staffing_needs: cleanStaffing, has_leaders: hasLeaders, leadIdPromise };
      const manualCtx = [cleanMessage, cleanStaffing ? `Necesidades de personal descritas: ${cleanStaffing}` : ''].filter(Boolean).join('\n\n');
      const manualArgs = { cleanName, email, cleanSector, cleanWorkers, cleanMessage: manualCtx, file: req.file };

      // Camino inteligente: solo con API key configurada y archivo presente.
      if (auditAI.isEnabled() && req.file) {
        runAutoAudit(lead, req.file).catch(err => {
          console.error('Auditoría auto falló → flujo manual:', err && err.message);
          sendManualAuditEmails({ ...manualArgs, statusNote: err && err.manualReason ? err.manualReason : `Análisis automático falló (${err && err.message}).` });
        });
      } else {
        sendManualAuditEmails({ ...manualArgs, statusNote: auditAI.isEnabled() ? 'Sin archivo adjunto.' : 'Análisis automático desactivado (falta ANTHROPIC_API_KEY).' });
      }
    } catch (err) {
      console.error('audit-request error:', err.message);
      if (!res.headersSent) res.status(500).json({ error: 'Error interno' });
    }
  });
});

// GET slots — devuelve disponibilidad real de un día
app.get('/api/booking/slots', apiLimiter, async (req, res) => {
  try {
    const { date } = req.query;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) {
      return res.status(400).json({ error: 'date inválido' });
    }
    // Slots posibles del día
    const allSlots = generateDaySlots();

    // Slots ya reservados (consulta sobre booking_at extrayendo HH:MM en Europe/Madrid)
    let bookedRows = { rows: [] };
    let blocked = false;
    let blockedReason = null;

    // Si DB está caída, saltamos las queries para no provocar timeouts de 30s por request.
    if (global.__shiftiaDbReady) {
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

      try {
        const b = await pool.query('SELECT reason FROM blocked_dates WHERE block_date = $1 LIMIT 1', [date]);
        if (b.rows.length > 0) { blocked = true; blockedReason = b.rows[0].reason; }
      } catch (_) {}
    }
    const booked = new Set(bookedRows.rows.map(r => r.hhmm));

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
app.post('/api/booking', contactLimiter, async (req, res) => {
  try {
    const body = req.body || {};

    // Honeypot anti-bot — campo invisible que solo bots rellenan
    const clientIP = req.ip || req.connection.remoteAddress;
    if (body.website && String(body.website).trim() !== '') {
      console.log('Booking honeypot triggered from', clientIP);
      return res.json({ ok: true }); // fingimos OK para no señalar al bot
    }

    let { name, email, phone, company, workers, department, message, date, time, modules } = body;

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

    // Normalize modules array. Accept array or comma-separated string.
    let modulesList = [];
    if (Array.isArray(modules)) {
      modulesList = modules.map(m => cap(String(m).trim(), 60)).filter(Boolean);
    } else if (typeof modules === 'string' && modules.trim()) {
      modulesList = modules.split(',').map(m => cap(m.trim(), 60)).filter(Boolean);
    }
    modulesList = modulesList.slice(0, 30); // cap total

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

    // Día bloqueado por admin (vacaciones, festivo) — solo chequea si DB online.
    if (global.__shiftiaDbReady) {
      try {
        const b = await pool.query('SELECT reason FROM blocked_dates WHERE block_date = $1 LIMIT 1', [date]);
        if (b.rows.length > 0) {
          return res.status(400).json({ error: 'Ese día no está disponible. Por favor, elige otro.' });
        }
      } catch (_) {}
    }

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

    // Persistir módulos como sufijo en el campo message (no tocamos schema)
    const messageWithModules = modulesList.length
      ? `${message || ''}${message ? '\n\n' : ''}[Módulos solicitados: ${modulesList.join(', ')}]`
      : message;

    // INSERT atómico — solo si DB está disponible. Si no, modo "email-only" (lead llega por correo).
    let bookingId;
    let cancelToken;
    const dbOnline = !!global.__shiftiaDbReady;

    if (dbOnline) {
      let inserted;
      try {
        inserted = await pool.query(
          `INSERT INTO bookings (
             name, email, phone, company, workers, department, message,
             booking_date, booking_time, booking_at, ip, user_agent, status, email_status
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'pending','pending') RETURNING id`,
          [
            name, email, phone, company || null, workers || null, department || null, messageWithModules || null,
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
        // Fallback: si la DB falla aquí, NO matamos el lead — seguimos en modo email-only.
        global.__shiftiaDbReady = false;
      }

      if (inserted && inserted.rowCount === 1 && inserted.rows[0] && inserted.rows[0].id) {
        bookingId = inserted.rows[0].id;
        cancelToken = makeCancelToken(bookingId, email);
        await pool.query('UPDATE bookings SET cancel_token = $1 WHERE id = $2', [cancelToken, bookingId]).catch(() => {});
      }
    }

    if (!bookingId) {
      // Modo email-only: generamos un ID efímero para el correo (no permite cancelación URL).
      bookingId = `LEAD-${Date.now().toString(36).toUpperCase()}`;
      cancelToken = '';
      console.warn(`Booking en modo email-only (DB down) — lead ${bookingId} de ${email}`);
    }

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
      organizerEmail: NOTIFY_EMAIL,
      attendeeEmail: email
    });
    const icsAttachment = {
      filename: 'shiftia-llamada.ics',
      content: icsContent,
      contentType: 'text/calendar; method=REQUEST; charset=UTF-8'
    };

    const cancelUrl = `${APP_URL}/booking/cancel?id=${bookingId}&token=${cancelToken}`;
    const supportEmail = NOTIFY_EMAIL;

    // Responder OK al cliente DESPUÉS de confirmar la fila en BD
    console.log(`Booking #${bookingId} OK: ${emailTag(email)} — ${date} ${time} (Madrid)`);
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
      resendFrom: INTERNAL_RESEND_FROM,
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
          ${modulesList.length ? `
          <div style="margin-top:20px;padding:20px;background:linear-gradient(135deg,#f0fdfa,#e0f2fe);border-radius:10px;border:1px solid #99f6e4;">
            <p style="color:#0f766e;font-size:12px;text-transform:uppercase;letter-spacing:0.06em;margin:0 0 12px;font-weight:700;">Configuración solicitada · ${modulesList.length} módulos</p>
            <div style="display:block;line-height:1.9;">
              ${modulesList.map(m => `<span style="display:inline-block;padding:5px 12px;margin:3px 4px 3px 0;background:#fff;border:1px solid #5eead4;border-radius:999px;font-size:13px;color:#0f766e;font-weight:600;">${ESC_HTML(m)}</span>`).join('')}
            </div>
            <p style="color:#0f766e;font-size:11px;margin:12px 0 0;opacity:0.7;">El cliente seleccionó estos módulos al agendar. Prepara la demo en consecuencia.</p>
          </div>` : ''}
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
          ${modulesList.length ? `
          <div style="margin:24px 0;padding:20px;background:linear-gradient(135deg,#f0fdfa,#e0f2fe);border-radius:10px;border:1px solid #99f6e4;">
            <p style="color:#0f766e;font-size:12px;text-transform:uppercase;letter-spacing:0.06em;margin:0 0 12px;font-weight:700;">Funciones que te interesan · ${modulesList.length}</p>
            <div style="display:block;line-height:1.9;">
              ${modulesList.map(m => `<span style="display:inline-block;padding:5px 12px;margin:3px 4px 3px 0;background:#fff;border:1px solid #5eead4;border-radius:999px;font-size:13px;color:#0f766e;font-weight:600;">${ESC_HTML(m)}</span>`).join('')}
            </div>
            <p style="color:#0f766e;font-size:11px;margin:12px 0 0;opacity:0.7;">Prepararemos la demo centrándonos en estas funciones.</p>
          </div>` : ''}
          <p style="margin:20px 0 0;font-size:14px;color:#7a766f;">¿Necesitas cambiarla? <a href="${cancelUrl}" style="color:#0f7a6d;">Cancelar o reagendar</a>.</p>
          <p style="color:#33312d;margin:24px 0 0;">Un saludo,<br><span style="color:#0e0f0f;">El equipo de Shiftia</span></p>
        `
      })
    }).catch(err => console.error('Email fire-and-forget falló:', err && err.message));

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
      to: NOTIFY_EMAIL,
      resendFrom: INTERNAL_RESEND_FROM,
      subject: `Cancelación de llamada #${id} — ${b.email}`,
      html: emailTemplate({
        preheader: `Cancelación de llamada #${id}`,
        headline: `Llamada #${id} cancelada`,
        body: `<p style="margin:0;">El cliente <span style="color:#0e0f0f;">${ESC_HTML(b.name)}</span> &lt;<a href="mailto:${ESC_HTML(b.email)}" style="color:#0f7a6d;">${ESC_HTML(b.email)}</a>&gt; ha cancelado su llamada del <span style="color:#0e0f0f;">${prettyDateMadrid(b.booking_at)}</span> a las <span style="color:#0e0f0f;">${prettyTimeMadrid(b.booking_at)}</span>.</p>`
      })
    }).catch(err => console.error('Aviso interno de cancelación falló:', err && err.message));

    return res.status(200).send(htmlPage('Reserva cancelada', `Tu llamada del ${ESC_HTML(prettyDateMadrid(b.booking_at))} a las ${ESC_HTML(prettyTimeMadrid(b.booking_at))} ha quedado cancelada. Si lo deseas, <a href="${APP_URL}/#contact">reserva otra fecha</a>.`));
  } catch (err) {
    console.error('Booking cancel error:', err.message);
    return res.status(500).send('Error procesando la cancelación.');
  }
});

// ====== ADMIN BOOKING ENDPOINTS ======
// Protegidos por ADMIN_API_KEY (no JWT, son endpoints de owner). Sin la key
// devuelven 404 para no leak de su existencia.
// La key viaja en el header x-admin-key (no en query string para no aparecer
// en logs de servidor/proxy/Railway).
function requireAdminKey(req, res) {
  const adminKey = process.env.ADMIN_API_KEY;
  const sentKey  = req.headers['x-admin-key'];
  // Comparación en tiempo constante (coherente con el resto de tokens del server):
  // hasheamos ambos para igualar longitudes antes de timingSafeEqual.
  let ok = false;
  if (adminKey && typeof sentKey === 'string') {
    const a = crypto.createHash('sha256').update(sentKey).digest();
    const b = crypto.createHash('sha256').update(adminKey).digest();
    ok = crypto.timingSafeEqual(a, b);
  }
  if (!ok) {
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
    console.error('[admin]', err);
    res.status(500).json({ error: 'Error interno del servidor' });
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
    console.error('[admin]', err);
    res.status(500).json({ error: 'Error interno del servidor' });
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
  } catch (err) {
    console.error('[admin]', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.delete('/api/admin/blocked-dates/:date', async (req, res) => {
  if (!requireAdminKey(req, res)) return;
  const date = req.params.date;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'date YYYY-MM-DD' });
  try {
    await pool.query('DELETE FROM blocked_dates WHERE block_date = $1', [date]);
    res.json({ ok: true });
  } catch (err) {
    console.error('[admin]', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Listar días bloqueados
app.get('/api/admin/blocked-dates', async (req, res) => {
  if (!requireAdminKey(req, res)) return;
  try {
    const r = await pool.query("SELECT block_date, reason FROM blocked_dates WHERE block_date >= CURRENT_DATE ORDER BY block_date ASC");
    res.json({ blocked: r.rows });
  } catch (err) {
    console.error('[admin]', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
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
  } catch (err) {
    console.error('[admin]', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

function htmlPage(title, body) {
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} — Shiftia</title>
  <style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:linear-gradient(135deg,#f0fdf9,#eff6ff);min-height:100vh;display:flex;align-items:center;justify-content:center;margin:0;padding:24px;color:#1e293b}main{background:#fff;padding:40px;border-radius:16px;max-width:480px;box-shadow:0 8px 32px rgba(0,0,0,0.06);text-align:center}h1{margin:0 0 12px;color:#2980b9}p{color:#475569;line-height:1.6}a{color:#4ecdc4}</style>
  </head><body><main><h1>${title}</h1><p>${body}</p><p><a href="${APP_URL}/">Volver a Shiftia</a></p></main></body></html>`;
}

// ====== STATIC ROUTES ======
// Serve login.html
app.get('/login', (req, res) => {
  sendPublicHtml(res, 'login.html');
});

// Serve reset-password.html
app.get('/reset-password', (req, res) => {
  sendPublicHtml(res, 'reset-password.html');
});

// Serve dashboard.html
app.get('/dashboard', (req, res) => {
  sendPublicHtml(res, 'dashboard.html');
});

// Serve docs.html
app.get('/docs', (req, res) => {
  sendPublicHtml(res, 'docs.html');
});

// Serve legal pages
// Sitemap dinámico — siempre con lastmod = hoy. Sustituye al sitemap.xml estático
// (que servirá express.static como fallback si por algún motivo este endpoint cae).
app.get('/sitemap.xml', (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const urls = [
    { loc: '/',                                          priority: '1.0', changefreq: 'weekly'  },
    { loc: '/demo',                                      priority: '0.9', changefreq: 'monthly' },
    { loc: '/recursos',                                  priority: '0.8', changefreq: 'weekly'  },
    { loc: '/recursos/descanso-minimo-entre-turnos',     priority: '0.8', changefreq: 'monthly' },
    { loc: '/recursos/calculadora-equidad-nocturna',     priority: '0.8', changefreq: 'monthly' },
    { loc: '/recursos/excel-vs-software-turnos',         priority: '0.8', changefreq: 'monthly' },
    { loc: '/recursos/auditoria-cuadrante',              priority: '0.8', changefreq: 'monthly' },
    { loc: '/recursos/plantilla-excel-cuadrante-turnos', priority: '0.8', changefreq: 'monthly' },
    { loc: '/docs',                                      priority: '0.7', changefreq: 'monthly' },
    { loc: '/sobre-nosotros',                            priority: '0.6', changefreq: 'monthly' },
    { loc: '/privacidad',                                priority: '0.3', changefreq: 'yearly'  },
    { loc: '/terminos',                                  priority: '0.3', changefreq: 'yearly'  },
    { loc: '/cookies',                                   priority: '0.3', changefreq: 'yearly'  }
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url>
    <loc>https://${CANONICAL_HOST}${u.loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>`;
  res.set('Content-Type', 'application/xml; charset=utf-8');
  res.set('Cache-Control', 'public, max-age=3600');
  res.send(xml);
});

app.get('/sobre-nosotros', (req, res) => sendPublicHtml(res, 'sobre-nosotros.html'));
app.get('/privacidad', (req, res) => sendPublicHtml(res, 'privacidad.html'));
app.get('/terminos',   (req, res) => sendPublicHtml(res, 'terminos.html'));
app.get('/cookies',    (req, res) => sendPublicHtml(res, 'cookies.html'));

// SEO pillar pages — recursos
app.get('/recursos',  (req, res) => sendPublicHtml(res, 'recursos/index.html'));
app.get('/recursos/', (req, res) => res.redirect(301, '/recursos'));
app.get('/recursos/descanso-minimo-entre-turnos', (req, res) => sendPublicHtml(res, 'recursos/descanso-minimo-entre-turnos.html'));
app.get('/recursos/calculadora-equidad-nocturna', (req, res) => sendPublicHtml(res, 'recursos/calculadora-equidad-nocturna.html'));
app.get('/recursos/excel-vs-software-turnos',     (req, res) => sendPublicHtml(res, 'recursos/excel-vs-software-turnos.html'));
app.get('/demo', (req, res) => sendPublicHtml(res, 'demo.html'));
app.get('/forgot-password', (req, res) => sendPublicHtml(res, 'forgot-password.html'));

// Health check público — minimalista, no expone diagnóstico interno
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: require('./package.json').version });
});

// Status público para la página /status — datos minimalistas, no expone diagnóstico
app.get('/api/status', (req, res) => {
  res.json({
    status: 'operational',
    updated_at: new Date().toISOString()
  });
});

// Health check completo — solo con ADMIN_API_KEY
app.get('/api/health/full', (req, res) => {
  if (!requireAdminKey(req, res)) return;
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
app.get('/api/test-email', authLimiter, async (req, res) => {
  if (!requireAdminKey(req, res)) return;

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

// 404 real para rutas desconocidas. Antes se servía la landing con 200
// (soft-404): Google veía infinitos duplicados y penalizaba el rastreo.
app.get('*', (req, res) => {
  res.status(404);
  sendPublicHtml(res, '404.html');
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

// ====== RECORDATORIOS DE LLAMADA (24 h al cliente · 1 h al cliente y a info@) ======
const REMINDER_SCAN_MS = 5 * 60 * 1000; // escanea cada 5 minutos
let __reminderScanRunning = false;

function reminderIcs(b) {
  const start = new Date(b.booking_at);
  const end = new Date(start.getTime() + BOOKING_SLOT_MINUTES * 60000);
  const ics = buildIcs({
    uid: 'reminder-' + b.id,
    startUtc: start,
    endUtc: end,
    summary: `Llamada con Shiftia — ${b.name}${b.company ? ' (' + b.company + ')' : ''}`,
    description: `Demo personalizada de Shiftia.\n\nContacto: ${b.name}\nTeléfono: ${b.phone || '-'}`,
    location: 'Llamada por teléfono',
    organizerEmail: NOTIFY_EMAIL,
    attendeeEmail: b.email
  });
  return { filename: 'shiftia-llamada.ics', content: ics, contentType: 'text/calendar; method=REQUEST; charset=UTF-8' };
}

function sendClientReminder(b, when) {
  const prettyDate = prettyDateMadrid(b.booking_at);
  const prettyTime = prettyTimeMadrid(b.booking_at);
  const first = ESC_HTML(String(b.name || '').split(' ')[0] || '');
  const isDay = (when === '24h');
  const cancelUrl = b.cancel_token ? `${APP_URL}/booking/cancel?id=${b.id}&token=${b.cancel_token}` : '';
  return sendMail({
    from: `"Shiftia" <${GMAIL_USER}>`,
    replyTo: NOTIFY_EMAIL,
    to: b.email,
    subject: isDay
      ? `Recordatorio de tu llamada con Shiftia — ${prettyDate} a las ${prettyTime}`
      : `Tu llamada con Shiftia es en 1 hora — hoy a las ${prettyTime}`,
    attachments: [reminderIcs(b)],
    html: emailTemplate({
      preheader: isDay ? `${prettyDate} a las ${prettyTime}` : `Hoy a las ${prettyTime}`,
      headline: isDay ? `Hola ${first}, te recordamos tu llamada` : `Hola ${first}, tu llamada es enseguida`,
      body: `
        <div style="background:#faf9f6;padding:20px;border-radius:10px;border:1px solid #ece9e2;margin-bottom:20px;">
          <p style="margin:0;font-size:17px;color:#0e0f0f;font-family:'Instrument Serif','Times New Roman',Georgia,serif;line-height:1.3;">${prettyDate} a las ${prettyTime}</p>
          <p style="margin:6px 0 0;font-size:12px;color:#7a766f;">Hora de Madrid (Europe/Madrid)</p>
        </div>
        <p style="color:#1a1a1a;line-height:1.6;margin:0;font-size:15px;">Te llamaremos al teléfono que nos indicaste a la hora prevista. Si necesitas cambiar la cita${cancelUrl ? `, puedes <a href="${cancelUrl}" style="color:#0f7a6d;">cancelarla aquí</a>` : ', responde a este correo'}.</p>
      `
    })
  });
}

function sendInternalReminder(b) {
  const prettyDate = prettyDateMadrid(b.booking_at);
  const prettyTime = prettyTimeMadrid(b.booking_at);
  return sendMail({
    from: `"Shiftia Booking" <${GMAIL_USER}>`,
    replyTo: b.email,
    to: NOTIFY_EMAIL,
    resendFrom: INTERNAL_RESEND_FROM,
    subject: `Recordatorio: llamada con ${ESC_HTML(b.name)} en 1 hora — ${prettyTime}`,
    attachments: [reminderIcs(b)],
    html: emailTemplate({
      preheader: `En 1 hora — ${ESC_HTML(b.name)} ${prettyTime}`,
      headline: 'Llamada en 1 hora',
      body: `
        <div style="background:#faf9f6;padding:20px;border-radius:10px;border:1px solid #ece9e2;margin-bottom:20px;">
          <p style="margin:0;font-size:17px;color:#0e0f0f;font-family:'Instrument Serif','Times New Roman',Georgia,serif;line-height:1.3;">${prettyDate} a las ${prettyTime}</p>
        </div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #ece9e2;">
          <tr><td style="padding:10px 0;color:#7a766f;font-size:13px;width:120px;border-bottom:1px solid #ece9e2;">Nombre</td><td style="padding:10px 0;font-size:14px;border-bottom:1px solid #ece9e2;">${ESC_HTML(b.name)}</td></tr>
          <tr><td style="padding:10px 0;color:#7a766f;font-size:13px;border-bottom:1px solid #ece9e2;">Teléfono</td><td style="padding:10px 0;font-size:14px;border-bottom:1px solid #ece9e2;"><a href="tel:${ESC_HTML(b.phone || '')}" style="color:#0f7a6d;">${ESC_HTML(b.phone || '-')}</a></td></tr>
          <tr><td style="padding:10px 0;color:#7a766f;font-size:13px;">Email</td><td style="padding:10px 0;font-size:14px;"><a href="mailto:${ESC_HTML(b.email)}" style="color:#0f7a6d;">${ESC_HTML(b.email)}</a></td></tr>
        </table>
      `
    })
  });
}

async function scanReminders() {
  if (__reminderScanRunning || !global.__shiftiaDbReady) return;
  if (!RESEND_KEY && !transporter) return;
  __reminderScanRunning = true;
  try {
    // Recordatorio único: 1 h antes de la llamada — al cliente y a info@.
    // (La confirmación "al reservar" ya se envía en el momento de la reserva.)
    const due1 = await pool.query(
      `SELECT id,name,email,phone,company,booking_at,cancel_token FROM bookings
       WHERE status != 'cancelled' AND booking_at IS NOT NULL AND reminder_1h_at IS NULL
         AND booking_at > NOW() AND booking_at <= NOW() + INTERVAL '1 hour'
       ORDER BY booking_at ASC LIMIT 50`
    );
    for (const b of due1.rows) {
      try {
        await sendClientReminder(b, '1h');
        await sendInternalReminder(b);
        await pool.query('UPDATE bookings SET reminder_1h_at = NOW() WHERE id=$1', [b.id]);
        console.log('Recordatorio 1h enviado · booking', b.id);
      } catch (e) { console.error('Recordatorio 1h falló · booking', b.id, e.message); }
    }
  } catch (e) {
    console.error('Escaneo de recordatorios falló:', e.message);
  } finally {
    __reminderScanRunning = false;
  }
}

function startReminderScheduler() {
  if (!RESEND_KEY && !transporter) { console.log('Recordatorios DESACTIVADOS (sin email)'); return; }
  setInterval(() => { scanReminders().catch(() => {}); }, REMINDER_SCAN_MS);
  console.log(`Recordatorios ON — escaneo cada ${REMINDER_SCAN_MS / 60000} min · 1h cliente + ${NOTIFY_EMAIL}`);
}

// ====== SECUENCIA DE SEGUIMIENTO (NURTURE) ======
// Tres correos automáticos a los leads de herramientas gratuitas (día 2/5/10).
// Se corta en cuanto el lead convierte (agenda llamada o se registra) o se da
// de baja. Un solo hilo de secuencia por email aunque haya varios leads.
const NURTURE_SCAN_MS = 30 * 60 * 1000;
let __nurtureScanRunning = false;

function nurtureUnsubUrl(email) {
  const e = Buffer.from(String(email).trim().toLowerCase()).toString('base64url');
  return `${APP_URL}/api/nurture/unsubscribe?e=${e}&t=${nurture.makeUnsubToken(email, JWT_SECRET)}`;
}

// Pie para los avisos internos: un clic y ese lead deja de recibir la
// secuencia (p. ej. porque ya estáis hablando por email y el automático
// quedaría fuera de lugar).
function nurtureStopFooter(email) {
  return `<p style="margin:18px 0 0;font-size:12px;color:#9a958c;">⏸ <a href="${nurtureUnsubUrl(email)}&via=interno" style="color:#9a958c;">Detener el seguimiento automático para este lead</a> — si ya estáis en conversación, evita que le llegue el próximo correo de la serie.</p>`;
}

async function scanNurture() {
  if (__nurtureScanRunning || !global.__shiftiaDbReady) return;
  __nurtureScanRunning = true;
  try {
    for (const step of nurture.STEPS) {
      const { rows } = await pool.query(
        `SELECT DISTINCT ON (LOWER(email)) id, tool, name, email, sector, created_at, audit_score, audit_meta
           FROM tool_leads
          WHERE nurture_stage = $1
            AND unsubscribed = FALSE
            AND created_at <= NOW() - ($2 * INTERVAL '1 day')
            AND created_at >  NOW() - ($3 * INTERVAL '1 day')
            AND (nurture_last_at IS NULL OR nurture_last_at <= NOW() - ($4 * INTERVAL '1 day'))
          ORDER BY LOWER(email), created_at DESC
          LIMIT 20`,
        [step.stage - 1, step.afterDays, nurture.MAX_LEAD_AGE_DAYS, nurture.MIN_GAP_DAYS]
      );
      for (const lead of rows) {
        try {
          // ¿Ya convirtió? (llamada agendada o cuenta creada) → fin de secuencia.
          const [booked, registered] = await Promise.all([
            pool.query("SELECT 1 FROM bookings WHERE LOWER(email)=LOWER($1) AND status != 'cancelled' LIMIT 1", [lead.email]),
            pool.query('SELECT 1 FROM users WHERE LOWER(email)=LOWER($1) LIMIT 1', [lead.email]).catch(() => ({ rows: [] }))
          ]);
          if (booked.rows.length || registered.rows.length) {
            await pool.query('UPDATE tool_leads SET nurture_stage=$2 WHERE LOWER(email)=LOWER($1)', [lead.email, nurture.STAGE_CONVERTED]);
            continue;
          }
          try { lead.audit_meta = lead.audit_meta ? JSON.parse(lead.audit_meta) : null; } catch (e) { lead.audit_meta = null; }
          const mail = nurture.buildNurtureEmail(step.stage, lead, {
            appUrl: APP_URL,
            unsubUrl: nurtureUnsubUrl(lead.email),
            escHtml: bookingLib.escHtml
          });
          await sendMail({
            from: `"Shiftia" <${GMAIL_USER}>`,
            replyTo: NOTIFY_EMAIL,
            to: lead.email,
            subject: mail.subject,
            html: emailTemplate({ preheader: mail.preheader, headline: mail.headline, body: mail.body, footer: mail.footer })
          });
          await pool.query(
            'UPDATE tool_leads SET nurture_stage=$2, nurture_last_at=NOW() WHERE LOWER(email)=LOWER($1) AND nurture_stage < $2',
            [lead.email, step.stage]
          );
          console.log(`Nurture e${step.stage} enviado · ${lead.email} (${lead.tool})`);
        } catch (err) {
          console.error(`Nurture e${step.stage} falló para ${lead.email}:`, err && err.message);
        }
      }
    }
  } catch (e) {
    console.error('Escaneo de nurture falló:', e.message);
  } finally {
    __nurtureScanRunning = false;
  }
}

function startNurtureScheduler() {
  if (!RESEND_KEY && !transporter) { console.log('Nurture DESACTIVADO (sin email)'); return; }
  setInterval(() => { scanNurture().catch(() => {}); }, NURTURE_SCAN_MS);
  setTimeout(() => { scanNurture().catch(() => {}); }, 90 * 1000); // primer barrido al arrancar
  console.log(`Nurture ON — secuencia día ${nurture.STEPS.map(s => s.afterDays).join('/')} · escaneo cada ${NURTURE_SCAN_MS / 60000} min`);
}

// ====== RESUMEN SEMANAL INTERNO ======
// Cada lunes por la mañana (hora de Madrid): el pulso del embudo en un correo.
// Idempotente entre reinicios: app_state guarda el lunes ya enviado.
async function scanWeeklyReport() {
  if (!global.__shiftiaDbReady) return;
  const parts = new Intl.DateTimeFormat('es-ES', { timeZone: BOOKING_TIMEZONE, weekday: 'short', hour: 'numeric', hour12: false }).formatToParts(new Date());
  const weekday = (parts.find(p => p.type === 'weekday') || {}).value || '';
  const hour = parseInt((parts.find(p => p.type === 'hour') || {}).value, 10);
  if (!/^lun/i.test(weekday) || !(hour >= 8 && hour < 13)) return; // ventana lunes 08-13h

  const todayMadrid = new Intl.DateTimeFormat('en-CA', { timeZone: BOOKING_TIMEZONE }).format(new Date()); // YYYY-MM-DD
  try {
    const prev = await pool.query("SELECT value FROM app_state WHERE key='weekly_report_last'");
    if (prev.rows.length && prev.rows[0].value === todayMadrid) return; // ya enviado hoy

    const [byToolQ, bookingsQ, convertedQ, inSeqQ, unsubQ] = await Promise.all([
      pool.query("SELECT tool, COUNT(*)::int AS n FROM tool_leads WHERE created_at > NOW() - INTERVAL '7 days' GROUP BY tool"),
      pool.query("SELECT COUNT(*)::int AS n FROM bookings WHERE created_at > NOW() - INTERVAL '7 days' AND status != 'cancelled'"),
      pool.query('SELECT COUNT(DISTINCT LOWER(email))::int AS n FROM tool_leads WHERE nurture_stage = $1', [nurture.STAGE_CONVERTED]),
      pool.query("SELECT COUNT(DISTINCT LOWER(email))::int AS n FROM tool_leads WHERE nurture_stage BETWEEN 0 AND 2 AND unsubscribed = FALSE AND created_at > NOW() - INTERVAL '45 days'"),
      pool.query('SELECT COUNT(DISTINCT LOWER(email))::int AS n FROM tool_leads WHERE unsubscribed = TRUE')
    ]);
    const byTool = {};
    let totalLeads = 0;
    for (const r of byToolQ.rows) { byTool[r.tool] = r.n; totalLeads += r.n; }

    const fmt = d => new Intl.DateTimeFormat('es-ES', { timeZone: BOOKING_TIMEZONE, day: 'numeric', month: 'short' }).format(d);
    const weekLabel = `${fmt(new Date(Date.now() - 7 * 24 * 3600 * 1000))} – ${fmt(new Date())}`;

    const mail = nurture.buildWeeklyReportEmail({
      weekLabel, byTool, totalLeads,
      bookings: bookingsQ.rows[0].n,
      converted: convertedQ.rows[0].n,
      inSequence: inSeqQ.rows[0].n,
      unsubscribed: unsubQ.rows[0].n
    });
    await sendMail({
      from: `"Shiftia Resumen" <${GMAIL_USER}>`,
      to: NOTIFY_EMAIL,
      resendFrom: INTERNAL_RESEND_FROM,
      subject: mail.subject,
      html: emailTemplate({ preheader: mail.preheader, headline: mail.headline, body: mail.body })
    });
    await pool.query(
      "INSERT INTO app_state (key, value) VALUES ('weekly_report_last', $1) ON CONFLICT (key) DO UPDATE SET value = $1",
      [todayMadrid]
    );
    console.log(`Resumen semanal enviado (${weekLabel}) · ${totalLeads} leads · ${bookingsQ.rows[0].n} llamadas`);
  } catch (e) {
    console.error('Resumen semanal falló:', e.message);
  }
}

function startWeeklyReportScheduler() {
  if (!RESEND_KEY && !transporter) { console.log('Resumen semanal DESACTIVADO (sin email)'); return; }
  setInterval(() => { scanWeeklyReport().catch(() => {}); }, 60 * 60 * 1000);
  setTimeout(() => { scanWeeklyReport().catch(() => {}); }, 2 * 60 * 1000);
  console.log('Resumen semanal ON — lunes por la mañana (hora de Madrid)');
}

// ====== SERVER STARTUP ======
async function startServer() {
  try {
    // Initialize database — non-fatal, server arranca igual.
    try { await initializeDatabase(); } catch (e) {
      console.warn('initializeDatabase threw uncaught:', e && e.message);
      global.__shiftiaDbReady = false;
    }

    app.listen(PORT, () => {
      console.log(`Shiftia HUB v2.3 running on port ${PORT}`);
      console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`  Auth: enabled | Compression: enabled`);
      console.log(`  Email: ${RESEND_KEY ? 'Resend' : (GMAIL_PASS ? 'Gmail SMTP' : 'DISABLED')}`);
      console.log(`  Billing: por llamada (Stripe deshabilitado)`);
      console.log(`  APP_URL: ${APP_URL}`);
      startReminderScheduler();
      startNurtureScheduler();
      startWeeklyReportScheduler();
    });
  } catch (err) {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  }
}

startServer();
