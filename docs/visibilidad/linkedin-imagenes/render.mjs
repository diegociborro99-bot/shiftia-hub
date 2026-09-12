// Renderiza cada tarjeta .html de este directorio a PNG 1200x1200 @2x.
// Las fuentes se sirven desde disco: el sandbox no llega a Google Fonts.
import { chromium } from 'playwright';
import { readFileSync, readdirSync, mkdirSync } from 'node:fs';
import { resolve, basename } from 'node:path';

const HERE = resolve('.');
const FONTS = resolve(HERE, '../fonts');
const css = readFileSync(`${FONTS}/fonts.css`, 'utf8');
const urls = readFileSync(`${FONTS}/urls.txt`, 'utf8').trim().split('\n');
const fontFor = (u) => {
  const i = urls.indexOf(u);
  return i >= 0 ? readFileSync(`${FONTS}/f${i + 1}.woff2`) : null;
};

const targets = process.argv.slice(2).length
  ? process.argv.slice(2)
  : readdirSync(HERE).filter((f) => f.endsWith('.html'));

mkdirSync(resolve(HERE, 'png'), { recursive: true });

const b = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox', '--font-render-hinting=none'],
});
const ctx = await b.newContext({
  viewport: { width: 1200, height: 1200 },
  deviceScaleFactor: 2,
  locale: 'es-ES',
});
await ctx.route('**/fonts.googleapis.com/**', (r) =>
  r.fulfill({ status: 200, contentType: 'text/css', body: css }));
await ctx.route('**/fonts.gstatic.com/**', (r) => {
  const f = fontFor(r.request().url());
  f ? r.fulfill({ status: 200, contentType: 'font/woff2', body: f }) : r.abort();
});

for (const t of targets) {
  const name = basename(t, '.html');
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + resolve(HERE, t), { waitUntil: 'load' });
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(350);
  // Comprueba que nada se sale del lienzo ni desborda su caja
  const diag = await p.evaluate(() => {
    const out = [];
    document.querySelectorAll('*').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width && (r.right > 1201 || r.bottom > 1201 || r.left < -1 || r.top < -1)) {
        out.push(`${el.tagName}.${(el.className || '').toString().split(' ')[0]} [${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.right)},${Math.round(r.bottom)}]`);
      }
      if (el.scrollHeight > el.clientHeight + 2 && getComputedStyle(el).overflow !== 'visible') {
        out.push(`RECORTADO ${el.tagName}.${(el.className || '').toString().split(' ')[0]}`);
      }
    });
    const d2 = window.__diag; const f = [...document.fonts].filter((x) => x.status === 'loaded').map((x) => x.family);
    return { fuera: [...new Set(out)], fuentes: [...new Set(f)], alto: document.body.scrollHeight, diag: d2 };
  });
  await p.screenshot({ path: resolve(HERE, 'png', name + '.png'), clip: { x: 0, y: 0, width: 1200, height: 1200 } });
  console.log(
    `${name.padEnd(22)} alto=${String(diag.alto).padStart(4)} fuentes=[${diag.fuentes.join(',')}]` +
    (diag.fuera.length ? ` ⚠ FUERA: ${diag.fuera.join(' | ')}` : ' ✓') +
    (errs.length ? ` ERR:${errs.join('|')}` : '')
  );
  if (diag.diag) console.log('   diag:', JSON.stringify(diag.diag));
  await p.close();
}
await b.close();
