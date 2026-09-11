'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { analyzeSchedule } = require('../lib/audit');
const { generateRoster } = require('../lib/roster-gen');

test('genera un cuadrante legal desde cero', () => {
  const r = generateRoster({ team_size: 7, min_staffing: { M: 2, T: 2, N: 1 }, days: 14, start_date: '2026-09-07' });
  assert.equal(r.ok, true);
  const m = analyzeSchedule(r.schedule, { sector: 'Residencias' });
  assert.equal(m.rest_violations.length, 0, 'ningún descanso por debajo del mínimo');
  assert.equal(m.consecutive_work_runs.length, 0, 'nadie encadena 7 días');
  assert.equal(m.night_streaks.length, 0, 'sin rachas de noches');
  assert.ok(m.score >= 85, `la puntuación debe ser alta, fue ${m.score}`);
});

test('cubre exactamente el mínimo pedido todos los días', () => {
  const min = { M: 3, T: 2, N: 1 };
  const r = generateRoster({ team_size: 8, min_staffing: min, days: 21, start_date: '2026-09-07' });
  assert.equal(r.ok, true);
  const perDay = new Map();
  for (const w of r.schedule.workers) {
    for (const s of w.shifts) {
      const k = s.date + '|' + s.code;
      perDay.set(k, (perDay.get(k) || 0) + 1);
    }
  }
  for (const date of r.dates) {
    for (const code of Object.keys(min)) {
      assert.equal(perDay.get(date + '|' + code), min[code], `${date} turno ${code}`);
    }
  }
});

test('reparte por igual: mismos días trabajados y mismas noches', () => {
  const r = generateRoster({ team_size: 7, min_staffing: { M: 2, T: 2, N: 1 }, days: 14, start_date: '2026-09-07' });
  const m = analyzeSchedule(r.schedule, { sector: 'Residencias' });
  assert.equal(m.nights.range, 0, 'todo el mundo hace las mismas noches');
  const worked = r.schedule.workers.map(w => w.shifts.filter(s => s.code !== 'L').length);
  assert.equal(new Set(worked).size, 1, 'todo el mundo trabaja los mismos días');
});

test('avisa cuando no hay gente suficiente en vez de inventar', () => {
  const r = generateRoster({ team_size: 4, min_staffing: { M: 2, T: 1, N: 1 } });
  assert.equal(r.ok, false);
  assert.match(r.reason, /descanso/);
  assert.equal(r.shortfall, 1, 'dice cuánta gente falta');
});

test('rechaza plantillas demasiado pequeñas', () => {
  assert.equal(generateRoster({ team_size: 2 }).ok, false);
  assert.equal(generateRoster({}).ok, false);
});

test('usa los nombres y turnos reales cuando se los damos', () => {
  const r = generateRoster({
    people: [
      { name: 'Marta', role: 'Encargada' }, { name: 'Luis', role: 'Dependiente' },
      { name: 'Eva', role: 'Dependienta' }, { name: 'Iván', role: 'Cajero' },
      { name: 'Nuria', role: 'Reponedora' }
    ],
    shifts: [
      { code: 'A', label: 'Apertura', start: '09:00', end: '15:00', is_night: false },
      { code: 'C', label: 'Cierre', start: '15:00', end: '21:30', is_night: false }
    ],
    min_staffing: { A: 2, C: 2 }, days: 14, start_date: '2026-09-07'
  });
  assert.equal(r.ok, true);
  assert.equal(r.schedule.workers[0].name, 'Marta');
  assert.equal(r.schedule.workers[0].role, 'Encargada');
  const codes = new Set(r.schedule.workers.flatMap(w => w.shifts.map(s => s.code)));
  assert.deepEqual([...codes].sort(), ['A', 'C', 'L']);
  const m = analyzeSchedule(r.schedule, { sector: 'Retail' });
  assert.equal(m.rest_violations.length, 0);
});

test('explica siempre lo que ha dado por supuesto', () => {
  const r = generateRoster({ team_size: 7, days: 14, start_date: '2026-09-07' });
  assert.equal(r.ok, true);
  assert.ok(r.assumptions.length >= 5);
  assert.ok(r.assumptions.some(a => /supuesto/i.test(a)), 'avisa de que el mínimo es supuesto');
  assert.ok(r.assumptions.some(a => /vacaciones/i.test(a)), 'avisa de lo que no se ha tenido en cuenta');
});

test('empieza en lunes cuando no se le da fecha', () => {
  const r = generateRoster({ team_size: 6, min_staffing: { M: 2, T: 2, N: 1 } });
  assert.equal(r.ok, true);
  assert.equal(new Date(r.dates[0] + 'T00:00:00Z').getUTCDay(), 1, 'el primer día es lunes');
});
