// Tests de la lógica pura de reservas (lib/booking.js).
// Se ejecutan con el runner nativo: `npm test` → node --test
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  escHtml,
  generateDaySlots,
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
