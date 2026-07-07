// Secuencia de seguimiento (nurture) para leads de herramientas gratuitas.
//
// Tres correos automáticos tras captar el email (auditoría o calculadoras):
//   día 2  → recordatorio de valor: qué cuesta arreglar a mano
//   día 5  → cómo lo resuelve Shiftia (hechos del producto, sin humo)
//   día 10 → cierre honesto ("breakup"): última nota, sin presión
//
// Principios: nada de clientes ni cifras inventadas; solo afirmaciones que ya
// hace la web pública. Siempre con enlace de baja firmado (HMAC) — un clic y
// no se envía nada más a ese email.
'use strict';

const crypto = require('crypto');

// stage = número de correo (1..3); afterDays cuenta desde created_at del lead.
// minGapDays evita ráfagas cuando un lead entra ya "vencido" (p. ej. si el
// escáner estuvo caído): entre correo y correo pasan al menos 2 días.
const STEPS = [
  { stage: 1, afterDays: 2 },
  { stage: 2, afterDays: 5 },
  { stage: 3, afterDays: 10 }
];
const MIN_GAP_DAYS = 2;
const MAX_LEAD_AGE_DAYS = 45; // leads más viejos no entran en secuencia
const STAGE_CONVERTED = 99;   // agendó llamada o se registró: se acabó el nurture

function makeUnsubToken(email, secret) {
  const payload = 'nurture.' + String(email || '').trim().toLowerCase();
  return crypto.createHmac('sha256', secret).update(payload).digest('hex').slice(0, 32);
}

function verifyUnsubToken(email, token, secret) {
  if (!token) return false;
  const expected = makeUnsubToken(email, secret);
  const a = Buffer.from(String(token));
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function firstName(name) {
  const n = String(name || '').trim().split(/\s+/)[0];
  return n || 'Hola';
}

// Construye el contenido del correo de una etapa. Devuelve
// { subject, preheader, headline, body, footer } listos para emailTemplate().
// escHtml es inyectado para reutilizar el escapador ya testeado del servidor.
function buildNurtureEmail(stage, lead, { appUrl, unsubUrl, escHtml }) {
  const esc = escHtml;
  const nombre = esc(firstName(lead.name));
  const isAudit = lead.tool === 'auditoria';
  const contactUrl = appUrl + '/?utm_source=nurture&utm_content=e' + stage + '#contact';
  const auditUrl = appUrl + '/recursos/auditoria-cuadrante?utm_source=nurture&utm_content=e' + stage;
  const p = t => `<p style="margin:0 0 16px;color:#1a1a1a;line-height:1.65;font-size:15px;">${t}</p>`;
  const li = t => `<li style="margin:0 0 8px;color:#1a1a1a;line-height:1.6;font-size:15px;">${t}</li>`;
  const btn = (text, url) => `<p style="margin:22px 0 0;"><a href="${url}" style="display:inline-block;background:#0e0f0f;color:#faf9f6;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:600;">${text}</a></p>`;

  const footer = `Recibes este correo porque usaste una herramienta gratuita de Shiftia. ` +
    `Si no quieres más correos de seguimiento, <a href="${unsubUrl}" style="color:#8a8a85;">date de baja con un clic</a>.`;

  if (stage === 1) {
    return {
      subject: isAudit ? `¿Le echaste un ojo a tu diagnóstico, ${firstName(lead.name)}?` : 'Tu resultado tiene arreglo (y no es más Excel)',
      preheader: 'Lo que más cuesta corregir a mano en un cuadrante — y por qué.',
      headline: isAudit ? 'Sobre tu diagnóstico' : 'Sobre tu resultado',
      body:
        p(`${nombre}, hace un par de días ${isAudit ? 'te enviamos el diagnóstico de tu cuadrante' : lead.tool === 'plantilla' ? 'descargaste nuestra plantilla de cuadrantes' : 'usaste una de nuestras calculadoras de turnos'}. Si ya lo tienes controlado, genial — ignora este correo. Si no, una cosa que vemos a diario:`) +
        `<ul style="margin:0 0 16px;padding-left:20px;">` +
        li('<strong>Arreglar un descanso rompe otro.</strong> Mueves una noche para cumplir las 12 h y el hueco reaparece dos días después, en otra persona.') +
        li('<strong>La equidad se degrada sola.</strong> Cada cambio de última hora carga a quien "nunca protesta" — hasta que protesta.') +
        li('<strong>El convenio no avisa.</strong> Los incumplimientos no se ven en la cuadrícula; se ven en una inspección o en una baja.') +
        `</ul>` +
        p('Corregirlo a mano es un sudoku que se rehace cada semana. Si quieres, en una llamada de 15 minutos te enseñamos cómo quedaría tu cuadrante generado con tus reglas — sin compromiso y sin tarjeta.') +
        btn('Agendar llamada de 15 min', contactUrl) +
        (isAudit ? '' : p(`<span style="font-size:13px;color:#8a8a85;">P. D.: si quieres el análisis completo de tu planilla real (descansos, equidad, cobertura), la <a href="${auditUrl}" style="color:#0a5950;">auditoría gratuita</a> te lo devuelve en PDF en minutos.</span>`)),
      footer: footer
    };
  }

  if (stage === 2) {
    return {
      subject: 'Así saldría tu cuadrante si lo generara la IA',
      preheader: 'Descansos, equidad, mínimos por turno y convenio — resueltos antes de publicar.',
      headline: 'Qué hace exactamente Shiftia',
      body:
        p(`${nombre}, sin rodeos: esto es lo que Shiftia hace con un cuadrante como el tuyo, y nada más.`) +
        `<ul style="margin:0 0 16px;padding-left:20px;">` +
        li('<strong>Genera la planilla completa</strong> respetando los descansos mínimos de tu convenio desde el primer borrador — no los comprueba después, los cumple al construirla.') +
        li('<strong>Reparte noches y fines de semana con equidad medible</strong>, para que la carga no caiga siempre en los mismos.') +
        li('<strong>Cubre tus mínimos por turno</strong> y recoloca cuando hay una baja de última hora, sin romper lo anterior.') +
        li('<strong>Deja rastro:</strong> cada regla aplicada queda explicada, para que puedas defender el cuadrante ante el equipo o ante quien venga a mirarlo.') +
        `</ul>` +
        p('Se prueba sin tarjeta y con garantía de 30 días. La demo son 15 minutos con tus datos, no una presentación genérica.') +
        btn('Ver Shiftia con mis datos', contactUrl),
      footer: footer
    };
  }

  return {
    subject: `¿Lo dejamos aquí, ${firstName(lead.name)}?`,
    preheader: 'Última nota — sin presión.',
    headline: 'Última nota (de verdad)',
    body:
      p(`${nombre}, este es el último correo de esta serie — no queremos ser esa empresa pesada.`) +
      p('Si el cuadrante ya no te quita el sueño, perfecto: quédate con las herramientas gratuitas, son tuyas para siempre.') +
      p('Y si sigue doliendo cada semana, responde a este correo o agenda 15 minutos cuando te venga bien. Vemos tu caso concreto y te decimos con honestidad si Shiftia encaja o no — también sabemos decir "esto no es para ti".') +
      btn('Agendar 15 minutos', contactUrl),
    footer: footer
  };
}

module.exports = {
  STEPS,
  MIN_GAP_DAYS,
  MAX_LEAD_AGE_DAYS,
  STAGE_CONVERTED,
  makeUnsubToken,
  verifyUnsubToken,
  buildNurtureEmail,
  firstName
};
