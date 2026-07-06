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

// Genera lista de slots HH:MM válidos del día, excluyendo el bloque de comida.
function generateDaySlots({ hourStart, hourEnd, slotMinutes, lunchBlock }) {
  const slots = [];
  for (let h = hourStart; h < hourEnd; h++) {
    for (let m = 0; m < 60; m += slotMinutes) {
      const t = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      if (!lunchBlock.includes(t)) slots.push(t);
    }
  }
  return slots;
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
  madridIsoFromLocal,
  prettyDateMadrid,
  prettyTimeMadrid,
  makeCancelToken,
  verifyCancelToken,
  buildIcs
};
