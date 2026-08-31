// Smoke test: el servidor arranca sin base de datos (initializeDatabase es
// no-fatal), responde /api/health y sirve la landing. Detecta roturas de
// arranque antes de llegar a producción.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');

const PORT = 3987;
const BASE = `http://127.0.0.1:${PORT}`;

function waitForHealth(timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    (function tick() {
      fetch(`${BASE}/api/health`)
        .then((r) => (r.ok ? resolve(r) : Promise.reject(new Error('status ' + r.status))))
        .catch(() => {
          if (Date.now() > deadline) return reject(new Error('el servidor no respondió a tiempo'));
          setTimeout(tick, 250);
        });
    })();
  });
}

test('el servidor arranca y sirve landing + health sin DB', async () => {
  const child = spawn(process.execPath, ['server.js'], {
    cwd: path.resolve(__dirname, '..'),
    env: {
      ...process.env,
      PORT: String(PORT),
      NODE_ENV: 'test',
      // Sin DATABASE_URL ni PGHOST: el arranque debe sobrevivir igualmente.
      DATABASE_URL: '',
      PGHOST: '',
      JWT_SECRET: 'test-secret-not-production',
      BOOKING_CANCEL_SECRET: 'test-cancel-secret',
      // Sin credenciales de Google: la reserva debe caer al flujo por teléfono.
      GOOGLE_CLIENT_ID: '',
      GOOGLE_CLIENT_SECRET: '',
      GOOGLE_REFRESH_TOKEN: ''
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let logs = '';
  child.stdout.on('data', (d) => { logs += d; });
  child.stderr.on('data', (d) => { logs += d; });

  try {
    await waitForHealth(15000);

    const health = await (await fetch(`${BASE}/api/health`)).json();
    assert.equal(health.status, 'ok');

    const home = await fetch(`${BASE}/`);
    assert.equal(home.status, 200);
    const html = await home.text();
    assert.ok(html.includes('Shiftia'), 'la landing contiene la marca');
    assert.ok(html.toLowerCase().includes('<!doctype html'), 'respuesta HTML');

    // CSP con nonce: el header y los <script> del HTML deben compartir nonce.
    const csp = home.headers.get('content-security-policy') || '';
    const nonceMatch = csp.match(/'nonce-([^']+)'/);
    assert.ok(nonceMatch, 'el CSP de la landing lleva nonce');
    assert.ok(html.includes(`<script nonce="${nonceMatch[1]}"`), 'los <script> llevan el mismo nonce');
    assert.ok(!/<script(?![^>]*nonce=)[\s>]/.test(html), 'ningún <script> queda sin nonce');
    assert.ok(!/on(?:click|submit|error|input|load|change)="/.test(html), 'sin handlers inline en la landing');

    // Dos peticiones → dos nonces distintos (no debe ser estático).
    const again = await fetch(`${BASE}/`);
    const csp2 = again.headers.get('content-security-policy') || '';
    assert.notEqual(csp, csp2, 'el nonce cambia por respuesta');

    // Una página servida por ruta bonita también va con nonce.
    const demo = await fetch(`${BASE}/demo`);
    assert.equal(demo.status, 200);
    assert.ok((demo.headers.get('content-security-policy') || '').includes("'nonce-"), '/demo lleva CSP con nonce');

    const notFound = await fetch(`${BASE}/api/no-existe`);
    assert.equal(notFound.status, 404, 'las rutas /api desconocidas devuelven 404');

    // Reservar sin DB ni Google configurado sigue funcionando (fallback:
    // modo email-only + llamada por teléfono, sin enlace Meet).
    const bookingDate = (() => {
      for (let add = 3; add <= 7; add++) {
        const d = new Date(Date.now() + add * 86400000);
        const wd = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Madrid', weekday: 'short' }).format(d);
        if (wd !== 'Sat' && wd !== 'Sun') {
          return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
        }
      }
    })();
    const bk = await fetch(`${BASE}/api/booking`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Smoke Test', email: 'smoke@example.com', phone: '600111222', date: bookingDate, time: '10:00' })
    });
    assert.equal(bk.status, 200, 'la reserva responde 200 sin DB ni Google');
    const bkJson = await bk.json();
    assert.equal(bkJson.ok, true, 'la reserva sin Google configurado sigue OK');
  } catch (err) {
    err.message += '\n--- logs del servidor ---\n' + logs.slice(-2000);
    throw err;
  } finally {
    child.kill('SIGTERM');
  }
});
