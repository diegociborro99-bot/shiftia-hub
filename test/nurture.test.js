// Tests de la secuencia de seguimiento (lib/nurture.js).
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const nurture = require('../lib/nurture');
const { escHtml } = require('../lib/booking');

const SECRET = 'secreto-de-test';
const CTX = { appUrl: 'https://www.shiftia.es', unsubUrl: 'https://www.shiftia.es/api/nurture/unsubscribe?e=x&t=y', escHtml };

test('token de baja: firma y verifica; case-insensitive; rechaza manipulación', () => {
  const t = nurture.makeUnsubToken('Ana@Empresa.es', SECRET);
  assert.equal(t.length, 32);
  assert.ok(nurture.verifyUnsubToken('ana@empresa.es', t, SECRET));
  assert.ok(!nurture.verifyUnsubToken('otra@empresa.es', t, SECRET));
  assert.ok(!nurture.verifyUnsubToken('ana@empresa.es', t.slice(0, 31) + '0', SECRET));
  assert.ok(!nurture.verifyUnsubToken('ana@empresa.es', '', SECRET));
  assert.ok(!nurture.verifyUnsubToken('ana@empresa.es', t, 'otro-secreto'));
});

test('las tres etapas generan correo completo con enlace de baja', () => {
  for (const step of nurture.STEPS) {
    const mail = nurture.buildNurtureEmail(step.stage, { tool: 'auditoria', name: 'Diego Ciborro', email: 'd@x.es' }, CTX);
    assert.ok(mail.subject.length > 5, 'subject e' + step.stage);
    assert.ok(mail.body.includes('Agendar') || mail.body.includes('Ver Shiftia'), 'CTA e' + step.stage);
    assert.ok(mail.footer.includes(CTX.unsubUrl), 'baja e' + step.stage);
    assert.ok(mail.body.includes('utm_content=e' + step.stage), 'utm e' + step.stage);
  }
});

test('etapa 1 distingue auditoría de calculadoras (P. D. con enlace a auditoría)', () => {
  const audit = nurture.buildNurtureEmail(1, { tool: 'auditoria', name: 'Ana', email: 'a@x.es' }, CTX);
  const calc = nurture.buildNurtureEmail(1, { tool: 'equidad', name: 'Ana', email: 'a@x.es' }, CTX);
  assert.ok(audit.subject.includes('diagnóstico'));
  assert.ok(!audit.body.includes('auditoria-cuadrante'));
  assert.ok(calc.body.includes('auditoria-cuadrante'));
});

test('el nombre se escapa (sin XSS) y se usa solo el nombre de pila', () => {
  const mail = nurture.buildNurtureEmail(1, { tool: 'equidad', name: '<img src=x> García', email: 'a@x.es' }, CTX);
  assert.ok(!mail.body.includes('<img src=x>'));
  assert.ok(mail.body.includes('&lt;img'));
  assert.equal(nurture.firstName('María del Mar López'), 'María');
  assert.equal(nurture.firstName(''), 'Hola');
});
