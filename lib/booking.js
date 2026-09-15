// Lógica pura de reservas (slots, timezone Madrid/DST, tokens de cancelación,
// .ics y escape HTML). Sin estado ni dependencias de Express/Postgres para
// poder testearla de forma aislada (ver test/booking.test.js).
'use strict';

const crypto = require('crypto');

// Escape HTML para todo texto de usuario reflejado en emails/HTML.
const escHtml = (str) => String(str || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

// Ventanas de atención del día: 'HH:MM-HH:MM,HH:MM-HH:MM'. El final es
// exclusivo, así que 16:00-17:30 ofrece 16:00, 16:30 y 17:00 — la última
// llamada empieza a y media y termina a las 17:30. Un tramo mal escrito se
// descarta en silencio en vez de tumbar el arranque; si no queda ninguno,
// generateDaySlots vuelve al rango continuo de siempre.
function parseWindows(str) {
  return String(str || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((tramo) => {
      const m = tramo.match(/^(\d{1,2}):([0-5]\d)-(\d{1,2}):([0-5]\d)$/);
      if (!m) return null;
      const start = Number(m[1]) * 60 + Number(m[2]);
      const end = Number(m[3]) * 60 + Number(m[4]);
      if (start >= end || end > 24 * 60) return null;
      return { start, end };
    })
    .filter(Boolean)
    .sort((a, b) => a.start - b.start);
}

// Genera la lista de horas HH:MM que se ofrecen en un día. Con `windows` usa
// esos tramos; sin ellas, el rango continuo hourStart→hourEnd menos el bloque
// de comida. Única fuente de verdad: el POST de reserva valida contra esta
// misma lista en vez de repetir el horario por su cuenta.
function generateDaySlots({ hourStart, hourEnd, slotMinutes, lunchBlock, windows }) {
  const paso = slotMinutes;
  const bloqueadas = lunchBlock || [];
  const hhmm = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
  const tramos = (windows && windows.length)
    ? windows
    : [{ start: hourStart * 60, end: hourEnd * 60 }];

  const slots = [];
  for (const { start, end } of tramos) {
    // Alineado al paso: una ventana que empiece a y cuarto no debe sacar el
    // día de la retícula de :00 y :30 del resto de tramos.
    for (let m = Math.ceil(start / paso) * paso; m < end; m += paso) {
      const t = hhmm(m);
      if (!bloqueadas.includes(t) && !slots.includes(t)) slots.push(t);
    }
  }
  return slots;
}

// Expande un cierre de agenda {from, to} a fechas YYYY-MM-DD sueltas, con los
// dos extremos incluidos. Avanza a mediodía UTC para que ningún cambio de hora
// se coma o duplique un día por el camino.
function expandClosure({ from, to, reason }) {
  const out = [];
  const end = new Date(to + 'T12:00:00Z');
  if (isNaN(end) || isNaN(new Date(from + 'T12:00:00Z'))) return out;
  for (let d = new Date(from + 'T12:00:00Z'); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    out.push([d.toISOString().slice(0, 10), reason]);
  }
  return out;
}

// Offset (en minutos) de una zona horaria en un instante dado, vía Intl.
function tzOffsetMinutes(instant, timeZone) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'shortOffset',
    year: 'numeric'
  });
  const offTok = fmt.formatToParts(instant).find(p => p.type === 'timeZoneName').value; // p. ej. "GMT+2"
  const m = offTok.match(/GMT([+-])(\d+)(?::(\d+))?/);
  const sign = m && m[1] === '-' ? -1 : 1;
  const hh = m ? Number(m[2]) : 0;
  const mm = m && m[3] ? Number(m[3]) : 0;
  return sign * (hh * 60 + mm);
}

// Construye el instante UTC real de una fecha/hora local de Madrid.
// Maneja DST sin libs externas usando Intl.DateTimeFormat, con el algoritmo de
// dos pasadas: el offset debe evaluarse en el instante corregido, no en el
// adivinado — si no, la hora previa al cambio de reloj sale desplazada 1 h.
function madridIsoFromLocal(dateStr /* YYYY-MM-DD */, timeStr /* HH:MM */, timeZone = 'Europe/Madrid') {
  const utcGuess = new Date(dateStr + 'T' + timeStr + ':00Z');
  const off1 = tzOffsetMinutes(utcGuess, timeZone);
  let result = new Date(utcGuess.getTime() - off1 * 60000);
  const off2 = tzOffsetMinutes(result, timeZone);
  if (off2 !== off1) result = new Date(utcGuess.getTime() - off2 * 60000);
  return result;
}

function prettyDateMadrid(d, timeZone = 'Europe/Madrid') {
  return new Intl.DateTimeFormat('es-ES', {
    timeZone,
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  }).format(d);
}

function prettyTimeMadrid(d, timeZone = 'Europe/Madrid') {
  return new Intl.DateTimeFormat('es-ES', {
    timeZone, hour: '2-digit', minute: '2-digit', hour12: false
  }).format(d);
}

// Token de cancelación HMAC firmado — no se persiste, se valida on-demand.
function makeCancelToken(bookingId, email, secret) {
  const payload = `${bookingId}.${email}`;
  return crypto.createHmac('sha256', secret).update(payload).digest('hex').slice(0, 32);
}

function verifyCancelToken(bookingId, email, token, secret) {
  if (!token) return false;
  const expected = makeCancelToken(bookingId, email, secret);
  const a = Buffer.from(String(token));
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// .ics para Google/Outlook/Apple
function buildIcs({ uid, startUtc, endUtc, summary, description, location, organizerEmail, attendeeEmail }) {
  const fmt = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Shiftia//Booking//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${uid}@shiftia.es`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(startUtc)}`,
    `DTEND:${fmt(endUtc)}`,
    `SUMMARY:${summary.replace(/[\n,;]/g, ' ')}`,
    `DESCRIPTION:${(description || '').replace(/\n/g, '\\n').replace(/[,;]/g, ' ')}`,
    `LOCATION:${(location || '').replace(/[,;]/g, ' ')}`,
    `ORGANIZER;CN=Shiftia:mailto:${organizerEmail}`,
    `ATTENDEE;CN=${attendeeEmail};RSVP=TRUE:mailto:${attendeeEmail}`,
    'STATUS:CONFIRMED',
    'BEGIN:VALARM',
    'TRIGGER:-PT15M',
    'ACTION:DISPLAY',
    'DESCRIPTION:Recordatorio',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR'
  ];
  return lines.join('\r\n');
}

module.exports = {
  escHtml,
  generateDaySlots,
  parseWindows,
  expandClosure,
  madridIsoFromLocal,
  prettyDateMadrid,
  prettyTimeMadrid,
  makeCancelToken,
  verifyCancelToken,
  buildIcs
};
