// Capa de IA de la auditoría de cuadrantes.
//
// División de responsabilidades pensada para que el diagnóstico sea certero:
//   1. extractSchedule(): Claude LEE el archivo (PDF/imagen/CSV) y lo convierte
//      a JSON estructurado con salida forzada por esquema. Devuelve además una
//      confianza [0..1]: por debajo del umbral NO se auto-responde.
//   2. Los hallazgos los calcula lib/audit.js (determinista, testeado).
//   3. writeSummary(): Claude redacta el resumen ejecutivo ANCLADO a las
//      métricas ya calculadas — se le prohíbe introducir números nuevos.
//
// Sin ANTHROPIC_API_KEY el módulo queda inerte y el flujo cae al manual.
'use strict';

const Anthropic = require('@anthropic-ai/sdk');

const MODEL = process.env.AUDIT_MODEL || 'claude-opus-4-8';
const MIN_CONFIDENCE = Number(process.env.AUDIT_MIN_CONFIDENCE || 0.7);

let client = null;
function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!client) client = new Anthropic();
  return client;
}

function isEnabled() { return !!process.env.ANTHROPIC_API_KEY; }

// Esquema de extracción (estructurado: additionalProperties false + required en todo).
const EXTRACTION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['workers', 'shift_definitions', 'period', 'confidence', 'notes'],
  properties: {
    workers: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'shifts'],
        properties: {
          name: { type: 'string' },
          shifts: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['date', 'code'],
              properties: {
                date: { type: 'string', description: 'Fecha YYYY-MM-DD' },
                code: { type: 'string', description: 'Código de turno tal como aparece (M, T, N, L, 12...)' }
              }
            }
          }
        }
      }
    },
    shift_definitions: {
      type: 'array',
      description: 'Solo si el documento define horarios de los códigos; si no, lista vacía',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['code', 'start', 'end', 'is_night', 'is_rest'],
        properties: {
          code: { type: 'string' },
          start: { anyOf: [{ type: 'string' }, { type: 'null' }], description: 'HH:MM o null si es descanso' },
          end: { anyOf: [{ type: 'string' }, { type: 'null' }] },
          is_night: { type: 'boolean' },
          is_rest: { type: 'boolean' }
        }
      }
    },
    period: {
      anyOf: [
        {
          type: 'object',
          additionalProperties: false,
          required: ['start', 'end'],
          properties: { start: { type: 'string' }, end: { type: 'string' } }
        },
        { type: 'null' }
      ]
    },
    confidence: { type: 'number', description: 'Confianza 0..1 en que la extracción es completa y correcta' },
    notes: { type: 'array', items: { type: 'string' }, description: 'Ambigüedades del documento (celdas ilegibles, códigos sin definir...)' }
  }
};

function fileToContentBlock(file) {
  const name = (file.originalname || '').toLowerCase();
  const b64 = file.buffer.toString('base64');
  if (name.endsWith('.pdf')) {
    return { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: b64 } };
  }
  if (/\.(png|jpe?g)$/.test(name)) {
    const mt = name.endsWith('.png') ? 'image/png' : 'image/jpeg';
    return { type: 'image', source: { type: 'base64', media_type: mt, data: b64 } };
  }
  if (/\.(csv|txt)$/.test(name)) {
    return { type: 'text', text: 'Contenido del archivo (' + (file.originalname || 'csv') + '):\n\n' + file.buffer.toString('utf8').slice(0, 200000) };
  }
  return null; // xls/xlsx u otros: no auto-analizables → flujo manual
}

// Extrae el cuadrante del archivo. Devuelve el objeto validado por esquema
// o null si el formato no es auto-analizable.
async function extractSchedule(file) {
  const anthropic = getClient();
  if (!anthropic) return null;
  const block = fileToContentBlock(file);
  if (!block) return null;

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    system:
      'Eres un extractor de cuadrantes de turnos español. Convierte el documento a JSON EXACTAMENTE según el esquema. ' +
      'Reglas: (1) transcribe SOLO lo que ves — nunca inventes turnos, personas ni fechas; ' +
      '(2) si el documento indica mes/año, calcula las fechas completas YYYY-MM-DD de cada columna/día; ' +
      '(3) usa los códigos de turno tal como aparecen (M, T, N, L, D, 12, etc.); ' +
      '(4) incluye shift_definitions solo si el documento define horarios; ' +
      '(5) la confianza debe ser honesta: baja si hay celdas ilegibles, columnas ambiguas o no puedes anclar las fechas; ' +
      '(6) anota en notes cualquier ambigüedad.',
    messages: [{
      role: 'user',
      content: [
        block,
        { type: 'text', text: 'Extrae el cuadrante de turnos de este documento al esquema JSON.' }
      ]
    }],
    output_config: { format: { type: 'json_schema', schema: EXTRACTION_SCHEMA } }
  });

  if (response.stop_reason === 'refusal') {
    throw new Error('extracción rechazada por el modelo (refusal)');
  }
  const text = response.content.filter(b => b.type === 'text').map(b => b.text).join('');
  return JSON.parse(text);
}

// Redacta el resumen ejecutivo del informe, anclado a las métricas calculadas.
async function writeSummary({ metrics, lead, extractionNotes }) {
  const anthropic = getClient();
  if (!anthropic) return null;

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2000,
    thinking: { type: 'adaptive' },
    system:
      'Eres el auditor de cuadrantes de Shiftia (empresa española de planificación de turnos, fundada por un enfermero de turnos en activo). ' +
      'Redactas el resumen ejecutivo de un diagnóstico para el responsable de planilla que envió su cuadrante. ' +
      'REGLA INQUEBRANTABLE: solo puedes citar números que estén literalmente en las métricas JSON que recibes — no calcules ni estimes nada nuevo. ' +
      'Tono: profesional, directo, empático con quien hace turnos; sin marketing agresivo. En español. ' +
      'Estructura: 2-4 párrafos cortos. Primero el hallazgo más importante, luego el resto por gravedad, y cierra con la recomendación práctica más útil. ' +
      'Si hay violaciones de descanso, cita el artículo 34.3 del Estatuto de los Trabajadores. Sin encabezados, sin listas: prosa.',
    messages: [{
      role: 'user',
      content:
        'Métricas calculadas (fuente única de verdad):\n' + JSON.stringify(metrics, null, 2) +
        '\n\nContexto del solicitante: sector=' + (lead.sector || 'no indicado') +
        ', trabajadores declarados=' + (lead.workers || 'no indicado') +
        (lead.message ? ', comentario="' + lead.message + '"' : '') +
        (extractionNotes && extractionNotes.length ? '\n\nAvisos de la lectura del documento: ' + extractionNotes.join(' · ') : '') +
        '\n\nRedacta el resumen ejecutivo.'
    }]
  });

  if (response.stop_reason === 'refusal') return null;
  return response.content.filter(b => b.type === 'text').map(b => b.text).join('').trim();
}

module.exports = { isEnabled, extractSchedule, writeSummary, MIN_CONFIDENCE, MODEL };
