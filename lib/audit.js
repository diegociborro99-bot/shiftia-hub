// Análisis determinista de cuadrantes para la auditoría gratuita.
// La IA solo EXTRAE el cuadrante a esta estructura; todos los hallazgos
// (equidad, descansos, rachas) se calculan aquí con matemática verificable
// para que el diagnóstico no pueda contener números inventados.
//
// Estructura de entrada (la produce la extracción con Claude):
// {
//   period: { start: 'YYYY-MM-DD', end: 'YYYY-MM-DD' } | null,
//   shift_definitions: [{ code, start: 'HH:MM', end: 'HH:MM', is_night, is_rest }],
//   workers: [{ name, shifts: [{ date: 'YYYY-MM-DD', code }] }]
// }
'use strict';

// Definiciones por defecto si el cuadrante no especifica horarios.
const DEFAULT_SHIFT_DEFS = [
  { code: 'M', start: '08:00', end: '15:00', is_night: false, is_rest: false },
  { code: 'T', start: '15:00', end: '22:00', is_night: false, is_rest: false },
  { code: 'N', start: '22:00', end: '08:00', is_night: true, is_rest: false },
  { code: 'L', start: null, end: null, is_night: false, is_rest: true },
  { code: 'D', start: null, end: null, is_night: false, is_rest: true },
  { code: 'V', start: null, end: null, is_night: false, is_rest: true }
];

const MIN_REST_HOURS = 12; // art. 34.3 ET

// Regímenes de descanso por sector — tabla CURADA (nunca la genera la IA).
// reduced_floor: suelo absoluto que algunos regímenes especiales permiten con
// compensación (RD 1561/1995). Entre reduced_floor y 12h se clasifica como
// "revisar convenio/compensación"; por debajo, incumplimiento en todo caso.
const SECTOR_RULES = [
  {
    match: /sanidad|hospital|salud|cl[ií]nica/i,
    label: 'Sanidad',
    min_rest: 12,
    reduced_floor: 12,
    refs: ['art. 34.3 del Estatuto de los Trabajadores', 'art. 51 y ss. de la Ley 55/2003 (Estatuto Marco del personal sanitario)'],
    note: 'En sanidad pública aplica el Estatuto Marco (12 h de descanso entre jornadas); en privada, el ET y el convenio del centro. Vigilar también el cómputo de jornada con guardias.'
  },
  {
    match: /residencia|dependencia|sociosanitari/i,
    label: 'Residencias / atención a la dependencia',
    min_rest: 12,
    reduced_floor: 12,
    refs: ['art. 34.3 del Estatuto de los Trabajadores', 'convenio estatal de servicios de atención a personas dependientes'],
    note: 'El convenio estatal del sector mantiene el descanso de 12 h; algunos convenios autonómicos añaden límites de noches consecutivas.'
  },
  {
    match: /hosteler|restaura|hotel|bar\b|caf[eé]/i,
    label: 'Hostelería',
    min_rest: 10,
    reduced_floor: 10,
    refs: ['art. 34.3 del Estatuto de los Trabajadores', 'RD 1561/1995 de jornadas especiales (permite reducir a 10 h con compensación en hostelería)'],
    note: 'En hostelería el descanso puede reducirse hasta 10 h con compensación (RD 1561/1995); entre 10 y 12 h conviene verificar que el convenio lo ampara y que existe la compensación.'
  },
  {
    match: /seguridad|vigilan/i,
    label: 'Seguridad privada',
    min_rest: 12,
    reduced_floor: 10,
    refs: ['art. 34.3 del Estatuto de los Trabajadores', 'convenio estatal de empresas de seguridad', 'RD 1561/1995 de jornadas especiales'],
    note: 'El convenio estatal de seguridad regula cómputos anuales y servicios especiales; descansos entre 10 y 12 h requieren amparo expreso del convenio.'
  },
  {
    match: /industria|f[aá]brica|producci[oó]n|manufact/i,
    label: 'Industria',
    min_rest: 12,
    reduced_floor: 12,
    refs: ['art. 34.3 del Estatuto de los Trabajadores', 'RD 1561/1995 para trabajo a turnos (el descanso puede computarse en periodos de hasta 4 semanas en régimen de turnos)'],
    note: 'En trabajo a turnos el RD 1561/1995 permite flexibilizar el cómputo, pero el descanso de 12 h entre jornadas sigue siendo la referencia por defecto.'
  },
  {
    match: /retail|supermercado|comercio|tienda/i,
    label: 'Comercio / retail',
    min_rest: 12,
    reduced_floor: 12,
    refs: ['art. 34.3 del Estatuto de los Trabajadores', 'convenio de comercio aplicable (provincial o de empresa)'],
    note: 'Rige el descanso general de 12 h; los convenios de comercio suelen regular además los descansos semanales y domingos/festivos.'
  }
];

