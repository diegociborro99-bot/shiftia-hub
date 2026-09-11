// Generador de cuadrantes a partir de condiciones descritas en texto.
//
// Se usa cuando el cliente pide la auditoría SIN adjuntar cuadrante: con lo
// que cuenta en el formulario (cuánta gente, qué turnos, cuántos hacen falta
// por franja) se le construye una propuesta en vez de dejarle sin nada.
//
// Construcción: un ciclo rotatorio del tamaño de la plantilla, ordenado
// mañana → tarde → noche → libres. Tiene tres propiedades que lo hacen
// defendible sin depender de ninguna búsqueda:
//   · la cobertura de cada día es EXACTAMENTE el mínimo pedido, todos los días;
//   · todo el mundo trabaja el mismo número de días y hace las mismas noches;
//   · las transiciones son legales por orden (nunca tarde→mañana ni noche→algo
//     que no sea descanso), siempre que quede al menos un día libre en el ciclo.
//
// Si con la gente declarada no salen las cuentas, no se inventa nada: se
// devuelve el motivo exacto para decírselo al cliente.
'use strict';

const DEFAULT_SHIFTS = [
  { code: 'M', label: 'Mañana', start: '08:00', end: '15:00', is_night: false },
  { code: 'T', label: 'Tarde', start: '15:00', end: '22:00', is_night: false },
  { code: 'N', label: 'Noche', start: '22:00', end: '08:00', is_night: true }
];

const DOW_LONG = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

function addDays(iso, n) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Lunes de la semana que viene, para que la propuesta empiece en un lunes.
function nextMonday(from) {
  const d = from ? new Date(from + 'T00:00:00Z') : new Date();
  const iso = d.toISOString().slice(0, 10);
  const dow = new Date(iso + 'T00:00:00Z').getUTCDay();
  return addDays(iso, dow === 1 ? 7 : (8 - dow) % 7 || 7);
}

function defaultNames(n) {
  return Array.from({ length: n }, (_, i) => `Persona ${i + 1}`);
}

/**
 * @param {object} cond  Condiciones interpretadas del texto del cliente.
 *   people        [{name, role}] o null
 *   team_size     nº de personas si no hay nombres
 *   shifts        [{code,label,start,end,is_night}] o null → mañana/tarde/noche
 *   min_staffing  {M,T,N} personas necesarias en cada franja
 *   days          nº de días a generar (por defecto 14)
 *   start_date    YYYY-MM-DD (por defecto, el próximo lunes)
 */
