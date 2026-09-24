// Tests de la lógica pura de reservas (lib/booking.js).
// Se ejecutan con el runner nativo: `npm test` → node --test
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  escHtml,
  generateDaySlots,
  parseWindows,
  partialClosureSlots,
  expandClosure,
  madridIsoFromLocal,
  prettyTimeMadrid,
  makeCancelToken,
  verifyCancelToken,
  buildIcs
} = require('../lib/booking');

const CFG = { hourStart: 9, hourEnd: 18, slotMinutes: 30, lunchBlock: ['14:00', '14:30', '15:00'] };

test('generateDaySlots: rango, paso y bloque de comida', () => {
  const slots = generateDaySlots(CFG);
  assert.equal(slots[0], '09:00');
  assert.equal(slots[slots.length - 1], '17:30');
  assert.ok(!slots.includes('14:00'), 'excluye comida 14:00');
  assert.ok(!slots.includes('14:30'), 'excluye comida 14:30');
  assert.ok(!slots.includes('15:00'), 'excluye comida 15:00');
  assert.ok(slots.includes('15:30'), 'la tarde reabre a las 15:30');
  // 9 horas * 2 slots - 3 de comida = 15
  assert.equal(slots.length, 15);
  assert.ok(!slots.includes('18:00'), 'hourEnd es exclusivo');
});

test('generateDaySlots: paso de 60 minutos', () => {
  const slots = generateDaySlots({ ...CFG, slotMinutes: 60 });
  assert.deepEqual(slots.slice(0, 3), ['09:00', '10:00', '11:00']);
  assert.ok(!slots.includes('09:30'));
});

test('parseWindows: tramos válidos, ordenados, y basura descartada', () => {
  assert.deepEqual(parseWindows('10:00-12:30,16:00-17:30'),
    [{ start: 600, end: 750 }, { start: 960, end: 1050 }]);
  assert.deepEqual(parseWindows('16:00-17:30, 10:00-12:30'),
    [{ start: 600, end: 750 }, { start: 960, end: 1050 }], 'se ordenan por hora de inicio');
  assert.deepEqual(parseWindows(''), [], 'vacío = sin ventanas');
  assert.deepEqual(parseWindows('12:00-10:00'), [], 'fin antes que inicio');
  assert.deepEqual(parseWindows('10:00'), [], 'sin guion');
  assert.deepEqual(parseWindows('10:70-12:00'), [], 'minutos imposibles');
  assert.deepEqual(parseWindows('10:00-12:00,basura'), [{ start: 600, end: 720 }],
    'un tramo roto no se lleva por delante a los buenos');
});

test('generateDaySlots: las dos ventanas de atención reales', () => {
  const slots = generateDaySlots({ ...CFG, windows: parseWindows('10:00-12:30,16:00-17:30') });
  assert.deepEqual(slots, ['10:00', '10:30', '11:00', '11:30', '12:00', '16:00', '16:30', '17:00']);
  assert.equal(slots.length, 8, '8 huecos al día, no 15');
  assert.ok(!slots.includes('12:30'), 'el fin de ventana es exclusivo: la de 12:00 acaba a las 12:30');
  assert.ok(!slots.includes('09:00'), 'fuera de ventana por abajo');
  assert.ok(!slots.includes('13:00'), 'el hueco entre ventanas no se ofrece');
  assert.ok(!slots.includes('17:30'), 'fuera de ventana por arriba');
});

test('generateDaySlots: sin ventanas se comporta como antes', () => {
  assert.deepEqual(generateDaySlots({ ...CFG, windows: [] }), generateDaySlots(CFG));
  assert.equal(generateDaySlots({ ...CFG, windows: [] }).length, 15);
});

test('generateDaySlots: las ventanas se alinean al paso y no se solapan', () => {
  // Una ventana que empieza a y cuarto no debe sacar el día de la retícula.
  assert.deepEqual(generateDaySlots({ ...CFG, windows: parseWindows('10:15-11:30') }),
    ['10:30', '11:00']);
  // Tramos solapados no duplican horas.
  assert.deepEqual(generateDaySlots({ ...CFG, windows: parseWindows('10:00-11:00,10:30-11:30') }),
    ['10:00', '10:30', '11:00']);
});

