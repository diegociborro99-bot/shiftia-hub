// Corrector de cuadrantes: a partir del cuadrante que envía el cliente y de
// los incumplimientos que detecta lib/audit.js, busca el MÍNIMO conjunto de
// cambios que los arregla y devuelve la planilla corregida.
//
// Principio de diseño: solo se permiten INTERCAMBIOS DENTRO DEL MISMO DÍA
// entre dos personas. Eso garantiza por construcción que la composición de
// cada día (cuánta gente hay en cada turno) queda intacta: la corrección no
// puede descubrir un turno ni cambiar la cobertura, solo repartir distinto.
//
// La búsqueda es determinista y golosa: en cada vuelta evalúa todos los
// intercambios posibles con una función de penalización y aplica el que más
// la baja. No usa IA: la IA solo lee el documento; aquí no decide nada.
'use strict';

const { sectorRule, buildDefs, workedIntervals, absMinutes, MIN_REST_HOURS } = require('./audit');

const DAY_MS = 24 * 3600 * 1000;

// Fechas y turnos en lenguaje llano: los motivos de cada cambio los lee un
// encargado, no un programador. «2026-09-12» no le dice nada; «sábado 12», sí.
const DOW_LONG = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const SHIFT_WORD = { M: 'la mañana', T: 'la tarde', N: 'la noche' };
function humanDay(iso) {
  const d = new Date(iso + 'T00:00:00Z');
  return `${DOW_LONG[d.getUTCDay()]} ${d.getUTCDate()}`;
}
function shiftWord(code) {
  return SHIFT_WORD[String(code || '').toUpperCase()] || `el turno ${code}`;
}

// Pesos de la penalización. El orden de magnitud es lo que importa: primero
// se arreglan los incumplimientos legales duros, luego los avisos, y solo
// cuando no queda nada roto se afina la equidad.
const W = {
  restHard: 100,     // descanso por debajo del suelo del régimen
  restSoft: 30,      // descanso entre el suelo y las 12 h ("revisar convenio")
  nightStreak: 20,   // por cada noche que pase de 2 seguidas
  longRun: 50,       // por cada día que pase de 6 trabajados seguidos
  weeklyRest: 60,    // tramo de más de 14 días sin 36 h continuas
  equitySpread: 8,   // diferencia máx-mín de noches
  equityStdev: 5,    // desviación típica de noches
  contractDrift: 25  // cada día trabajado que se le añade o quita a alguien
};

const MAX_CHANGES = 24;      // tope de cambios propuestos
const MAX_ROUNDS = 60;       // tope de vueltas de la búsqueda
const MAX_MS = 8000;         // presupuesto de tiempo: un cuadrante de 60
                             // personas × 31 días no puede colgar el envío

function dateKey(d) { return new Date(d + 'T00:00:00Z').getTime(); }

// ---------------------------------------------------------------------------
// Rejilla densa persona × día. null = sin entrada (se trata como descanso).
// ---------------------------------------------------------------------------
function buildGrid(workers, dates) {
  const idx = new Map(dates.map((d, i) => [d, i]));
  return workers.map(w => {
    const row = new Array(dates.length).fill(null);
    for (const s of (w.shifts || [])) {
      if (!s || !s.date || !s.code) continue;
      const i = idx.get(s.date);
      if (i !== undefined) row[i] = String(s.code).toUpperCase();
    }
    return row;
  });
}

function rowToShifts(row, dates) {
  const out = [];
  for (let i = 0; i < row.length; i++) if (row[i] !== null) out.push({ date: dates[i], code: row[i] });
  return out;
}

