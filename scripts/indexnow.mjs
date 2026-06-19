#!/usr/bin/env node
/**
 * IndexNow — notifica a Bing (y otros motores compatibles) que re-rastreen
 * las URLs indicadas. Bing alimenta la búsqueda de ChatGPT, así que esto
 * acelera que los asistentes de IA vean el contenido actual.
 *
 * Uso:
 *   node scripts/indexnow.mjs                 # envía la lista por defecto
 *   node scripts/indexnow.mjs /ruta /otra     # envía rutas concretas
 *
 * El fichero de clave debe estar publicado en:
 *   https://www.shiftia.es/<KEY>.txt   (con <KEY> como contenido)
 */
const HOST = 'www.shiftia.es';
const KEY = '3c1c4e6279a7f50315edcfc561fa3417';
const KEY_LOCATION = `https://${HOST}/${KEY}.txt`;

const DEFAULT_PATHS = [
  '/',
  '/demo',
  '/recursos',
  '/recursos/descanso-minimo-entre-turnos',
  '/recursos/calculadora-equidad-nocturna',
  '/recursos/excel-vs-software-turnos',
  '/docs',
  '/llms.txt',
];

const paths = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_PATHS;
const urlList = paths.map((p) => `https://${HOST}${p.startsWith('/') ? p : '/' + p}`);

const payload = { host: HOST, key: KEY, keyLocation: KEY_LOCATION, urlList };

const res = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify(payload),
});

console.log(`IndexNow -> ${res.status} ${res.statusText}`);
console.log(`Enviadas ${urlList.length} URLs:`);
urlList.forEach((u) => console.log('  ' + u));
if (res.status >= 200 && res.status < 300) {
  console.log('OK: Bing ha aceptado la notificación (202 = en cola).');
} else {
  console.log('Aviso: revisa que ' + KEY_LOCATION + ' esté publicado y accesible.');
  process.exitCode = 1;
}
