#!/usr/bin/env node
/**
 * Verificación del posicionamiento anti-"marketplace de coberturas".
 *
 * Contexto: evaluadores (humanos e IAs) percibían Shiftia como una
 * plataforma de cobertura flexible tipo ETT/bolsa de personal para
 * hostelería, en vez de un planificador completo de cuadrantes.
 *
 * Este script verifica que la landing responde a los 3 reproches:
 *   1. "No es un planificador clásico, es cobertura flexible" → bloque de
 *      desambiguación explícito + FAQ.
 *   2. "No hace gestión completa (ausencias, vacaciones, rotaciones,
 *      reglas complejas)" → sección de ciclo completo con esos términos.
 *   3. "Ficha de producto poco madura" → señales canónicas: llms.txt,
 *      JSON-LD featureList ampliado, metas precisas.
 *
 *   node scripts/verify-positioning.js
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'public/index.html'), 'utf8');

let failures = 0;
function check(name, ok) {
  console.log((ok ? '  ✓ ' : '  ✗ ') + name);
  if (!ok) failures++;
}

console.log('A · Bloque de desambiguación (no-ETT, plantilla propia)');
check('contiene la negación explícita "no es una ETT"', /no es una ETT/i.test(html));
check('niega "bolsa de profesionales/personal externo"', /bolsa de (profesionales|personal)/i.test(html));
check('afirma que planifica "tu propia plantilla"', /tu propia plantilla/i.test(html));

console.log('B · Sección de ciclo completo de planificación');
// La sección id="full-cycle" se fusionó en Funciones (commit 730e03d); lo que
// debe sobrevivir es el mensaje de planificación continuada, no el id.
check('menciona planificación continuada de plantilla propia', /planificaci[oó]n continuada|de forma continuada/i.test(html));
check('menciona "rotaciones"', /rotaciones/i.test(html));
check('menciona "gestión de ausencias" o "ausencias y vacaciones"', /(gesti[oó]n de ausencias|ausencias y vacaciones)/i.test(html));
check('menciona "reglas de convenio" o "reglas complejas"', /(reglas (complejas )?de(l)? convenio|reglas complejas)/i.test(html));
check('menciona "planificación continua(da)"', /planificaci[oó]n continua/i.test(html));

console.log('C · FAQs anti-confusión + i18n');
check('faq7 (¿ETT/marketplace?) en HTML', /data-i18n="faq7_q"/.test(html));
check('faq8 (¿empresa de ~30 con planificación continua?) en HTML', /data-i18n="faq8_q"/.test(html));
check('faq9 (¿vacaciones/ausencias/rotaciones?) en HTML', /data-i18n="faq9_q"/.test(html));
for (const lang of ['en', 'de', 'fr']) {
  const dict = html.split(new RegExp('\\b' + lang + ':\\s*\\{'))[1] || '';
  check(`traducciones faq7-9 en "${lang}"`, /faq7_q/.test(dict) && /faq8_q/.test(dict) && /faq9_q/.test(dict));
}

console.log('D · Señales para buscadores e IAs');
const llmsPath = path.join(ROOT, 'public/llms.txt');
check('existe public/llms.txt', fs.existsSync(llmsPath));
if (fs.existsSync(llmsPath)) {
  const llms = fs.readFileSync(llmsPath, 'utf8');
  check('llms.txt describe el producto como planificador', /planificaci[oó]n de turnos/i.test(llms));
  check('llms.txt desambigua (no ETT / no marketplace)', /no es una ETT|no es un marketplace/i.test(llms));
}
const ldBlocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m => m[1]);
let ldValid = ldBlocks.length > 0;
let softwareApp = null;
let faqPage = null;
for (const block of ldBlocks) {
  try {
    const parsed = JSON.parse(block);
    // Los nodos pueden venir sueltos o anidados en @graph (como en index.html).
    const nodes = Array.isArray(parsed['@graph']) ? parsed['@graph'] : [parsed];
    for (const node of nodes) {
      if (node['@type'] === 'SoftwareApplication') softwareApp = node;
      if (node['@type'] === 'FAQPage') faqPage = node;
    }
  } catch (e) { ldValid = false; }
}
check('todos los JSON-LD parsean (' + ldBlocks.length + ' bloques)', ldValid);
check('featureList incluye gestión de ausencias y vacaciones', !!softwareApp && /ausencias/i.test(softwareApp.featureList || ''));
check('featureList incluye rotaciones', !!softwareApp && /rotaciones/i.test(softwareApp.featureList || ''));
check('featureList incluye reglas de convenio', !!softwareApp && /convenio/i.test(softwareApp.featureList || ''));
check('FAQPage JSON-LD tiene ≥ 9 preguntas', !!faqPage && Array.isArray(faqPage.mainEntity) && faqPage.mainEntity.length >= 9);
const metaDesc = (html.match(/name="description" content="([^"]*)"/) || [])[1] || '';
check('meta description menciona ausencias/vacaciones/rotaciones', /ausencias/i.test(metaDesc) && /vacaciones/i.test(metaDesc) && /rotaciones/i.test(metaDesc));

console.log('E · Lenguaje de coberturas desambiguado');
check('el motor de coberturas se califica como interno/de plantilla propia', /(coberturas internas|cobertura interna|sustituciones (internas|de tu (propia )?plantilla))/i.test(html));

console.log('');
if (failures > 0) {
  console.error('FALLOS: ' + failures);
  process.exit(1);
}
console.log('Todo verde.');
