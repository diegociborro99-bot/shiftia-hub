#!/usr/bin/env node
// Obtención (una sola vez) del GOOGLE_REFRESH_TOKEN para la integración de
// Google Meet en las reservas (lib/meet.js). Se ejecuta EN TU ORDENADOR, no
// en el servidor, porque abre un navegador y escucha en localhost.
//
// Pasos previos en https://console.cloud.google.com :
//   1. Crea (o elige) un proyecto.
//   2. "APIs y servicios" → "Biblioteca" → habilita "Google Calendar API".
//   3. "Pantalla de consentimiento OAuth" → tipo Externo → añade tu propio
//      Gmail como usuario de prueba (no hace falta publicar la app).
//   4. "Credenciales" → "Crear credenciales" → "ID de cliente de OAuth" →
//      tipo "Aplicación de escritorio". Copia el ID y el secreto.
//
// Uso:
//   GOOGLE_CLIENT_ID='...' GOOGLE_CLIENT_SECRET='...' node scripts/google-oauth-setup.mjs
//
// El script imprime una URL: ábrela, autoriza con la cuenta de Google cuyo
// calendario recibirá los eventos, y al terminar imprime las 3 variables de
// entorno listas para pegar en el servidor (Railway/Render/etc.).

import http from 'node:http';
import crypto from 'node:crypto';

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const PORT = Number(process.env.OAUTH_SETUP_PORT || 8765);
const REDIRECT_URI = `http://localhost:${PORT}/oauth2callback`;
// calendar.events basta para crear y borrar eventos (mínimo privilegio).
const SCOPE = 'https://www.googleapis.com/auth/calendar.events';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Faltan credenciales. Uso:');
  console.error("  GOOGLE_CLIENT_ID='...' GOOGLE_CLIENT_SECRET='...' node scripts/google-oauth-setup.mjs");
  console.error('Crea las credenciales (tipo "Aplicación de escritorio") en https://console.cloud.google.com/apis/credentials');
  process.exit(1);
}

const state = crypto.randomBytes(16).toString('hex');
const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
  client_id: CLIENT_ID,
  redirect_uri: REDIRECT_URI,
  response_type: 'code',
  scope: SCOPE,
  access_type: 'offline',   // imprescindible para recibir refresh_token
  prompt: 'consent',        // fuerza refresh_token aunque ya autorizaras antes
  state
}).toString();

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (url.pathname !== '/oauth2callback') {
    res.writeHead(404).end('Not found');
    return;
  }
  const code = url.searchParams.get('code');
  if (url.searchParams.get('state') !== state || !code) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Petición inválida — vuelve al terminal y reinicia el script.');
    return;
  }

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code'
      }).toString()
    });
    const data = await tokenRes.json();

    if (!tokenRes.ok || !data.refresh_token) {
      console.error('\nGoogle no devolvió refresh_token:', JSON.stringify(data, null, 2));
      console.error('Si ya habías autorizado esta app antes, revoca el acceso en');
      console.error('https://myaccount.google.com/permissions y vuelve a ejecutar el script.');
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Error — mira el terminal.');
    } else {
      console.log('\n✔ Autorización completada. Pega estas variables en tu servidor:\n');
      console.log(`GOOGLE_CLIENT_ID=${CLIENT_ID}`);
      console.log(`GOOGLE_CLIENT_SECRET=${CLIENT_SECRET}`);
      console.log(`GOOGLE_REFRESH_TOKEN=${data.refresh_token}`);
      console.log('\n(Opcional: GOOGLE_CALENDAR_ID si no quieres usar el calendario principal.)');
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Listo ✔ — vuelve al terminal, las variables están impresas ahí.');
    }
  } catch (err) {
    console.error('\nError intercambiando el código:', err.message);
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Error — mira el terminal.');
  } finally {
    server.close();
  }
});

server.listen(PORT, () => {
  console.log('1) Abre esta URL en tu navegador y autoriza con la cuenta del calendario:\n');
  console.log(authUrl);
  console.log('\n2) Al aceptar, Google te redirige a localhost y este script imprime el token.');
});
