'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { analyzeSchedule } = require('../lib/audit');
const { fixSchedule } = require('../lib/roster-fix');
const { buildAuditPdf } = require('../lib/audit-pdf');

function sample() {
  const names = ['Ana G.', 'Marcos R.', 'Lucía P.', 'Iván T.', 'Sara M.', 'Pablo N.'];
  const pat = [
    ['M', 'M', 'T', 'T', 'N', 'M', 'L', 'M', 'M', 'T', 'T', 'N', 'N', 'L'],
    ['M', 'T', 'N', 'L', 'L', 'M', 'T', 'T', 'N', 'L', 'M', 'M', 'T', 'N'],
    ['T', 'N', 'N', 'N', 'N', 'L', 'M', 'T', 'N', 'N', 'L', 'M', 'T', 'T'],
    ['N', 'L', 'M', 'M', 'T', 'T', 'L', 'N', 'L', 'M', 'M', 'T', 'T', 'L'],
    ['L', 'M', 'M', 'T', 'N', 'N', 'M', 'L', 'T', 'T', 'M', 'N', 'L', 'M'],
    ['T', 'T', 'L', 'M', 'M', 'L', 'T', 'N', 'M', 'L', 'N', 'L', 'M', 'T']
  ];
  return {
    workers: names.map((name, i) => ({
      name, role: i === 0 ? 'Supervisora' : 'Enfermería',
      shifts: pat[i].map((code, d) => ({ date: `2026-09-${String(7 + d).padStart(2, '0')}`, code }))
    })),
    shift_definitions: []
  };
}

const LEAD = { cleanName: 'Cliente de prueba', email: 'x@y.es', sector: 'Residencias', workers: '6' };
const SUMMARY = { headline: 'Titular del resumen.', paragraphs: ['Primer párrafo.', 'Segundo párrafo.'] };
const WHEN = '11 de septiembre de 2026, 10:00 (hora de Madrid)';

function pageCount(buf) {
  // Cuenta objetos de página del PDF sin dependencias externas
  const txt = buf.toString('latin1');
  return (txt.match(/\/Type\s*\/Page[^s]/g) || []).length;
}

test('genera el informe completo con parrilla y corrección', async () => {
  const metrics = analyzeSchedule(sample(), { sector: 'Residencias' });
  const fix = fixSchedule(sample(), { sector: 'Residencias' });
  fix.after = analyzeSchedule(fix.schedule, { sector: 'Residencias' });

  const buf = await buildAuditPdf({ metrics, summary: SUMMARY, lead: LEAD, generatedAt: WHEN, schedule: sample(), fix });
  assert.ok(Buffer.isBuffer(buf) && buf.length > 20000, 'el PDF debe tener contenido');
  assert.equal(buf.subarray(0, 5).toString(), '%PDF-', 'cabecera PDF válida');
  assert.equal(pageCount(buf), 4, 'con corrección son cuatro páginas');
});

test('genera el informe sin corrección cuando no hay nada que proponer', async () => {
  const metrics = analyzeSchedule(sample(), { sector: 'Residencias' });
  const buf = await buildAuditPdf({ metrics, summary: SUMMARY, lead: LEAD, generatedAt: WHEN, schedule: sample(), fix: null });
  assert.ok(buf.length > 15000);
  assert.equal(pageCount(buf), 3, 'sin corrección son tres páginas');
});

test('no rompe si no se puede dibujar la parrilla', async () => {
  const metrics = analyzeSchedule(sample(), { sector: 'Residencias' });
  const buf = await buildAuditPdf({ metrics, summary: SUMMARY, lead: LEAD, generatedAt: WHEN, schedule: null, fix: null });
  assert.ok(buf.length > 10000);
  assert.equal(buf.subarray(0, 5).toString(), '%PDF-');
});

test('aguanta un cuadrante de un mes con plantilla grande', async () => {
  const workers = Array.from({ length: 24 }, (_, i) => ({
    name: `Persona ${i + 1}`,
    role: i === 0 ? 'Encargado' : null,
    shifts: Array.from({ length: 31 }, (_, d) => ({
      date: `2026-10-${String(d + 1).padStart(2, '0')}`,
      code: ['M', 'M', 'T', 'T', 'N', 'L', 'L'][(i + d) % 7]
    }))
  }));
  const sched = { workers, shift_definitions: [] };
  const metrics = analyzeSchedule(sched, { sector: 'Industria' });
  const buf = await buildAuditPdf({ metrics, summary: SUMMARY, lead: LEAD, generatedAt: WHEN, schedule: sched, fix: null });
  assert.ok(buf.length > 15000, 'debe dibujar 24 personas × 31 días sin romperse');
});

test('la corrección de un cuadrante grande respeta su presupuesto de tiempo', () => {
  const workers = Array.from({ length: 30 }, (_, i) => ({
    name: `Persona ${i + 1}`,
    role: null,
    shifts: Array.from({ length: 31 }, (_, d) => ({
      date: `2026-10-${String(d + 1).padStart(2, '0')}`,
      // Patrón sucio a propósito: encadena noche y mañana
      code: ['N', 'M', 'T', 'N', 'M', 'L', 'T'][(i * 3 + d) % 7]
    }))
  }));
  const t0 = Date.now();
  const fix = fixSchedule({ workers, shift_definitions: [] }, { sector: 'Industria', maxMs: 3000 });
  const elapsed = Date.now() - t0;
  assert.ok(elapsed < 12000, `la búsqueda no puede dispararse (tardó ${elapsed} ms)`);
  assert.ok(Array.isArray(fix.changes));
});
