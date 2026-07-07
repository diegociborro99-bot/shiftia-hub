// Tests del análisis determinista de cuadrantes (lib/audit.js).
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { analyzeSchedule } = require('../lib/audit');

function w(name, shifts) { return { name, shifts }; }
function s(date, code) { return { date, code }; }

test('equidad: reparto perfecto → justo, Jain 1', () => {
  const r = analyzeSchedule({
    workers: [
      w('Ana', [s('2026-07-01', 'N'), s('2026-07-03', 'N')]),
      w('Luis', [s('2026-07-02', 'N'), s('2026-07-04', 'N')])
    ]
  });
  assert.equal(r.nights.total, 4);
  assert.equal(r.nights.verdict, 'justo');
  assert.equal(r.nights.jain, 1);
  assert.deepEqual(r.nights.overloaded, []);
});

test('equidad: desigualdad grande → crítico y sobrecargado detectado', () => {
  const r = analyzeSchedule({
    workers: [
      w('Ana', [s('2026-07-01', 'N'), s('2026-07-03', 'N'), s('2026-07-05', 'N'), s('2026-07-07', 'N'), s('2026-07-09', 'N'), s('2026-07-11', 'N')]),
      w('Luis', [s('2026-07-02', 'N')]),
      w('Marta', [s('2026-07-04', 'N')])
    ]
  });
  assert.equal(r.nights.verdict, 'critico');
  assert.equal(r.nights.range, 5);
  assert.deepEqual(r.nights.overloaded, ['Ana']);
  assert.ok(r.nights.jain < 0.85);
});

test('descansos: noche seguida de mañana al día siguiente = violación de 12h', () => {
  // N termina 08:00 del día 2; M empieza 08:00 del día 2 → 0h de descanso.
  const r = analyzeSchedule({
    workers: [w('Ana', [s('2026-07-01', 'N'), s('2026-07-02', 'M')])]
  });
  assert.equal(r.rest_violations.length, 1);
  assert.equal(r.rest_violations[0].rest_hours, 0);
  assert.equal(r.rest_violations[0].missing_hours, 12);
});

test('descansos: tarde (fin 22:00) → mañana siguiente (08:00) = 10h, incumple', () => {
  const r = analyzeSchedule({
    workers: [w('Ana', [s('2026-07-01', 'T'), s('2026-07-02', 'M')])]
  });
  assert.equal(r.rest_violations.length, 1);
  assert.equal(r.rest_violations[0].rest_hours, 10);
});

test('descansos: mañana → mañana del día siguiente = 17h, cumple', () => {
  const r = analyzeSchedule({
    workers: [w('Ana', [s('2026-07-01', 'M'), s('2026-07-02', 'M')])]
  });
  assert.equal(r.rest_violations.length, 0);
});

test('descansos: los códigos de libre no cuentan como turno trabajado', () => {
  const r = analyzeSchedule({
    workers: [w('Ana', [s('2026-07-01', 'N'), s('2026-07-02', 'L'), s('2026-07-03', 'M')])]
  });
  assert.equal(r.rest_violations.length, 0);
  assert.equal(r.total_shifts, 2);
});

test('rachas: 4 noches consecutivas detectadas; 2 no', () => {
  const r = analyzeSchedule({
    workers: [
      w('Ana', [s('2026-07-01', 'N'), s('2026-07-02', 'N'), s('2026-07-03', 'N'), s('2026-07-04', 'N')]),
      w('Luis', [s('2026-07-01', 'N'), s('2026-07-02', 'N')])
    ]
  });
  assert.equal(r.night_streaks.length, 1);
  assert.equal(r.night_streaks[0].worker, 'Ana');
  assert.equal(r.night_streaks[0].length, 4);
});

test('definiciones de turno personalizadas del cuadrante se respetan', () => {
  // Turno "12" de 12h (08-20) y "NN" nocturno 20-08.
  const r = analyzeSchedule({
    shift_definitions: [
      { code: '12', start: '08:00', end: '20:00', is_night: false, is_rest: false },
      { code: 'NN', start: '20:00', end: '08:00', is_night: true, is_rest: false }
    ],
    workers: [w('Ana', [s('2026-07-01', '12'), s('2026-07-01', 'NN')])]
  });
  // 12 termina 20:00 y NN empieza 20:00 el mismo día → 0h de descanso.
  assert.equal(r.rest_violations.length, 1);
  assert.equal(r.nights.total, 1);
});

test('cuadrante vacío no explota', () => {
  const r = analyzeSchedule({ workers: [] });
  assert.equal(r.workers_count, 0);
  assert.equal(r.nights.total, 0);
  assert.equal(r.rest_violations.length, 0);
});