const VENTANAS = generateDaySlots({ ...CFG, windows: parseWindows('10:00-12:30,16:00-17:30') });

test('partialClosureSlots: cierra el día a partir de una hora', () => {
  const fuera = partialClosureSlots('2026-09-30', [{ date: '2026-09-30', from: '12:00' }], VENTANAS);
  assert.deepEqual([...fuera].sort(), ['12:00', '16:00', '16:30', '17:00'],
    'a partir de las 12 se van las 12:00 y toda la tarde');
  const quedan = VENTANAS.filter((t) => !fuera.has(t));
  assert.deepEqual(quedan, ['10:00', '10:30', '11:00', '11:30'], 'la mañana sigue abierta');
});

test('partialClosureSlots: from es inclusivo y to exclusivo', () => {
  const f = partialClosureSlots('2026-09-30', [{ date: '2026-09-30', from: '11:00', to: '16:30' }], VENTANAS);
  assert.ok(f.has('11:00'), 'la hora de inicio entra en el cierre');
  assert.ok(!f.has('16:30'), 'la hora de fin queda fuera');
  assert.deepEqual([...f].sort(), ['11:00', '11:30', '12:00', '16:00']);
});

test('partialClosureSlots: solo afecta a su día y aguanta la basura', () => {
  const cierres = [{ date: '2026-09-30', from: '12:00' }];
  assert.equal(partialClosureSlots('2026-10-01', cierres, VENTANAS).size, 0, 'otro día no se toca');
  assert.equal(partialClosureSlots('2026-09-30', [], VENTANAS).size, 0);
  assert.equal(partialClosureSlots('2026-09-30', null, VENTANAS).size, 0);
  for (const malo of [{ date: '2026-09-30', from: '25:00' }, { date: '2026-09-30', from: 'tarde' },
                      { date: '2026-09-30', from: '16:00', to: '10:00' }, null]) {
    assert.equal(partialClosureSlots('2026-09-30', [malo], VENTANAS).size, 0,
      'un cierre mal escrito se ignora en vez de tumbar el arranque');
  }
});

test('partialClosureSlots: sin from cierra el día entero', () => {
  const f = partialClosureSlots('2026-09-30', [{ date: '2026-09-30' }], VENTANAS);
  assert.equal(f.size, VENTANAS.length);
});

test('expandClosure: incluye los dos extremos', () => {
  const dias = expandClosure({ from: '2026-10-17', to: '2026-10-27', reason: 'Viaje' });
  assert.equal(dias.length, 11, '11 días naturales, del 17 al 27 inclusive');
  assert.deepEqual(dias[0], ['2026-10-17', 'Viaje']);
  assert.deepEqual(dias[dias.length - 1], ['2026-10-27', 'Viaje']);
  assert.equal(new Set(dias.map(d => d[0])).size, 11, 'sin fechas repetidas');
});

test('expandClosure: el cambio de hora de octubre no parte el rango', () => {
  // El 25-oct-2026 los relojes atrasan y ese día dura 25 h. Avanzar por
  // milisegundos se saltaría un día o lo duplicaría; avanzar por fecha no.
  const dias = expandClosure({ from: '2026-10-23', to: '2026-10-27', reason: 'x' }).map(d => d[0]);
  assert.deepEqual(dias, ['2026-10-23', '2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27']);
});

test('expandClosure: un solo día y rango invertido', () => {
  assert.deepEqual(expandClosure({ from: '2026-05-04', to: '2026-05-04', reason: 'a' }),
    [['2026-05-04', 'a']]);
  assert.deepEqual(expandClosure({ from: '2026-05-10', to: '2026-05-04', reason: 'a' }), [],
    'to anterior a from no genera días');
  assert.deepEqual(expandClosure({ from: 'no-es-fecha', to: '2026-05-04', reason: 'a' }), [],
    'una fecha inválida no cuelga el arranque');
});

