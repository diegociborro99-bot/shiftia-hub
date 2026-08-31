// Integración con Google Calendar para generar enlaces de Google Meet por
// reserva. Sin dependencias: usa el fetch nativo de Node 18+. fetchImpl es
// inyectable para testear sin red (ver test/meet.test.js).
//
// Requiere credenciales OAuth de la cuenta Google del organizador
// (client_id + client_secret + refresh_token) — ver scripts/google-oauth-setup.mjs.
// Un service account NO sirve para Meet sin Google Workspace con delegación.
'use strict';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const CALENDAR_API = 'https://www.googleapis.com/calendar/v3';
const DEFAULT_TIMEOUT_MS = 5000;

// Intercambia el refresh_token por un access_token efímero (~1 h).
// El volumen de reservas es bajo, así que no se cachea (YAGNI).
async function getAccessToken({ clientId, clientSecret, refreshToken, fetchImpl = fetch, timeoutMs = DEFAULT_TIMEOUT_MS }) {
  const res = await fetchImpl(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    }).toString(),
    signal: AbortSignal.timeout(timeoutMs)
  });
  if (!res.ok) throw new Error(`Google OAuth HTTP ${res.status}`);
  const data = await res.json();
  if (!data.access_token) throw new Error('Respuesta de Google OAuth sin access_token');
  return data.access_token;
}

// Crea un evento en el calendario del organizador con sala de Meet incluida.
// Devuelve { meetLink, eventId }. sendUpdates=none: el cliente ya recibe el
// correo de confirmación propio (Resend) — Google no debe duplicarlo.
async function createMeetEvent({
  auth,
  calendarId = 'primary',
  summary,
  description,
  startUtc,
  endUtc,
  timeZone = 'Europe/Madrid',
  attendeeEmail,
  requestId,
  fetchImpl = fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS
}) {
  const accessToken = await getAccessToken({ ...auth, fetchImpl, timeoutMs });
  const url = `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events?conferenceDataVersion=1&sendUpdates=none`;
  const res = await fetchImpl(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      summary,
      description,
      start: { dateTime: startUtc.toISOString(), timeZone },
      end: { dateTime: endUtc.toISOString(), timeZone },
      attendees: attendeeEmail ? [{ email: attendeeEmail }] : [],
      conferenceData: {
        createRequest: { requestId, conferenceSolutionKey: { type: 'hangoutsMeet' } }
      },
      reminders: { useDefault: true }
    }),
    signal: AbortSignal.timeout(timeoutMs)
  });
  if (!res.ok) throw new Error(`Google Calendar HTTP ${res.status}`);
  const ev = await res.json();
  const videoEntry = ev.conferenceData && Array.isArray(ev.conferenceData.entryPoints)
    ? ev.conferenceData.entryPoints.find(p => p.entryPointType === 'video')
    : null;
  const meetLink = ev.hangoutLink || (videoEntry && videoEntry.uri) || null;
  if (!meetLink) throw new Error('Evento creado pero sin enlace de Meet');
  return { meetLink, eventId: ev.id };
}

// Borra el evento (cancelación de reserva). 404/410 = ya no existe → OK.
async function deleteMeetEvent({ auth, calendarId = 'primary', eventId, fetchImpl = fetch, timeoutMs = DEFAULT_TIMEOUT_MS }) {
  const accessToken = await getAccessToken({ ...auth, fetchImpl, timeoutMs });
  const url = `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}?sendUpdates=none`;
  const res = await fetchImpl(url, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(timeoutMs)
  });
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    throw new Error(`Google Calendar delete HTTP ${res.status}`);
  }
  return true;
}

module.exports = { getAccessToken, createMeetEvent, deleteMeetEvent };