// ---------------------------------------------------------------------------
// Incidencias de UNA persona. Es la misma lectura que hace lib/audit.js, pero
// aislada por fila para poder puntuar un intercambio sin re-analizar todo.
// ---------------------------------------------------------------------------
function rowIssues(row, dates, defs, rule) {
  const issues = [];
  const intervals = workedIntervals(rowToShifts(row, dates), defs);

  // Descanso entre jornadas
  for (let i = 1; i < intervals.length; i++) {
    const prev = intervals[i - 1], cur = intervals[i];
    if (cur.start <= prev.start) continue;
    const restH = (cur.start - prev.end) / 60;
    if (restH >= 0 && restH < MIN_REST_HOURS) {
      issues.push({
        kind: 'rest',
        hard: restH < rule.reduced_floor,
        date: cur.date,
        hours: Math.round(restH * 10) / 10,
        text: `el descanso de ${String(Math.round(restH * 10) / 10).replace('.', ',')} h entre ${shiftWord(prev.code)} del ${humanDay(prev.date)} y ${shiftWord(cur.code)} del ${humanDay(cur.date)}`
      });
    }
  }

  // Noches seguidas
  const nightDates = intervals.filter(x => x.is_night).map(x => x.date);
  let streak = 1;
  for (let i = 1; i <= nightDates.length; i++) {
    const consecutive = i < nightDates.length && dateKey(nightDates[i]) - dateKey(nightDates[i - 1]) === DAY_MS;
    if (consecutive) { streak++; continue; }
    if (streak >= 3) issues.push({ kind: 'night_streak', length: streak, date: nightDates[i - 1], text: `las ${streak} noches seguidas hasta el ${humanDay(nightDates[i - 1])}` });
    streak = 1;
  }

  // Días trabajados seguidos
  const workedDates = [...new Set(intervals.map(x => x.date))].sort();
  let run = 1;
  for (let i = 1; i <= workedDates.length; i++) {
    const consecutive = i < workedDates.length && dateKey(workedDates[i]) - dateKey(workedDates[i - 1]) === DAY_MS;
    if (consecutive) { run++; continue; }
    if (run >= 7) issues.push({ kind: 'long_run', length: run, date: workedDates[i - 1], text: `los ${run} días seguidos de trabajo hasta el ${humanDay(workedDates[i - 1])}` });
    run = 1;
  }

  // Descanso semanal (36 h continuas, con los bordes del periodo como descanso)
  if (intervals.length >= 4 && dates.length) {
    const marks = [absMinutes(dates[0], '00:00') - 1];
    for (let i = 1; i < intervals.length; i++) {
      if (intervals[i].start - intervals[i - 1].end >= 36 * 60) marks.push(intervals[i - 1].end);
    }
    marks.push(absMinutes(dates[dates.length - 1], '23:59') + 1);
    for (let i = 1; i < marks.length; i++) {
      if ((marks[i] - marks[i - 1]) / (24 * 60) > 14.5) {
        issues.push({ kind: 'weekly_rest', text: 'el tramo de más de 14 días sin 36 h de descanso continuo' });
        break;
      }
    }
  }
  return issues;
}

function issuesPenalty(issues) {
  let p = 0;
  for (const it of issues) {
    if (it.kind === 'rest') p += it.hard ? W.restHard : W.restSoft;
    else if (it.kind === 'night_streak') p += (it.length - 2) * W.nightStreak;
    else if (it.kind === 'long_run') p += (it.length - 6) * W.longRun;
    else if (it.kind === 'weekly_rest') p += W.weeklyRest;
  }
  return p;
}

function countNights(row, dates, defs) {
  let n = 0;
  for (const x of workedIntervals(rowToShifts(row, dates), defs)) if (x.is_night) n++;
  return n;
}

function countWorked(row, dates, defs) {
  return new Set(workedIntervals(rowToShifts(row, dates), defs).map(x => x.date)).size;
}

function equityPenalty(nights) {
  if (nights.length < 2) return 0;
  const total = nights.reduce((a, b) => a + b, 0);
  const mean = total / nights.length;
  const stdev = Math.sqrt(nights.reduce((a, v) => a + (v - mean) * (v - mean), 0) / nights.length);
  return (Math.max(...nights) - Math.min(...nights)) * W.equitySpread + stdev * W.equityStdev;
}