test('sector hostelería: 10h = revisar convenio; sanidad: 10h = incumplimiento', () => {
  const sched = { workers: [w('Ana', [s('2026-07-01', 'T'), s('2026-07-02', 'M')])] }; // 10h
  const host = analyzeSchedule(sched, { sector: 'Hostelería' });
  assert.equal(host.rest_violations[0].severity, 'revisar_convenio');
  assert.equal(host.legal_context.sector_label, 'Hostelería');
  const san = analyzeSchedule(sched, { sector: 'Sanidad / Hospital' });
  assert.equal(san.rest_violations[0].severity, 'incumplimiento');
  assert.ok(san.legal_context.legal_refs.join(' ').includes('55/2003'));
});

test('sector desconocido: régimen general, <12h = incumplimiento', () => {
  const r = analyzeSchedule({ workers: [w('Ana', [s('2026-07-01', 'T'), s('2026-07-02', 'M')])] }, { sector: 'Otro' });
  assert.equal(r.legal_context.sector_label, 'Régimen general');
  assert.equal(r.rest_violations[0].severity, 'incumplimiento');
});

test('cobertura con mínimos declarados: día por debajo del mínimo detectado', () => {
  // Noche: mínimo declarado 2. El 02-07 solo hay 1 persona de noche → hallazgo.
  const r = analyzeSchedule({
    workers: [
      w('Ana', [s('2026-07-01', 'N'), s('2026-07-02', 'N')]),
      w('Luis', [s('2026-07-01', 'N')])
    ]
  }, { minimums: { noche: 2 } });
  assert.equal(r.coverage.source, 'minimos_declarados');
  assert.equal(r.coverage.evaluated, true);
  assert.equal(r.coverage.below_minimum.length, 1);
  assert.deepEqual(r.coverage.below_minimum[0], { date: '2026-07-02', franja: 'noche', count: 1, minimum: 2 });
  // Sin mínimos declarados con 2 trabajadores no se evalúa (deducción exige ≥3).
  const sinMin = analyzeSchedule({
    workers: [w('Ana', [s('2026-07-01', 'N')]), w('Luis', [s('2026-07-01', 'N')])]
  });
  assert.equal(sinMin.coverage.evaluated, false);
  assert.equal(sinMin.coverage.source, 'deducido');
});

test('cobertura declarada: mínimos inválidos se ignoran; franjas M/T se clasifican', () => {
  const r = analyzeSchedule({
    workers: [
      w('Ana', [s('2026-07-01', 'M'), s('2026-07-02', 'T')]),
      w('Luis', [s('2026-07-01', 'T'), s('2026-07-02', 'M')])
    ]
  }, { minimums: { manana: 1, tarde: 1, noche: 0 } }); // noche:0 no es exigible → null
  assert.equal(r.coverage.below_minimum.length, 0);
  assert.equal(r.coverage.declared_minimums.noche, null);
  const conHueco = analyzeSchedule({
    workers: [w('Ana', [s('2026-07-01', 'M'), s('2026-07-02', 'M')])]
  }, { minimums: { tarde: 1 } });
  assert.equal(conHueco.coverage.below_minimum.length, 2); // ambos días sin nadie de tarde
  assert.ok(conHueco.coverage.below_minimum.every(b => b.franja === 'tarde' && b.count === 0));
});

test('encargados declarados pero no identificables en el documento → aviso', () => {
  const r = analyzeSchedule({
    workers: [w('Ana', [s('2026-07-01', 'M')]), w('Luis', [s('2026-07-01', 'T')])]
  }, { expectLeaders: true });
  assert.equal(r.roles.declared_has_leaders, true);
  assert.equal(r.roles.expected_but_not_identified, true);
  const conRol = analyzeSchedule({
    workers: [
      Object.assign(w('Ana', [s('2026-07-01', 'M')]), { role: 'Encargada' }),
      w('Luis', [s('2026-07-01', 'T'), s('2026-07-02', 'T')])
    ]
  }, { expectLeaders: true });
  assert.equal(conRol.roles.expected_but_not_identified, false);
  assert.deepEqual(conRol.roles.leaders, ['Ana']);
  assert.deepEqual(conRol.roles.days_without_leader, ['2026-07-02']);
});

test('puntuación global: cuadrante limpio ≈100, cuadrante roto baja', () => {
  const limpio = analyzeSchedule({
    workers: [
      w('Ana', [s('2026-07-01', 'N'), s('2026-07-03', 'M')]),
      w('Luis', [s('2026-07-02', 'N'), s('2026-07-04', 'M')])
    ]
  });
  assert.ok(limpio.score >= 95, 'limpio: ' + limpio.score);
  assert.equal(limpio.score_label, 'Saludable');
  const roto = analyzeSchedule({
    workers: [
      w('Ana', [s('2026-07-01', 'N'), s('2026-07-02', 'N'), s('2026-07-03', 'N'), s('2026-07-04', 'M'), s('2026-07-04', 'T')]),
      w('Luis', [s('2026-07-01', 'M')])
    ]
  });
  assert.ok(roto.score < limpio.score - 25, 'roto: ' + roto.score);
});
