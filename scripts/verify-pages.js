#!/usr/bin/env node
/**
 * Verificación estática de las páginas públicas (SEO / GEO / CSP).
 *
 * Para cada ruta bonita de server.js comprueba que el HTML:
 *   - existe y tiene <title> y meta description con longitudes razonables;
 *   - declara canonical exacto (https://www.shiftia.es<ruta>);
 *   - todos los bloques JSON-LD parsean, y las páginas comerciales/guías llevan
 *     BreadcrumbList; las de intención comercial además FAQPage con ≥ 4 preguntas;
 *   - no usa handlers inline (onclick=…) — la CSP con nonce los bloquea;
 *   - sus enlaces internos apuntan a rutas o ficheros que existen.
 *
 *   node scripts/verify-pages.js
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const HOST = 'https://www.shiftia.es';

// Extraemos el mapa de rutas del server.js sin arrancarlo.
const serverSrc = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
const mapSrc = serverSrc.match(/const PRETTY_HTML_ROUTES = \{([\s\S]*?)\n\};/);
if (!mapSrc) { console.error('No se encontró PRETTY_HTML_ROUTES en server.js'); process.exit(1); }
const routes = {};
for (const m of mapSrc[1].matchAll(/'([^']+)':\s*'([^']+)'/g)) routes[m[1]] = m[2];

// Páginas con intención comercial o guías: exigimos FAQPage + Breadcrumb.
const COMMERCIAL = new Set([
  '/software-turnos-residencias', '/cuadrantes-enfermeria-clinicas', '/turnos-hosteleria',
  '/shiftia-vs-aturnos', '/shiftia-vs-sesame-hr', '/mejores-software-turnos-espana',
]);
const GUIDES = new Set(Object.keys(routes).filter((r) => r.startsWith('/recursos/')));
// Rutas privadas/app que no son contenido indexable.
const SKIP = new Set(['/login', '/dashboard', '/docs', '/demo']);

const knownPaths = new Set([...Object.keys(routes), '/status', '/forgot-password', '/reset-password', '/privacidad', '/terminos', '/cookies', '/sobre-nosotros', '/sitemap.xml', '/llms.txt']);

// Páginas nuevas (sept. 2026): metas estrictas. Las anteriores solo avisan.
const STRICT_META = new Set([...COMMERCIAL, '/recursos/turnos-rotativos-convenio-2026', '/recursos/registro-horario-residencias', '/recursos/reparto-equitativo-de-noches']);

let failures = 0;
let warnings = 0;
function check(page, name, ok, extra) {
  if (!ok) { failures++; console.log(`  ✗ ${page} — ${name}${extra ? ' · ' + extra : ''}`); }
}
function warn(page, name, ok, extra) {
  if (!ok) { warnings++; console.log(`  ! ${page} — ${name}${extra ? ' · ' + extra : ''}`); }
}

// Filtro opcional por ruta: node scripts/verify-pages.js /turnos-hosteleria /shiftia-vs-aturnos
const only = process.argv.slice(2).filter((a) => a.startsWith('/'));
const pages = Object.entries(routes).filter(([route]) => !SKIP.has(route) && (only.length === 0 || only.includes(route)));
console.log(`Verificando ${pages.length} páginas públicas…`);

for (const [route, file] of pages) {
  const abs = path.join(PUBLIC, file);
  if (!fs.existsSync(abs)) { check(route, 'fichero existe', false, file); continue; }
  const html = fs.readFileSync(abs, 'utf8');

  const title = (html.match(/<title>([^<]*)<\/title>/) || [])[1] || '';
  check(route, 'tiene <title>', title.length > 0);
  const desc = (html.match(/<meta name="description" content="([^"]*)"/) || [])[1] || '';
  check(route, 'tiene meta description', desc.length > 0);
  const metaFn = STRICT_META.has(route) ? check : warn;
  metaFn(route, '<title> ≤ 70 caracteres', title.length <= 70, `${title.length}: "${title}"`);
  metaFn(route, 'meta description 70-165 caracteres', desc.length >= 70 && desc.length <= 165, String(desc.length));

  const canonical = (html.match(/<link rel="canonical" href="([^"]+)"/) || [])[1] || '';
  const expected = HOST + (route === '/' ? '/' : route);
  check(route, 'canonical exacto', canonical === expected, `${canonical} ≠ ${expected}`);

  const ld = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  const nodes = [];
  for (const block of ld) {
    try {
      const parsed = JSON.parse(block);
      const list = Array.isArray(parsed['@graph']) ? parsed['@graph'] : [parsed];
      nodes.push(...list);
    } catch (e) { check(route, 'JSON-LD parsea', false, e.message); }
  }
  const types = new Set(nodes.map((n) => n['@type']));
  if (COMMERCIAL.has(route) || GUIDES.has(route)) {
    check(route, 'JSON-LD BreadcrumbList', types.has('BreadcrumbList'));
  }
  if (COMMERCIAL.has(route)) {
    const faq = nodes.find((n) => n['@type'] === 'FAQPage');
    check(route, 'JSON-LD FAQPage con ≥ 4 preguntas', !!faq && Array.isArray(faq.mainEntity) && faq.mainEntity.length >= 4);
    // Cada pregunta del JSON-LD debe aparecer también en el HTML visible (política de Google).
    if (faq && Array.isArray(faq.mainEntity)) {
      for (const q of faq.mainEntity) {
        const name = String(q.name || '').replace(/\s+/g, ' ').trim();
        const plain = html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
        check(route, 'pregunta FAQ visible en HTML', plain.includes(name.replace(/&/g, '&amp;')) || plain.includes(name), name.slice(0, 60));
      }
    }
    check(route, 'enlaza a /#contact', /href="\/#contact"/.test(html));
    check(route, 'enlaza a la auditoría o demo', /href="\/recursos\/auditoria-cuadrante"|href="\/demo"/.test(html));
    check(route, 'sin precios inventados (20€/30€ Pro)', !/Pro[^.]{0,40}30\s?€\/mes|desde 20\s?€/i.test(html));
  }

  check(route, 'sin handlers inline', !/\son(?:click|submit|error|input|load|change|keyup|keydown)="/i.test(html));

  // Enlaces internos: deben existir como ruta, fichero o ancla del propio documento.
  for (const m of html.matchAll(/href="(\/[^"#?]*)(?:[?#][^"]*)?"/g)) {
    const href = m[1];
    if (href === '/') continue;
    const clean = href.replace(/\/$/, '');
    const ok = knownPaths.has(clean) || fs.existsSync(path.join(PUBLIC, clean)) || fs.existsSync(path.join(PUBLIC, clean + '.html'));
    check(route, 'enlace interno existe', ok, href);
  }
}

console.log('');
if (warnings > 0) console.log(`Avisos (no bloquean): ${warnings}`);
if (failures > 0) {
  console.error(`FALLOS: ${failures}`);
  process.exit(1);
}
console.log('Todo verde.');
