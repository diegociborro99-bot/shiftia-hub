'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { analyzeSchedule } = require('../lib/audit');
const { fixSchedule } = require('../lib/roster-fix');

// Cuadrante de 6 personas × 14 días con problemas sembrados a propósito:
// noche→mañana (descanso 0 h), tarde→mañana (10 h), 4 noches seguidas y
// reparto de noches muy desigual.
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
      name,
      role: i === 0 ? 'Supervisora' : 'Enfermería',
      shifts: pat[i].map((code, d) => ({ date: `2026-09-${String(7 + d).padStart(2, '0')}`, code }))
    })),
    shift_definitions: []
  };
}

const OPTS = { sector: 'sanidad' };

test('el cuadrante de partida tiene incumplimientos que arreglar', () => {
  const m = analyzeSchedule(sample(), OPTS);
  assert.ok(m.rest_violations.length > 0, 'debe haber descansos por debajo del mínimo');
  assert.ok(m.night_streaks.length > 0, 'debe haber rachas de noches');
});

test('la corrección reduce los incumplimientos y no empeora ninguno', () => {
  const before = analyzeSchedule(sample(), OPTS);
  const fix = fixSchedule(sample(), OPTS);
  const after = analyzeSchedule(fix.schedule, OPTS);

  assert.ok(fix.changed, 'debe proponer algún cambio');
  assert.ok(after.rest_violations.length < before.rest_violations.length, 'menos descansos incumplidos');
  assert.ok(after.night_streaks.length <= before.night_streaks.length, 'no más rachas de noches');
  assert.ok(after.consecutive_work_runs.length <= before.consecutive_work_runs.length, 'no más rachas de días');
  assert.ok(after.score >= before.score, 'la puntuación no puede bajar');
});

test('la cobertura diaria queda intacta: mismos turnos cada día', () => {
  const orig = sample();
  const fix = fixSchedule(sample(), OPTS);

  function perDay(schedule) {
    const map = new Map();
    for (const w of schedule.workers) {
      for (const s of w.shifts) {
        const key = s.date + '|' + s.code;
        map.set(key, (map.get(key) || 0) + 1);
      }
    }
    return map;
  }
  const a = perDay(orig), b = perDay(fix.schedule);
  assert.equal(a.size, b.size, 'mismas combinaciones día/turno');
  for (const [k, v] of a) assert.equal(b.get(k), v, `mismo recuento en ${k}`);
});

test('cada día de cambio es una permutación: lo que suelta uno lo recoge otro', () => {
  const fix = fixSchedule(sample(), OPTS);
  assert.ok(fix.changes.length > 0);
  for (const c of fix.changes) {
    assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(c.date));
    assert.ok(c.reason && c.reason.length > 5, 'cada día lleva motivo');
    assert.ok(c.moves.length >= 2, 'un cambio afecta al menos a dos personas');
    const salen = c.moves.map(m => m.from).sort();
    const entran = c.moves.map(m => m.to).sort();
    assert.deepEqual(salen, entran, `el ${c.date} no es una permutación`);
  }
});

test('los cambios que se enseñan son el diff neto contra el cuadrante original', () => {
  const orig = sample();
  const fix = fixSchedule(sample(), OPTS);
  const origCode = new Map();
  for (const w of orig.workers) for (const s of w.shifts) origCode.set(w.name + '|' + s.date, s.code);
  const fixCode = new Map();
  for (const w of fix.schedule.workers) for (const s of w.shifts) fixCode.set(w.name + '|' + s.date, s.code);

  const reales = new Set();
  for (const [k, v] of origCode) if (fixCode.get(k) !== v) reales.add(k);
  const anunciados = new Set();
  for (const c of fix.changes) for (const m of c.moves) anunciados.add(m.worker + '|' + c.date);

  assert.deepEqual([...anunciados].sort(), [...reales].sort(), 'ni cambios ocultos ni anunciados de más');
  // Ninguna persona aparece dos veces el mismo día
  for (const c of fix.changes) {
    const w = c.moves.map(m => m.worker);
    assert.equal(new Set(w).size, w.length, `alguien repetido el ${c.date}`);
  }
});

test('nadie gana ni pierde más de un día de trabajo', () => {
  const orig = sample();
  const fix = fixSchedule(sample(), OPTS);
  const workedOf = (schedule) => new Map(schedule.workers.map(w => [
    w.name, w.shifts.filter(s => !['L', 'D', 'V'].includes(s.code)).length
  ]));
  const a = workedOf(orig), b = workedOf(fix.schedule);
  for (const [name, n] of a) {
    assert.ok(Math.abs(b.get(name) - n) <= 1, `${name}: la carga no puede moverse más de un día`);
  }
});

test('respeta el tope de cambios pedido', () => {
  const fix = fixSchedule(sample(), { ...OPTS, maxChanges: 2 });
  assert.ok(fix.changes.length <= 2);
});

test('no propone nada con un cuadrante demasiado pequeño', () => {
  const fix = fixSchedule({ workers: [{ name: 'Solo', shifts: [{ date: '2026-09-07', code: 'M' }] }] }, OPTS);
  assert.equal(fix.changed, false);
  assert.equal(fix.changes.length, 0);
});

test('un cuadrante ya correcto no se toca', () => {
  // Rotación limpia: M M T T N L L, desplazada por persona.
  const cyc = ['M', 'M', 'T', 'T', 'N', 'L', 'L'];
  const workers = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((name, i) => ({
    name,
    role: null,
    shifts: Array.from({ length: 14 }, (_, d) => ({
      date: `2026-09-${String(7 + d).padStart(2, '0')}`,
      code: cyc[(i + d) % 7]
    }))
  }));
  const m = analyzeSchedule({ workers, shift_definitions: [] }, OPTS);
  assert.equal(m.rest_violations.length, 0, 'el cuadrante de control debe estar limpio');
  const fix = fixSchedule({ workers, shift_definitions: [] }, OPTS);
  assert.equal(fix.changes.length, 0, 'sin incumplimientos no hay nada que cambiar');
});

test('no deja un día sin responsable cuando el cliente declara que los hay', () => {
  const orig = sample();
  const fix = fixSchedule(sample(), { ...OPTS, expectLeaders: true });
  const leaderDays = (schedule) => new Set(
    schedule.workers.filter(w => /supervisor/i.test(String(w.role || '')))
      .flatMap(w => w.shifts.filter(s => !['L', 'D', 'V'].includes(s.code)).map(s => s.date))
  );
  const before = leaderDays(orig);
  const after = leaderDays(fix.schedule);
  for (const d of before) assert.ok(after.has(d), `el ${d} se queda sin responsable`);
});