test('madridIsoFromLocal: horario de invierno (CET, UTC+1)', () => {
  // 15 de enero, 10:00 en Madrid = 09:00 UTC
  const d = madridIsoFromLocal('2026-01-15', '10:00');
  assert.equal(d.toISOString(), '2026-01-15T09:00:00.000Z');
});

test('madridIsoFromLocal: horario de verano (CEST, UTC+2)', () => {
  // 15 de julio, 10:00 en Madrid = 08:00 UTC
  const d = madridIsoFromLocal('2026-07-15', '10:00');
  assert.equal(d.toISOString(), '2026-07-15T08:00:00.000Z');
});

test('madridIsoFromLocal: día del cambio de hora de primavera', () => {
  // El 29-mar-2026 a las 02:00 CET los relojes saltan a las 03:00 CEST.
  // Antes del cambio: 01:00 local = 00:00 UTC (offset +1).
  const antes = madridIsoFromLocal('2026-03-29', '01:00');
  assert.equal(antes.toISOString(), '2026-03-29T00:00:00.000Z');
  // Después del cambio: 10:00 local = 08:00 UTC (offset +2).
  const despues = madridIsoFromLocal('2026-03-29', '10:00');
  assert.equal(despues.toISOString(), '2026-03-29T08:00:00.000Z');
});

test('prettyTimeMadrid: redondea al muro horario de Madrid', () => {
  const d = new Date('2026-07-15T08:00:00.000Z'); // = 10:00 en Madrid (verano)
  assert.equal(prettyTimeMadrid(d), '10:00');
});

test('cancel token: firma estable y verificación', () => {
  const secret = 'test-secret';
  const t = makeCancelToken(42, 'ana@example.com', secret);
  assert.equal(t.length, 32);
  assert.equal(t, makeCancelToken(42, 'ana@example.com', secret), 'determinista');
  assert.ok(verifyCancelToken(42, 'ana@example.com', t, secret));
});

test('cancel token: rechaza manipulaciones sin lanzar', () => {
  const secret = 'test-secret';
  const t = makeCancelToken(42, 'ana@example.com', secret);
  assert.equal(verifyCancelToken(43, 'ana@example.com', t, secret), false, 'otro id');
  assert.equal(verifyCancelToken(42, 'eva@example.com', t, secret), false, 'otro email');
  assert.equal(verifyCancelToken(42, 'ana@example.com', t, 'otro-secreto'), false, 'otro secreto');
  assert.equal(verifyCancelToken(42, 'ana@example.com', '', secret), false, 'token vacío');
  // Longitud distinta: el timingSafeEqual nativo lanzaría; el wrapper debe devolver false.
  assert.equal(verifyCancelToken(42, 'ana@example.com', 'corto', secret), false, 'longitud distinta');
});

test('escHtml: neutraliza los 4 caracteres peligrosos', () => {
  assert.equal(escHtml('<img src=x onerror="a&b">'), '&lt;img src=x onerror=&quot;a&amp;b&quot;&gt;');
  assert.equal(escHtml(null), '');
  assert.equal(escHtml(undefined), '');
});

test('buildIcs: estructura válida y campos saneados', () => {
  const ics = buildIcs({
    uid: 'reminder-7',
    startUtc: new Date('2026-07-15T08:00:00.000Z'),
    endUtc: new Date('2026-07-15T08:30:00.000Z'),
    summary: 'Llamada; con, saltos\nde línea',
    description: 'línea1\nlínea2, y; puntos',
    location: 'Teléfono',
    organizerEmail: 'info@shiftia.es',
    attendeeEmail: 'ana@example.com'
  });
  assert.ok(ics.startsWith('BEGIN:VCALENDAR'));
  assert.ok(ics.includes('DTSTART:20260715T080000Z'));
  assert.ok(ics.includes('DTEND:20260715T083000Z'));
  assert.ok(ics.includes('UID:reminder-7@shiftia.es'));
  assert.ok(!/SUMMARY:.*[,;]/.test(ics), 'SUMMARY sin , ni ; sin escapar');
  assert.ok(ics.includes('DESCRIPTION:línea1\\nlínea2'), 'saltos escapados como \\n');
  assert.ok(ics.endsWith('END:VCALENDAR'));
});
