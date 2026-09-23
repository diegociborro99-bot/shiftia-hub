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
      BOOKING_CANCEL_SECRET: 'test-cancel-secret'
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

    // Las ventanas de atención, de punta a punta: lo que el calendario ofrece
    // tiene que ser exactamente lo que el POST acepta. Se mira un día lejano
    // para que el lead-time mínimo no tenga nada que ver.
    const lejos = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    const dia = await (await fetch(`${BASE}/api/booking/slots?date=${lejos}`)).json();
    assert.deepEqual(
      dia.slots.map((s) => s.time),
      ['10:00', '10:30', '11:00', '11:30', '12:00', '16:00', '16:30', '17:00'],
      'la agenda ofrece las dos ventanas de atención: 8 huecos, no la jornada entera'
    );

    // Resumen de disponibilidad: sin DB no puede saber qué está reservado, pero
    // debe responder con la forma correcta y sin inventarse escasez.
    const disp = await (await fetch(`${BASE}/api/booking/availability`)).json();
    assert.ok(Object.prototype.hasOwnProperty.call(disp, 'next'), 'availability trae next');
    assert.equal(typeof disp.libres7, 'number', 'availability cuenta huecos');
    assert.equal(disp.escasez, false, 'con la agenda vacía no se anuncia escasez');
    if (disp.next) {
      assert.ok(dia.slots.some((s) => s.time === disp.next.time),
        'el próximo hueco es una hora que de verdad se ofrece');
    }

    // landing.css se sirve con max-age de 30 días: si el ?v= no cambia con el
    // fichero, un cambio de CSS no le llega a nadie durante un mes y el HTML
    // nuevo se dibuja con la hoja vieja. El servidor debe reescribirlo con el
    // hash real del contenido, no dejar el número escrito a mano en el HTML.
    // Se comprueban TODAS las hojas versionadas de TODAS las páginas: cuando
    // solo se vigilaba landing.css, comercial.css se quedó con su ?v= a mano.
    const hashDe = (f) => require('node:crypto').createHash('sha1')
      .update(require('node:fs').readFileSync(path.resolve(__dirname, '..', 'public', f)))
      .digest('hex').slice(0, 10);

    let hojasVistas = 0;
    for (const ruta of ['/', '/turnos-hosteleria', '/shiftia-vs-aturnos', '/demo']) {
      const cuerpo = await (await fetch(`${BASE}${ruta}`)).text();
      for (const [, fichero, version] of cuerpo.matchAll(/([A-Za-z0-9._-]+\.css)\?v=([A-Za-z0-9._-]+)/g)) {
        assert.equal(version, hashDe(fichero),
          `el ?v= de ${fichero} en ${ruta} debe ser el hash de su contenido`);
        hojasVistas++;
      }
    }
    assert.ok(hojasVistas >= 3, 'se han revisado hojas versionadas en varias páginas');

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
    assert.match(notFound.headers.get('x-robots-tag') || '', /noindex/i, '/api desconocida envía noindex');
    const healthRes = await fetch(`${BASE}/api/health`);
    assert.match(healthRes.headers.get('x-robots-tag') || '', /noindex/i, '/api/health envía noindex');
    assert.equal((await healthRes.json()).status, 'ok', 'el noindex no cambia el JSON de /api/health');

    // Páginas de intención comercial y guías nuevas: 200, canonical y FAQ en JSON-LD.
    const commercial = [
      '/software-turnos-residencias', '/cuadrantes-enfermeria-clinicas', '/turnos-hosteleria',
      '/shiftia-vs-aturnos', '/shiftia-vs-sesame-hr', '/mejores-software-turnos-espana',
    ];
    const guides = [
      '/recursos/turnos-rotativos-convenio-2026', '/recursos/registro-horario-residencias', '/recursos/reparto-equitativo-de-noches',
    ];
    for (const route of [...commercial, ...guides]) {
      const r = await fetch(`${BASE}${route}`);
      assert.equal(r.status, 200, `${route} responde 200`);
      const body = await r.text();
      assert.ok(body.includes(`<link rel="canonical" href="https://www.shiftia.es${route}">`), `${route} lleva canonical`);
      assert.ok((r.headers.get('content-security-policy') || '').includes("'nonce-"), `${route} lleva CSP con nonce`);
      if (commercial.includes(route)) assert.ok(body.includes('"FAQPage"'), `${route} lleva FAQPage`);
      // El duplicado .html redirige a la ruta bonita.
      const dup = await fetch(`${BASE}${route}.html`, { redirect: 'manual' });
      assert.equal(dup.status, 301, `${route}.html redirige 301`);
      assert.equal(dup.headers.get('location'), route, `${route}.html apunta a la canónica`);
    }

    // Landings Gale (copy aprobado): título, H1 y canonical exactos, sin FAQ inventada.
    const galeLandings = [
      {
        route: '/software-cuadrantes-residencias',
        title: 'Software de cuadrantes para residencias | Shiftia',
        h1: 'Software de cuadrantes para residencias y dependencia',
      },
      {
        route: '/software-turnos-24-horas',
        title: 'Software de turnos 24h para facility y seguridad | Shiftia',
        h1: 'Planificación de turnos 24 horas para operaciones continuas',
      },
      {
        route: '/software-turnos-call-center',
        title: 'Software de turnos para call center | Shiftia',
        h1: 'Software de turnos y planillas para contact center',
      },
    ];
    for (const page of galeLandings) {
      const r = await fetch(`${BASE}${page.route}`);
      assert.equal(r.status, 200, `${page.route} responde 200`);
      const body = await r.text();
      assert.ok(body.includes(`<title>${page.title}</title>`), `${page.route} title`);
      assert.ok(body.includes(`<h1>${page.h1}</h1>`), `${page.route} H1`);
      assert.ok(body.includes(`<link rel="canonical" href="https://www.shiftia.es${page.route}">`), `${page.route} canonical`);
      assert.ok(body.includes('href="/#contact"'), `${page.route} enlaza al contacto`);
      assert.ok(body.includes('href="/demo"'), `${page.route} enlaza a la demo`);
      const dup = await fetch(`${BASE}${page.route}.html`, { redirect: 'manual' });
      assert.equal(dup.status, 301, `${page.route}.html redirige 301`);
      assert.equal(dup.headers.get('location'), page.route, `${page.route}.html apunta a la canónica`);
    }

    // El sitemap incluye las páginas nuevas.
    const sitemap = await (await fetch(`${BASE}/sitemap.xml`)).text();
    for (const route of [...commercial, ...guides, ...galeLandings.map((p) => p.route)]) {
      assert.ok(sitemap.includes(`<loc>https://www.shiftia.es${route}</loc>`), `sitemap incluye ${route}`);
    }
    assert.ok(!sitemap.includes('/api/'), 'el sitemap no lista /api');
  } catch (err) {
    err.message += '\n--- logs del servidor ---\n' + logs.slice(-2000);
    throw err;
  } finally {
    child.kill('SIGTERM');
  }
});