const DEFAULT_SECTOR_RULE = {
  label: 'Régimen general',
  min_rest: 12,
  reduced_floor: 12,
  refs: ['art. 34.3 del Estatuto de los Trabajadores'],
  note: 'Aplicado el régimen general de 12 h entre el fin de una jornada y el inicio de la siguiente. Si tu convenio establece condiciones especiales, indícalo y lo incorporamos al análisis.'
};

function sectorRule(sector) {
  const s = String(sector || '');
  for (const r of SECTOR_RULES) if (r.match.test(s)) return r;
  return DEFAULT_SECTOR_RULE;
}

function toMinutes(hhmm) {
  const [h, m] = String(hhmm).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

// Instante absoluto (minutos desde época arbitraria) de una fecha+hora.
// Tratamos todo como reloj de pared uniforme: para diferencias entre turnos
// del mismo cuadrante es exacto salvo el día del cambio de hora (±1h, aceptable
// para un diagnóstico y señalado en los supuestos del informe).
function absMinutes(dateStr, hhmm) {
  const d = new Date(dateStr + 'T00:00:00Z');
  return d.getTime() / 60000 + toMinutes(hhmm);
}

function buildDefs(shiftDefinitions) {
  const map = new Map();
  for (const d of DEFAULT_SHIFT_DEFS) map.set(d.code.toUpperCase(), d);
  for (const d of shiftDefinitions || []) {
    if (!d || !d.code) continue;
    map.set(String(d.code).toUpperCase(), {
      code: String(d.code).toUpperCase(),
      start: d.start || null,
      end: d.end || null,
      is_night: !!d.is_night,
      is_rest: !!d.is_rest || (!d.start && !d.end && !d.is_night)
    });
  }
  return map;
}

// Convierte los turnos de un trabajador a intervalos [startMin, endMin] ordenados.
function workedIntervals(shifts, defs) {
  const out = [];
  for (const s of shifts || []) {
    if (!s || !s.date || !s.code) continue;
    const def = defs.get(String(s.code).toUpperCase());
    if (!def || def.is_rest || !def.start || !def.end) continue;
    const start = absMinutes(s.date, def.start);
    let end = absMinutes(s.date, def.end);
    if (end <= start) end += 24 * 60; // turno que cruza medianoche (noche)
    out.push({ date: s.date, code: def.code, start, end, is_night: def.is_night });
  }
  out.sort((a, b) => a.start - b.start);
  return out;
}

function round1(x) { return Math.round(x * 10) / 10; }
function round2(x) { return Math.round(x * 100) / 100; }

// Índice de Jain: 1 = reparto perfecto; <0.85 empieza a ser desigual.
function jainIndex(values) {
  const n = values.length;
  if (!n) return 1;
  const sum = values.reduce((a, b) => a + b, 0);
  const sumSq = values.reduce((a, b) => a + b * b, 0);
  if (sumSq === 0) return 1;
  return (sum * sum) / (n * sumSq);
}

function analyzeSchedule(schedule, opts) {
  const rule = sectorRule(opts && opts.sector);
  const defs = buildDefs(schedule.shift_definitions);
  const workers = (schedule.workers || []).filter(w => w && w.name);
  // Mínimos de personal por franja declarados en el formulario (certeza del
  // cliente, no deducción): { manana, tarde, noche } con null = no declarado.
  const declaredMin = {};
  for (const k of ['manana', 'tarde', 'noche']) {
    const v = opts && opts.minimums ? Number(opts.minimums[k]) : NaN;
    declaredMin[k] = Number.isInteger(v) && v >= 1 && v <= 99 ? v : null;
  }
  const hasDeclaredMin = Object.values(declaredMin).some(v => v !== null);
  const expectLeaders = opts && typeof opts.expectLeaders === 'boolean' ? opts.expectLeaders : null;

  // --- Equidad nocturna ---
  const nightsPerWorker = workers.map(w => ({
    name: w.name,
    nights: (w.shifts || []).filter(s => {
      const def = s && s.code ? defs.get(String(s.code).toUpperCase()) : null;
      return def && def.is_night;
    }).length
  })).sort((a, b) => b.nights - a.nights);

  const nightCounts = nightsPerWorker.map(x => x.nights);
  const totalNights = nightCounts.reduce((a, b) => a + b, 0);
  const mean = nightCounts.length ? totalNights / nightCounts.length : 0;
  const variance = nightCounts.length
    ? nightCounts.reduce((a, b) => a + (b - mean) * (b - mean), 0) / nightCounts.length
    : 0;
  const stdev = Math.sqrt(variance);
  const min = nightCounts.length ? Math.min(...nightCounts) : 0;
  const max = nightCounts.length ? Math.max(...nightCounts) : 0;
  const overloaded = nightsPerWorker
    .filter(x => nightCounts.length > 1 && x.nights > mean + stdev && x.nights > mean + 0.5)
    .map(x => x.name);

  let equityVerdict = 'justo';
  if (stdev >= 1.5 || max - min > 3) equityVerdict = 'critico';
  else if (stdev >= 0.8 || max - min > 2) equityVerdict = 'mejorable';

  // --- Descansos mínimos entre turnos ---
  const restViolations = [];
  for (const w of workers) {
    const intervals = workedIntervals(w.shifts, defs);
    for (let i = 1; i < intervals.length; i++) {
      const prev = intervals[i - 1];
      const cur = intervals[i];
      if (cur.start <= prev.start) continue; // duplicado o solape raro: no evaluable
      const restH = (cur.start - prev.end) / 60;
      if (restH >= 0 && restH < MIN_REST_HOURS) {
        // severidad según el régimen del sector: por debajo del suelo del
        // régimen especial = incumplimiento; entre el suelo y 12h = revisar
        // convenio/compensación (solo existe la zona gris si el sector la tiene).
        const severity = restH < rule.reduced_floor ? 'incumplimiento' : 'revisar_convenio';
        restViolations.push({
          worker: w.name,
          from: `${prev.code} ${prev.date}`,
          to: `${cur.code} ${cur.date}`,
          rest_hours: round1(restH),
          missing_hours: round1(MIN_REST_HOURS - restH),
          severity
        });
      }
    }
  }

  // --- Rachas de noches consecutivas (≥3) ---
  const nightStreaks = [];
  for (const w of workers) {
    const nightDates = (w.shifts || [])
      .filter(s => {
        const def = s && s.code ? defs.get(String(s.code).toUpperCase()) : null;
        return def && def.is_night && s.date;
      })
      .map(s => s.date)
      .sort();
    let streak = 1;
    for (let i = 1; i <= nightDates.length; i++) {
      const prev = new Date(nightDates[i - 1] + 'T00:00:00Z');
      const cur = i < nightDates.length ? new Date(nightDates[i] + 'T00:00:00Z') : null;
      const consecutive = cur && (cur - prev) === 24 * 3600 * 1000;
      if (consecutive) {
        streak++;
      } else {
        if (streak >= 3) {
          nightStreaks.push({ worker: w.name, end_date: nightDates[i - 1], length: streak });
        }
        streak = 1;
      }
    }
  }

  // --- Utilidades comunes de fechas del periodo ---
  const allDates = [];
  for (const w of workers) for (const s of (w.shifts || [])) if (s && s.date) allDates.push(s.date);
  allDates.sort();
  const periodStart = allDates[0] || null;
  const periodEnd = allDates[allDates.length - 1] || null;
  const dayMs = 24 * 3600 * 1000;
  const periodDays = periodStart ? Math.round((new Date(periodEnd + 'T00:00:00Z') - new Date(periodStart + 'T00:00:00Z')) / dayMs) + 1 : 0;
  function eachPeriodDate(fn) {
    if (!periodStart) return;
    for (let d = new Date(periodStart + 'T00:00:00Z'); d <= new Date(periodEnd + 'T00:00:00Z'); d = new Date(d.getTime() + dayMs)) {
      fn(d.toISOString().slice(0, 10), d.getUTCDay());
    }
  }
  function workedDates(w) {
    const set = new Set();
    for (const s of (w.shifts || [])) {
      const def = s && s.code ? defs.get(String(s.code).toUpperCase()) : null;
      if (def && !def.is_rest && def.start && s.date) set.add(s.date);
    }
    return [...set].sort();
  }

  // --- Días de trabajo consecutivos (≥7 sin librar) ---
  const longRuns = [];
  for (const w of workers) {
    const dates = workedDates(w);
    let run = 1;
    for (let i = 1; i <= dates.length; i++) {
      const consecutive = i < dates.length &&
        (new Date(dates[i] + 'T00:00:00Z') - new Date(dates[i - 1] + 'T00:00:00Z')) === dayMs;
      if (consecutive) run++;
      else {
        if (run >= 7) longRuns.push({ worker: w.name, length: run, end_date: dates[i - 1] });
        run = 1;
      }
    }
  }

  // --- Descanso semanal (art. 37.1 ET: 36h continuas, acumulable en 14 días) ---
  // Se buscan huecos de descanso continuo ≥36h; si entre dos de ellos pasan
  // más de 14 días, ese tramo carece del descanso semanal exigible. Los bordes
  // del periodo se tratan como descanso (beneficio de la duda: no inventamos).
  const weeklyRestIssues = [];
  for (const w of workers) {
    const intervals = workedIntervals(w.shifts, defs);
    if (intervals.length < 4 || !periodStart) continue;
    const restMarks = [absMinutes(periodStart, '00:00') - 1]; // borde inicial = descanso
    for (let i = 1; i < intervals.length; i++) {
      const gap = intervals[i].start - intervals[i - 1].end;
      if (gap >= 36 * 60) restMarks.push(intervals[i - 1].end);
    }
    restMarks.push(absMinutes(periodEnd, '23:59') + 1); // borde final = descanso
    for (let i = 1; i < restMarks.length; i++) {
      const spanDays = (restMarks[i] - restMarks[i - 1]) / (24 * 60);
      if (spanDays > 14.5) {
        weeklyRestIssues.push({ worker: w.name, days_without_weekly_rest: Math.round(spanDays) });
        break; // un aviso por persona basta
      }
    }
  }

  // --- Cobertura por turno y día ---
  // Dos modos: con mínimos declarados en el formulario se compara cada día
  // contra ese suelo (hallazgo certero); sin ellos, solo se señala lo
  // deducible del propio cuadrante: turnos que la mayoría de días tienen
  // gente y algún día quedan a cero (hueco) o muy por debajo de lo habitual.
  const coverage = { empty_slots: [], low_slots: [], below_minimum: [], evaluated: false, source: 'deducido', declared_minimums: hasDeclaredMin ? declaredMin : null };
  const franjaOf = def => def.is_night ? 'noche' : (toMinutes(def.start) < 12 * 60 ? 'manana' : 'tarde');
  if (hasDeclaredMin && periodStart) {
    coverage.evaluated = true;
    coverage.source = 'minimos_declarados';
    const perDate = new Map();
    eachPeriodDate(date => perDate.set(date, { manana: 0, tarde: 0, noche: 0 }));
    for (const w of workers) for (const s of (w.shifts || [])) {
      const def = s && s.code ? defs.get(String(s.code).toUpperCase()) : null;
      if (def && !def.is_rest && def.start && s.date && perDate.has(s.date)) {
        perDate.get(s.date)[franjaOf(def)]++;
      }
    }
    for (const [date, counts] of perDate) {
      for (const franja of ['manana', 'tarde', 'noche']) {
        const min = declaredMin[franja];
        if (min !== null && counts[franja] < min) {
          coverage.below_minimum.push({ date, franja, count: counts[franja], minimum: min });
        }
      }
    }
    coverage.below_minimum.sort((a, b) => a.date.localeCompare(b.date));
  } else if (workers.length >= 3 && periodDays >= 5) {
    coverage.evaluated = true;
    const codes = [...defs.values()].filter(d => !d.is_rest && d.start).map(d => d.code);
    const usedCodes = new Set();
    for (const w of workers) for (const s of (w.shifts || [])) {
      const def = s && s.code ? defs.get(String(s.code).toUpperCase()) : null;
      if (def && !def.is_rest && def.start) usedCodes.add(def.code);
    }
    for (const code of codes) {
      if (!usedCodes.has(code)) continue;
      const counts = new Map();
      eachPeriodDate(date => counts.set(date, 0));
      for (const w of workers) for (const s of (w.shifts || [])) {
        if (s && s.date && s.code && String(s.code).toUpperCase() === code && counts.has(s.date)) {
          counts.set(s.date, counts.get(s.date) + 1);
        }
      }
      const vals = [...counts.values()].sort((a, b) => a - b);
      const median = vals[Math.floor(vals.length / 2)];
      if (median >= 1) {
        for (const [date, n] of counts) {
          if (n === 0) coverage.empty_slots.push({ date, code, habitual: median });
          else if (median >= 2 && n < median / 2) coverage.low_slots.push({ date, code, count: n, habitual: median });
        }
      }
    }
    coverage.empty_slots.sort((a, b) => a.date.localeCompare(b.date));
    coverage.low_slots.sort((a, b) => a.date.localeCompare(b.date));
  }

  // --- Reparto de fines de semana ---
  const weekendPerWorker = workers.map(w => ({
    name: w.name,
    weekend_shifts: (w.shifts || []).filter(s => {
      const def = s && s.code ? defs.get(String(s.code).toUpperCase()) : null;
      if (!def || def.is_rest || !def.start || !s.date) return false;
      const dow = new Date(s.date + 'T00:00:00Z').getUTCDay();
      return dow === 0 || dow === 6;
    }).length
  })).sort((a, b) => b.weekend_shifts - a.weekend_shifts);
  const wkCounts = weekendPerWorker.map(x => x.weekend_shifts);
  const wkTotal = wkCounts.reduce((a, b) => a + b, 0);
  const wkMean = wkCounts.length ? wkTotal / wkCounts.length : 0;
  const wkMax = wkCounts.length ? Math.max(...wkCounts) : 0;
  const wkMin = wkCounts.length ? Math.min(...wkCounts) : 0;
  const weekendOverloaded = wkTotal >= 4
    ? weekendPerWorker.filter(x => x.weekend_shifts > wkMean + 1.5).map(x => x.name)
    : [];

  // --- Rotación antihoraria (N→T, T→M, N→M en días consecutivos) ---
  // La rotación regresiva es la que más rompe el descanso circadiano.
  const rank = def => def.is_night ? 3 : (toMinutes(def.start) < 12 * 60 ? 1 : 2);
  const backwardRotations = [];
  for (const w of workers) {
    const byDate = new Map();
    for (const s of (w.shifts || [])) {
      const def = s && s.code ? defs.get(String(s.code).toUpperCase()) : null;
      if (def && !def.is_rest && def.start && s.date) byDate.set(s.date, def);
    }
    const dates = [...byDate.keys()].sort();
    let count = 0;
    for (let i = 1; i < dates.length; i++) {
      if ((new Date(dates[i] + 'T00:00:00Z') - new Date(dates[i - 1] + 'T00:00:00Z')) !== dayMs) continue;
      if (rank(byDate.get(dates[i])) < rank(byDate.get(dates[i - 1]))) count++;
    }
    if (count > 0) backwardRotations.push({ worker: w.name, count });
  }
  backwardRotations.sort((a, b) => b.count - a.count);
  const backwardTotal = backwardRotations.reduce((a, b) => a + b.count, 0);

  // --- Roles: días sin ningún responsable ---
  // El formulario pregunta si el cuadrante incluye encargados (expectLeaders);
  // si el documento trae la categoría, se cruza contra los días del periodo.
  const LEADER_RE = /encargad|supervis|responsab|coordinad|jef/i;
  const rolesFound = [...new Set(workers.map(w => (w.role || '').trim()).filter(Boolean))];
  const leaders = workers.filter(w => LEADER_RE.test(w.role || ''));
  const daysWithoutLeader = [];
  if (leaders.length && periodStart) {
    const leaderDays = new Set();
    for (const w of leaders) for (const d of workedDates(w)) leaderDays.add(d);
    eachPeriodDate(date => { if (!leaderDays.has(date)) daysWithoutLeader.push(date); });
  }
  // Declaró que hay encargados pero el documento no permite identificarlos:
  // se avisa en vez de callar (certeza sobre lo que NO se pudo evaluar).
  const leadersExpectedNotFound = expectLeaders === true && leaders.length === 0;

  // --- Totales ---
  const shiftsPerWorker = workers.map(w => ({
    name: w.name,
    worked: workedIntervals(w.shifts, defs).length
  }));
  const totalShifts = shiftsPerWorker.reduce((a, b) => a + b.worked, 0);

  // Puntuación global 0-100 (determinista) sobre las 8 dimensiones:
  // 25 equidad nocturna · 25 descansos entre turnos · 10 rachas de noches ·
  // 10 descanso semanal · 10 días consecutivos · 10 cobertura · 10 fines de semana.
  const hard = restViolations.filter(v => v.severity === 'incumplimiento').length;
  const soft = restViolations.length - hard;
  // Además del recuento absoluto, pesa la fracción de plantilla afectada:
  // 2 violaciones en un equipo de 2 es mucho más grave que en uno de 30.
  const affectedWorkers = new Set(restViolations.map(v => v.worker)).size;
  const affectedShare = workers.length ? affectedWorkers / workers.length : 0;
  const restFactor = Math.max(0, 1 - (hard * 0.15 + soft * 0.05) - affectedShare * 0.5);
  const streakFactor = Math.max(0, 1 - nightStreaks.length * 0.25);
  const weeklyFactor = Math.max(0, 1 - weeklyRestIssues.length * 0.34);
  const consecFactor = Math.max(0, 1 - longRuns.length * 0.34);
  const coverageFactor = !coverage.evaluated ? 1
    : coverage.source === 'minimos_declarados'
      ? Math.max(0, 1 - coverage.below_minimum.reduce((a, b) => a + (b.count === 0 ? 0.2 : 0.1), 0))
      : Math.max(0, 1 - (coverage.empty_slots.length * 0.2 + coverage.low_slots.length * 0.08));
  // Con menos de 4 turnos de finde la "equidad" no es estadísticamente significativa.
  const weekendFactor = wkTotal >= 4 ? jainIndex(wkCounts) : 1;
  const score = Math.max(3, Math.round(
    25 * jainIndex(nightCounts) + 25 * restFactor + 10 * streakFactor +
    10 * weeklyFactor + 10 * consecFactor + 10 * coverageFactor + 10 * weekendFactor
  ));
  let scoreLabel = 'Crítico';
  if (score >= 85) scoreLabel = 'Saludable';
  else if (score >= 65) scoreLabel = 'Con margen de mejora';
  else if (score >= 40) scoreLabel = 'Necesita intervención';

  return {
    workers_count: workers.length,
    total_shifts: totalShifts,
    score,
    score_label: scoreLabel,
    nights: {
      total: totalNights,
      per_worker: nightsPerWorker,
      mean: round2(mean),
      stdev: round2(stdev),
      range: max - min,
      min,
      max,
      jain: round2(jainIndex(nightCounts)),
      overloaded,
      verdict: equityVerdict
    },
    rest_violations: restViolations,
    night_streaks: nightStreaks,
    weekly_rest_issues: weeklyRestIssues,
    consecutive_work_runs: longRuns,
    coverage,
    weekends: {
      total: wkTotal,
      per_worker: weekendPerWorker,
      mean: round2(wkMean),
      range: wkMax - wkMin,
      jain: round2(jainIndex(wkCounts)),
      overloaded: weekendOverloaded
    },
    backward_rotations: { total: backwardTotal, per_worker: backwardRotations.slice(0, 10) },
    roles: {
      found: rolesFound,
      leaders: leaders.map(w => w.name),
      days_without_leader: daysWithoutLeader,
      declared_has_leaders: expectLeaders,
      expected_but_not_identified: leadersExpectedNotFound
    },
    period: periodStart ? { start: periodStart, end: periodEnd, days: periodDays } : null,
    legal_context: {
      sector_label: rule.label,
      min_rest_hours: MIN_REST_HOURS,
      reduced_floor_hours: rule.reduced_floor,
      // El descanso semanal (dimensión propia del análisis) siempre se ancla
      // al art. 37.1 ET, sea cual sea el sector.
      legal_refs: rule.refs.concat(['art. 37.1 del Estatuto de los Trabajadores (descanso semanal de 36 h, acumulable en 14 días)']),
      note: rule.note
    },
    assumptions: {
      min_rest_hours: MIN_REST_HOURS,
      shift_definitions: [...defs.values()].filter(d => !d.is_rest && d.start)
        .map(d => `${d.code} ${d.start}-${d.end}${d.is_night ? ' (noche)' : ''}`)
    }
  };
}

module.exports = { analyzeSchedule, sectorRule, DEFAULT_SHIFT_DEFS, MIN_REST_HOURS };