function generateRoster(cond) {
  const c = cond || {};
  const shifts = (Array.isArray(c.shifts) && c.shifts.length ? c.shifts : DEFAULT_SHIFTS)
    .filter(s => s && s.code && s.start && s.end)
    .map(s => ({
      code: String(s.code).toUpperCase(),
      label: s.label || String(s.code).toUpperCase(),
      start: s.start,
      end: s.end,
      is_night: !!s.is_night
    }));
  if (!shifts.length) return { ok: false, reason: 'no hay ningún turno con horario definido' };

  const names = Array.isArray(c.people) && c.people.length
    ? c.people.map(p => String(p && p.name ? p.name : '').trim()).filter(Boolean)
    : defaultNames(Math.max(0, Number(c.team_size) || 0));
  const roles = Array.isArray(c.people) && c.people.length
    ? c.people.map(p => (p && p.role) || null)
    : names.map(() => null);
  const n = names.length;
  if (n < 3) return { ok: false, reason: 'hacen falta al menos 3 personas para proponer una rotación' };

  // Mínimo por franja: lo declarado, o 1 por turno si no se dijo nada.
  const min = {};
  let needed = 0;
  for (const s of shifts) {
    const v = c.min_staffing ? Number(c.min_staffing[s.code]) : NaN;
    min[s.code] = Number.isInteger(v) && v >= 0 ? v : 1;
    needed += min[s.code];
  }
  if (needed === 0) return { ok: false, reason: 'no se ha podido interpretar cuánta gente hace falta en cada turno' };

  // Con la gente declarada tiene que sobrar al menos un día libre en el ciclo:
  // si no, alguien trabajaría todos los días y la noche enlazaría con la mañana.
  const free = n - needed;
  if (free < 1) {
    return {
      ok: false,
      reason: `con ${n} personas y un mínimo de ${needed} por día no queda ningún día de descanso en la rotación`,
      shortfall: needed - n + 1,
      needed,
      team: n
    };
  }

  // Ciclo: primero las mañanas, luego las tardes, luego las noches y al final
  // los libres. Ese orden es el que hace legales todas las transiciones.
  const cycle = [];
  for (const s of shifts) for (let i = 0; i < min[s.code]; i++) cycle.push(s.code);
  for (let i = 0; i < free; i++) cycle.push('L');

  const days = Math.max(7, Math.min(31, Number(c.days) || 14));
  const start = c.start_date || nextMonday();
  const dates = Array.from({ length: days }, (_, d) => addDays(start, d));

  const workers = names.map((name, i) => ({
    name,
    role: roles[i],
    shifts: dates.map((date, d) => ({ date, code: cycle[(i + d) % n] }))
  }));

  const schedule = {
    workers,
    shift_definitions: shifts.map(s => ({ code: s.code, label: s.label, start: s.start, end: s.end, is_night: s.is_night, is_rest: false }))
      .concat([{ code: 'L', label: 'Libre', start: null, end: null, is_night: false, is_rest: true }]),
    period: { start: dates[0], end: dates[dates.length - 1] }
  };

  const perPerson = {
    worked_days: cycle.filter(x => x !== 'L').length,
    free_days: free,
    nights: shifts.filter(s => s.is_night).reduce((a, s) => a + min[s.code], 0)
  };

  // Una rotación de longitud múltiplo de 7 se repite igual cada semana: quien
  // libra un sábado libra todos. Es una limitación real de la rotación simple
  // y hay que decirla, no esconderla.
  const weekendsRotate = n % 7 !== 0;

  return {
    ok: true,
    schedule,
    cycle,
    dates,
    weekendsRotate,
    assumptions: buildAssumptions({ n, shifts, min, free, perPerson, days, start, declaredMin: !!c.min_staffing, namedPeople: Array.isArray(c.people) && c.people.length > 0, weekendsRotate })
  };
}

// Lo que se ha dado por supuesto, escrito para que el cliente pueda
// corregirlo de un vistazo. Sin esto la propuesta no es honesta.
function buildAssumptions({ n, shifts, min, free, perPerson, days, start, declaredMin, namedPeople, weekendsRotate }) {
  const out = [];
  out.push(`Plantilla de ${n} personas${namedPeople ? '' : ', sin nombres: aparecen como «Persona 1», «Persona 2»…'}`);
  out.push(`Turnos: ${shifts.map(s => `${s.label} ${s.start}–${s.end}`).join(' · ')}`);
  out.push(declaredMin
    ? `Mínimo por día tal como nos lo contaste: ${shifts.map(s => `${min[s.code]} en ${s.label.toLowerCase()}`).join(', ')}`
    : `Mínimo por día supuesto (no lo indicaste): ${shifts.map(s => `${min[s.code]} en ${s.label.toLowerCase()}`).join(', ')}`);
  out.push(`Rotación de ${n} días: cada persona trabaja ${perPerson.worked_days} días y libra ${free}, con ${perPerson.nights} ${perPerson.nights === 1 ? 'noche' : 'noches'} por vuelta`);
  out.push(`${days} días generados a partir del ${DOW_LONG[new Date(start + 'T00:00:00Z').getUTCDay()]} ${new Date(start + 'T00:00:00Z').getUTCDate()}`);
  if (!weekendsRotate) {
    out.push(`Aviso: con ${n} personas la rotación se repite igual cada semana, así que los fines de semana caen siempre en las mismas. Corregirlo necesita romper el ciclo, que es justo lo que hace Shiftia con tus datos reales.`);
  }
  out.push('Sin vacaciones, bajas, reducciones de jornada ni festivos: no nos los diste. Con esos datos el cuadrante cambia.');
  return out;
}

module.exports = { generateRoster, DEFAULT_SHIFTS, nextMonday };