// ---------------------------------------------------------------------------
// Corrección
// ---------------------------------------------------------------------------
function fixSchedule(schedule, opts) {
  const options = opts || {};
  const rule = sectorRule(options.sector);
  const defs = buildDefs(schedule.shift_definitions);
  const workers = (schedule.workers || []).filter(w => w && w.name);
  const maxChanges = Number.isInteger(options.maxChanges) ? options.maxChanges : MAX_CHANGES;
  const deadline = Date.now() + (Number(options.maxMs) > 0 ? Number(options.maxMs) : MAX_MS);

  const dates = [...new Set(workers.flatMap(w => (w.shifts || []).map(s => s && s.date).filter(Boolean)))].sort();
  if (workers.length < 2 || dates.length < 2) {
    return { changed: false, changes: [], schedule, reason: 'cuadrante demasiado pequeño para proponer cambios' };
  }

  const grid = buildGrid(workers, dates);
  const original = grid.map(row => row.slice()); // para el diff neto del final
  const originalWorked = grid.map(row => countWorked(row, dates, defs));

  // ¿Quién es responsable? Solo importa si el cliente declaró que su cuadrante
  // los incluye: un intercambio no puede dejar un día sin ninguno.
  const leaderRe = /encargad|supervisor|responsable|coordinador|jefe|jefa|superviso/i;
  const isLeader = workers.map(w => leaderRe.test(String(w.role || '')));
  const guardLeaders = options.expectLeaders === true && isLeader.some(Boolean);

  function leadersOnDay(g, d) {
    let n = 0;
    for (let i = 0; i < g.length; i++) {
      if (!isLeader[i] || g[i][d] === null) continue;
      const def = defs.get(g[i][d]);
      if (def && !def.is_rest) n++;
    }
    return n;
  }

  // Estado de la búsqueda: penalización, noches y días trabajados por persona.
  // Se mantiene incrementalmente para no re-analizar todo en cada candidato.
  const rowPen = grid.map(row => issuesPenalty(rowIssues(row, dates, defs, rule)));
  const nights = grid.map(row => countNights(row, dates, defs));
  const worked = grid.map(row => countWorked(row, dates, defs));
  const swaps = []; // rastro de la búsqueda; el cliente ve el diff neto

  let timedOut = false;
  for (let round = 0; round < MAX_ROUNDS && swaps.length < maxChanges; round++) {
    if (Date.now() > deadline) { timedOut = true; break; }
    let best = null;
    const baseEquity = equityPenalty(nights);

    for (let a = 0; a < grid.length; a++) {
      for (let b = a + 1; b < grid.length; b++) {
        for (let d = 0; d < dates.length; d++) {
          const ca = grid[a][d], cb = grid[b][d];
          if (ca === cb) continue;

          // Intercambio tentativo
          grid[a][d] = cb; grid[b][d] = ca;

          let ok = true;
          if (guardLeaders && (isLeader[a] || isLeader[b])) {
            // No dejar sin responsable un día que sí lo tenía
            grid[a][d] = ca; grid[b][d] = cb;
            const before = leadersOnDay(grid, d);
            grid[a][d] = cb; grid[b][d] = ca;
            if (before > 0 && leadersOnDay(grid, d) === 0) ok = false;
          }

          if (ok) {
            const issuesA = rowIssues(grid[a], dates, defs, rule);
            const issuesB = rowIssues(grid[b], dates, defs, rule);
            const penA = issuesPenalty(issuesA), penB = issuesPenalty(issuesB);
            const nA = countNights(grid[a], dates, defs), nB = countNights(grid[b], dates, defs);
            const wA = countWorked(grid[a], dates, defs), wB = countWorked(grid[b], dates, defs);
            const nextNights = nights.slice(); nextNights[a] = nA; nextNights[b] = nB;

            // Alejarse de la carga original de cada persona cuesta: el objetivo
            // es corregir lo ilegal, no rehacer el reparto de horas.
            const driftAfter = Math.abs(wA - originalWorked[a]) + Math.abs(wB - originalWorked[b]);
            const driftBefore = Math.abs(worked[a] - originalWorked[a]) + Math.abs(worked[b] - originalWorked[b]);

            const delta = (penA + penB + equityPenalty(nextNights) + driftAfter * W.contractDrift) -
              (rowPen[a] + rowPen[b] + baseEquity + driftBefore * W.contractDrift);

            if (delta < -0.5 && (!best || delta < best.delta)) {
              best = { a, b, d, ca, cb, delta, penA, penB, nA, nB, wA, wB, issuesA, issuesB };
            }
          }

          // Deshacer
          grid[a][d] = ca; grid[b][d] = cb;
        }
      }
    }

    if (!best) break;

    // Motivo: qué incidencias desaparecen con este cambio
    const beforeA = rowIssues(grid[best.a], dates, defs, rule);
    const beforeB = rowIssues(grid[best.b], dates, defs, rule);
    grid[best.a][best.d] = best.cb; grid[best.b][best.d] = best.ca;
    const gone = diffIssues(beforeA.concat(beforeB), best.issuesA.concat(best.issuesB));

    rowPen[best.a] = best.penA; rowPen[best.b] = best.penB;
    nights[best.a] = best.nA; nights[best.b] = best.nB;
    worked[best.a] = best.wA; worked[best.b] = best.wB;

    swaps.push({
      date: dates[best.d],
      reason: gone.length ? `arregla ${gone[0].text}` : 'equilibra el reparto de noches',
      fixed: gone.map(g => g.kind)
    });
  }

  // ── Cambio NETO ───────────────────────────────────────────────────────────
  // La búsqueda puede tocar la misma celda varias veces; al cliente se le
  // enseña la diferencia entre su cuadrante y el corregido, no el rastro.
  const byDate = new Map();
  for (let i = 0; i < grid.length; i++) {
    for (let d = 0; d < dates.length; d++) {
      if (original[i][d] === grid[i][d]) continue;
      const date = dates[d];
      if (!byDate.has(date)) byDate.set(date, { date, moves: [], reasons: [], fixed: new Set() });
      byDate.get(date).moves.push({ worker: workers[i].name, from: original[i][d], to: grid[i][d] });
    }
  }
  for (const s of swaps) {
    const entry = byDate.get(s.date);
    if (!entry) continue; // el intercambio acabó revertido: no se enseña
    if (!entry.reasons.includes(s.reason)) entry.reasons.push(s.reason);
    for (const k of s.fixed) entry.fixed.add(k);
  }
  const changes = [...byDate.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(e => ({
      date: e.date,
      moves: e.moves,
      reason: e.reasons[0] || 'equilibra el reparto de noches',
      reasons: e.reasons,
      fixed: [...e.fixed]
    }));

  const fixed = {
    workers: workers.map((w, i) => ({ name: w.name, role: w.role || null, shifts: rowToShifts(grid[i], dates) })),
    shift_definitions: schedule.shift_definitions || [],
    period: schedule.period || (dates.length ? { start: dates[0], end: dates[dates.length - 1] } : null)
  };

  return { changed: changes.length > 0, changes, schedule: fixed, dates, timedOut };
}

// Incidencias que estaban antes y ya no están (comparación por texto).
function diffIssues(before, after) {
  const afterKeys = new Set(after.map(i => i.kind + '|' + (i.text || '')));
  const out = [];
  for (const i of before) {
    const k = i.kind + '|' + (i.text || '');
    if (!afterKeys.has(k)) out.push(i);
  }
  // Primero lo más grave
  const order = { rest: 0, long_run: 1, weekly_rest: 2, night_streak: 3 };
  return out.sort((x, y) => (order[x.kind] ?? 9) - (order[y.kind] ?? 9));
}

module.exports = { fixSchedule, rowIssues, buildGrid, rowToShifts, humanDay };
