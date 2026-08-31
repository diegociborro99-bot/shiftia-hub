// Tests de la integración con Google Calendar/Meet (lib/meet.js).
// Se ejecutan con el runner nativo: `npm test` → node --test
// La API de Google se mockea vía fetchImpl inyectado — ninguna llamada real.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { getAccessToken, createMeetEvent, deleteMeetEvent } = require('../lib/meet');

const AUTH = { clientId: 'cid-1', clientSecret: 'csec-1', refreshToken: 'rtok-1' };

// fetch falso: registra llamadas y sirve respuestas en orden.
function mockFetch(responses) {
  const calls = [];
  const fn = async (url, opts = {}) => {
    calls.push({ url: String(url), opts });
    const r = responses.shift();
    if (!r) throw new Error('mockFetch: sin respuesta preparada para ' + url);
    return {
      ok: r.status >= 200 && r.status < 300,
      status: r.status,
      json: async () => (r.body || {}),
      text: async () => JSON.stringify(r.body || {})
    };
  };
  fn.calls = calls;
  return fn;
}

const EVENT_ARGS = () => ({
  auth: AUTH,
  summary: 'Llamada con Shiftia — Ana (ACME)',
  description: 'Demo personalizada',
  startUtc: new Date('2026-09-10T08:00:00Z'),
  endUtc: new Date('2026-09-10T08:30:00Z'),
  attendeeEmail: 'ana@acme.es',
  requestId: 'booking-42'
});

test('getAccessToken: envía refresh_token y devuelve access_token', async () => {
  const f = mockFetch([{ status: 200, body: { access_token: 'at-1' } }]);
  const token = await getAccessToken({ ...AUTH, fetchImpl: f });
  assert.equal(token, 'at-1');
  assert.equal(f.calls.length, 1);
  assert.ok(f.calls[0].url.includes('oauth2.googleapis.com/token'));
  const body = String(f.calls[0].opts.body);
  assert.ok(body.includes('client_id=cid-1'));
  assert.ok(body.includes('refresh_token=rtok-1'));
  assert.ok(body.includes('grant_type=refresh_token'));
});

test('getAccessToken: error HTTP → rechaza', async () => {
  const f = mockFetch([{ status: 400, body: { error: 'invalid_grant' } }]);
  await assert.rejects(() => getAccessToken({ ...AUTH, fetchImpl: f }), /400/);
});

test('createMeetEvent: crea evento con Meet y devuelve enlace + eventId', async () => {
  const f = mockFetch([
    { status: 200, body: { access_token: 'at-1' } },
    { status: 200, body: { id: 'ev-123', hangoutLink: 'https://meet.google.com/abc-defg-hij' } }
  ]);
  const r = await createMeetEvent({ ...EVENT_ARGS(), fetchImpl: f });
  assert.deepEqual(r, { meetLink: 'https://meet.google.com/abc-defg-hij', eventId: 'ev-123' });

  const call = f.calls[1];
  // El Meet solo se genera si se pide conferenceDataVersion=1; sendUpdates=none
  // evita que Google mande su propio correo al cliente (ya va el de Resend).
  assert.ok(call.url.includes('/calendars/primary/events'));
  assert.ok(call.url.includes('conferenceDataVersion=1'));
  assert.ok(call.url.includes('sendUpdates=none'));
  assert.equal(call.opts.headers.Authorization, 'Bearer at-1');

  const payload = JSON.parse(call.opts.body);
  assert.equal(payload.summary, 'Llamada con Shiftia — Ana (ACME)');
  assert.equal(payload.start.dateTime, '2026-09-10T08:00:00.000Z');
  assert.equal(payload.end.dateTime, '2026-09-10T08:30:00.000Z');
  assert.deepEqual(payload.attendees, [{ email: 'ana@acme.es' }]);
  assert.equal(payload.conferenceData.createRequest.conferenceSolutionKey.type, 'hangoutsMeet');
  assert.equal(payload.conferenceData.createRequest.requestId, 'booking-42');
});

test('createMeetEvent: calendarId con @ va URL-escapado', async () => {
  const f = mockFetch([
    { status: 200, body: { access_token: 'at-1' } },
    { status: 200, body: { id: 'ev-1', hangoutLink: 'https://meet.google.com/x' } }
  ]);
  await createMeetEvent({ ...EVENT_ARGS(), calendarId: 'demo@group.calendar.google.com', fetchImpl: f });
  assert.ok(f.calls[1].url.includes('/calendars/demo%40group.calendar.google.com/events'));
});

test('createMeetEvent: sin hangoutLink usa el entryPoint de vídeo', async () => {
  const f = mockFetch([
    { status: 200, body: { access_token: 'at-1' } },
    {
      status: 200,
      body: {
        id: 'ev-9',
        conferenceData: {
          entryPoints: [
            { entryPointType: 'phone', uri: 'tel:+34-900-000-000' },
            { entryPointType: 'video', uri: 'https://meet.google.com/zzz-zzzz-zzz' }
          ]
        }
      }
    }
  ]);
  const r = await createMeetEvent({ ...EVENT_ARGS(), fetchImpl: f });
  assert.equal(r.meetLink, 'https://meet.google.com/zzz-zzzz-zzz');
});

test('createMeetEvent: evento sin ningún enlace → rechaza', async () => {
  const f = mockFetch([
    { status: 200, body: { access_token: 'at-1' } },
    { status: 200, body: { id: 'ev-13' } }
  ]);
  await assert.rejects(() => createMeetEvent({ ...EVENT_ARGS(), fetchImpl: f }), /enlace/i);
});

test('createMeetEvent: error HTTP de Calendar → rechaza', async () => {
  const f = mockFetch([
    { status: 200, body: { access_token: 'at-1' } },
    { status: 403, body: { error: 'forbidden' } }
  ]);
  await assert.rejects(() => createMeetEvent({ ...EVENT_ARGS(), fetchImpl: f }), /403/);
});

test('deleteMeetEvent: manda DELETE autenticado al evento', async () => {
  const f = mockFetch([
    { status: 200, body: { access_token: 'at-1' } },
    { status: 204, body: {} }
  ]);
  const ok = await deleteMeetEvent({ auth: AUTH, eventId: 'ev-123', fetchImpl: f });
  assert.equal(ok, true);
  const call = f.calls[1];
  assert.equal(call.opts.method, 'DELETE');
  assert.ok(call.url.includes('/calendars/primary/events/ev-123'));
  assert.equal(call.opts.headers.Authorization, 'Bearer at-1');
});

test('deleteMeetEvent: 404/410 (ya borrado) no es error', async () => {
  for (const status of [404, 410]) {
    const f = mockFetch([
      { status: 200, body: { access_token: 'at-1' } },
      { status, body: {} }
    ]);
    const ok = await deleteMeetEvent({ auth: AUTH, eventId: 'ev-old', fetchImpl: f });
    assert.equal(ok, true, `status ${status} debe tolerarse`);
  }
});

test('deleteMeetEvent: error HTTP real → rechaza', async () => {
  const f = mockFetch([
    { status: 200, body: { access_token: 'at-1' } },
    { status: 500, body: {} }
  ]);
  await assert.rejects(() => deleteMeetEvent({ auth: AUTH, eventId: 'ev-123', fetchImpl: f }), /500/);
});
