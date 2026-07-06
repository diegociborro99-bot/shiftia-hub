// Informe PDF de la auditoría con formato de marca Shiftia.
// Papel cálido, wordmark serif, acento teal, tablas hairline — el mismo
// lenguaje visual de la web. Todos los datos vienen de lib/audit.js.
'use strict';

const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');

const FONTS = {
  serif: path.join(__dirname, '..', 'assets', 'fonts', 'InstrumentSerif-Regular.ttf'),
  serifItalic: path.join(__dirname, '..', 'assets', 'fonts', 'InstrumentSerif-Italic.ttf'),
  sans: path.join(__dirname, '..', 'assets', 'fonts', 'Geist-Regular.ttf'),
  sansBold: path.join(__dirname, '..', 'assets', 'fonts', 'Geist-SemiBold.ttf')
};
const LOGO_PATH = path.join(__dirname, '..', 'public', 'email-logo.png');

const C = {
  paper: '#faf9f6',
  ink: '#0e0f0f',
  muted: '#4a4a47',
  subtle: '#8a8a85',
  border: '#e5e2da',
  teal: '#0f7a6d',
  tealDark: '#0a5950',
  red: '#a31c22',
  amber: '#8a6220',
  cardBg: '#ffffff'
};

const M = 56; // margen
const W = 595.28; // A4 pt
const CW = W - M * 2; // ancho útil

function comma(x) { return String(x).replace('.', ','); }

async function buildAuditPdf({ metrics, summary, lead, generatedAt }) {
  // QR al agendado de llamada (perk del informe) — se genera antes del stream
  let qrBuffer = null;
  try {
    qrBuffer = await QRCode.toBuffer('https://www.shiftia.es/?utm_source=auditoria_pdf#contact', { width: 180, margin: 1, color: { dark: '#0e0f0f', light: '#ffffff' } });
  } catch (e) { /* sin QR si falla */ }
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margins: { top: M, bottom: M, left: M, right: M }, bufferPages: true });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.registerFont('serif', FONTS.serif);
    doc.registerFont('serif-italic', FONTS.serifItalic);
    doc.registerFont('sans', FONTS.sans);
    doc.registerFont('sans-bold', FONTS.sansBold);

    const m = metrics;
    const verdictLabel = { justo: 'Justo', mejorable: 'Mejorable', critico: 'Crítico' }[m.nights.verdict] || m.nights.verdict;
    const verdictColor = { justo: C.tealDark, mejorable: C.amber, critico: C.red }[m.nights.verdict] || C.ink;
    const hardViolations = m.rest_violations.filter(v => v.severity !== 'revisar_convenio');
    const softViolations = m.rest_violations.filter(v => v.severity === 'revisar_convenio');

    function paper() {
      doc.save().rect(0, 0, W, doc.page.height).fill(C.paper).restore();
    }
    function ensureSpace(h) {
      if (doc.y + h > doc.page.height - M - 20) {
        doc.addPage();
        paper();
        doc.y = M;
      }
    }
    function sectionTitle(text) {
      ensureSpace(60);
      doc.moveDown(1.2);
      doc.font('sans-bold').fontSize(8.5).fillColor(C.subtle)
        .text(text.toUpperCase(), M, doc.y, { characterSpacing: 1.2 });
      doc.moveDown(0.5);
      doc.moveTo(M, doc.y).lineTo(M + CW, doc.y).lineWidth(0.7).strokeColor(C.border).stroke();
      doc.moveDown(0.6);
    }
    function tableRow(cells, opts) {
      const o = opts || {};
      const rowH = o.h || 20;
      ensureSpace(rowH + 4);
      const y = doc.y;
      let x = M;
      cells.forEach(cell => {
        doc.font(cell.bold ? 'sans-bold' : 'sans').fontSize(cell.size || 9.5)
          .fillColor(cell.color || C.ink)
          .text(cell.text, x + 2, y + 4, { width: cell.w - 6, align: cell.align || 'left', lineBreak: false, ellipsis: true });
        x += cell.w;
      });
      doc.y = y + rowH;
      if (!o.noLine) {
        doc.moveTo(M, doc.y).lineTo(M + CW, doc.y).lineWidth(0.5).strokeColor(C.border).stroke();
      }
      doc.y += 2;
    }

    // ===== Portada / cabecera =====
    paper();
    try {
      if (fs.existsSync(LOGO_PATH)) {
        doc.image(LOGO_PATH, M, M - 8, { height: 34 });
        doc.font('serif-italic').fontSize(24).fillColor(C.ink).text('Shiftia', M + 44, M - 4, { lineBreak: false });
      } else throw new Error('no logo');
    } catch (e) {
      doc.font('serif-italic').fontSize(26).fillColor(C.ink).text('Shiftia', M, M - 4, { lineBreak: false });
    }
    doc.font('sans').fontSize(9).fillColor(C.subtle)
      .text('Auditoría de cuadrante · Informe confidencial', M, M - 4, { width: CW, align: 'right' });
    doc.font('sans').fontSize(8).fillColor(C.subtle)
      .text(`Expedido el ${generatedAt}`, M, M + 9, { width: CW, align: 'right' });

    doc.y = M + 72;
    doc.font('serif').fontSize(30).fillColor(C.ink)
      .text('Diagnóstico de tu cuadrante', M, doc.y, { width: CW });
    doc.moveDown(0.4);
    doc.font('sans').fontSize(10.5).fillColor(C.muted)
      .text(`Preparado para ${lead.cleanName}${lead.sector ? ' · ' + lead.sector : ''}${lead.workers ? ' · ' + lead.workers + ' trabajadores declarados' : ''}`, { width: CW });
    doc.font('sans').fontSize(9).fillColor(C.subtle)
      .text(`${generatedAt} · ${m.workers_count} personas y ${m.total_shifts} turnos analizados · shiftia.es`, { width: CW });

    // Chips de veredicto
    doc.moveDown(1.1);
    const chipY = doc.y;
    const scoreColor = m.score >= 85 ? C.tealDark : (m.score >= 65 ? C.amber : C.red);
    // Tarjeta de puntuación global (perk): número grande + etiqueta
    const scoreW = CW * 0.34;
    doc.roundedRect(M, chipY, scoreW, 74, 8).lineWidth(0.8).fillAndStroke(C.ink, C.ink);
    doc.font('sans').fontSize(7.5).fillColor('#b9b6ae').text('PUNTUACIÓN GLOBAL', M + 14, chipY + 12, { characterSpacing: 0.8, lineBreak: false });
    doc.font('serif').fontSize(34).fillColor('#faf9f6').text(`${m.score}`, M + 14, chipY + 24, { lineBreak: false });
    doc.font('sans').fontSize(8.5).fillColor('#d8d6cf').text(`/100 · ${m.score_label}`, M + 14 + doc.widthOfString(String(m.score)) + 26, chipY + 46, { lineBreak: false });
    const chips = [
      { label: 'Equidad nocturna', value: verdictLabel, color: verdictColor },
      { label: 'Descansos < 12 h', value: String(m.rest_violations.length), color: m.rest_violations.length ? (hardViolations.length ? C.red : C.amber) : C.tealDark },
      { label: 'Rachas ≥ 3 noches', value: String(m.night_streaks.length), color: m.night_streaks.length ? C.amber : C.tealDark }
    ];
    const chipsX = M + scoreW + 10;
    const chipW = (CW - scoreW - 10 - 20) / 3;
    chips.forEach((c, i) => {
      const x = chipsX + i * (chipW + 10);
      doc.roundedRect(x, chipY, chipW, 74, 8).lineWidth(0.8).fillAndStroke(C.cardBg, C.border);
      doc.font('sans').fontSize(7).fillColor(C.subtle).text(c.label.toUpperCase(), x + 10, chipY + 12, { width: chipW - 20, characterSpacing: 0.6 });
      doc.font('serif').fontSize(19).fillColor(c.color).text(c.value, x + 10, chipY + 36, { width: chipW - 20 });
    });
    doc.y = chipY + 88;

    // ===== Resumen ejecutivo =====
    sectionTitle('Resumen ejecutivo');
    String(summary || '').split(/\n\s*\n/).filter(Boolean).forEach(p => {
      ensureSpace(40);
      doc.font('sans').fontSize(10).fillColor(C.ink).text(p.trim(), M, doc.y, { width: CW, lineGap: 2.5 });
      doc.moveDown(0.5);
    });

    // ===== Equidad nocturna =====
    sectionTitle('Reparto de noches por persona');
    doc.font('sans').fontSize(9).fillColor(C.muted).text(
      `Media ${comma(m.nights.mean)} noches/persona · desviación ${comma(m.nights.stdev)} · rango ${m.nights.range} (${m.nights.min}–${m.nights.max}) · índice de equidad de Jain ${comma(m.nights.jain)}/1`,
      M, doc.y, { width: CW }
    );
    doc.moveDown(0.6);
    tableRow([
      { text: 'Persona', w: CW * 0.55, bold: true, color: C.subtle, size: 8.5 },
      { text: 'Noches', w: CW * 0.2, bold: true, color: C.subtle, size: 8.5, align: 'right' },
      { text: 'Situación', w: CW * 0.25, bold: true, color: C.subtle, size: 8.5, align: 'right' }
    ]);
    const maxNights = Math.max(1, m.nights.max);
    m.nights.per_worker.slice(0, 20).forEach(x => {
      const over = m.nights.overloaded.includes(x.name);
      ensureSpace(24);
      const rowY = doc.y;
      doc.font('sans').fontSize(9.5).fillColor(C.ink).text(x.name, M + 2, rowY + 4, { width: CW * 0.3 - 6, lineBreak: false, ellipsis: true });
      // barra proporcional (perk visual)
      const barX = M + CW * 0.3, barMaxW = CW * 0.42, barH = 8;
      doc.roundedRect(barX, rowY + 6, barMaxW, barH, 4).fill('#efede6');
      if (x.nights > 0) doc.roundedRect(barX, rowY + 6, Math.max(6, barMaxW * (x.nights / maxNights)), barH, 4).fill(over ? C.red : C.teal);
      doc.font('sans').fontSize(9.5).fillColor(C.ink).text(String(x.nights), barX + barMaxW + 8, rowY + 4, { width: CW * 0.06, align: 'right', lineBreak: false });
      doc.font('sans').fontSize(8).fillColor(over ? C.red : C.subtle).text(over ? 'Sobrecarga' : '', barX + barMaxW + 8 + CW * 0.06 + 4, rowY + 5, { width: CW * 0.18, align: 'right', lineBreak: false });
      doc.y = rowY + 20;
      doc.moveTo(M, doc.y).lineTo(M + CW, doc.y).lineWidth(0.4).strokeColor(C.border).stroke();
      doc.y += 2;
    });
    if (m.nights.per_worker.length > 20) {
      doc.font('sans').fontSize(8.5).fillColor(C.subtle).text(`…y ${m.nights.per_worker.length - 20} personas más.`, M, doc.y + 2);
      doc.moveDown(0.5);
    }

    // ===== Descansos =====
    sectionTitle(`Descansos entre turnos · régimen aplicado: ${m.legal_context.sector_label}`);
    doc.font('sans').fontSize(9).fillColor(C.muted).text(m.legal_context.note, M, doc.y, { width: CW, lineGap: 2 });
    doc.moveDown(0.6);
    if (!m.rest_violations.length) {
      doc.font('sans-bold').fontSize(10).fillColor(C.tealDark).text('Sin descansos por debajo de 12 h en el periodo analizado. ✔', M, doc.y, { width: CW });
      doc.moveDown(0.4);
    } else {
      tableRow([
        { text: 'Persona', w: CW * 0.24, bold: true, color: C.subtle, size: 8.5 },
        { text: 'Secuencia', w: CW * 0.4, bold: true, color: C.subtle, size: 8.5 },
        { text: 'Descanso', w: CW * 0.14, bold: true, color: C.subtle, size: 8.5, align: 'right' },
        { text: 'Valoración', w: CW * 0.22, bold: true, color: C.subtle, size: 8.5, align: 'right' }
      ]);
      m.rest_violations.slice(0, 24).forEach(v => {
        const hard = v.severity !== 'revisar_convenio';
        tableRow([
          { text: v.worker, w: CW * 0.24 },
          { text: `${v.from} → ${v.to}`, w: CW * 0.4, size: 8.5, color: C.muted },
          { text: `${comma(v.rest_hours)} h`, w: CW * 0.14, align: 'right', color: hard ? C.red : C.amber },
          { text: hard ? 'Incumplimiento' : 'Revisar convenio', w: CW * 0.22, align: 'right', size: 8.5, color: hard ? C.red : C.amber }
        ]);
      });
      if (m.rest_violations.length > 24) {
        doc.font('sans').fontSize(8.5).fillColor(C.subtle).text(`…y ${m.rest_violations.length - 24} casos más.`, M, doc.y + 2);
        doc.moveDown(0.5);
      }
      if (softViolations.length) {
        doc.moveDown(0.3);
        doc.font('sans').fontSize(8.5).fillColor(C.muted).text(
          `"Revisar convenio": descansos entre ${comma(m.legal_context.reduced_floor_hours)} y 12 h que el régimen del sector puede amparar con compensación — verifica que tu convenio lo recoge.`,
          M, doc.y, { width: CW, lineGap: 2 }
        );
      }
    }

    // ===== Rachas =====
    if (m.night_streaks.length) {
      sectionTitle('Rachas de noches consecutivas (≥ 3)');
      m.night_streaks.slice(0, 12).forEach(s => {
        ensureSpace(18);
        doc.font('sans').fontSize(9.5).fillColor(C.ink)
          .text(`${s.worker}: ${s.length} noches seguidas (hasta ${s.end_date})`, M, doc.y, { width: CW });
        doc.moveDown(0.25);
      });
    }

    // ===== Marco legal y supuestos =====
    sectionTitle('Marco legal y supuestos del cálculo');
    doc.font('sans').fontSize(8.5).fillColor(C.muted).text(
      `Referencias: ${m.legal_context.legal_refs.join(' · ')}.`, M, doc.y, { width: CW, lineGap: 2 });
    doc.moveDown(0.35);
    doc.font('sans').fontSize(8.5).fillColor(C.muted).text(
      `Horarios asumidos: ${m.assumptions.shift_definitions.join(' · ')}. Descanso mínimo de referencia: ${m.assumptions.min_rest_hours} h entre el fin efectivo de un turno y el inicio del siguiente.`,
      M, doc.y, { width: CW, lineGap: 2 });
    doc.moveDown(0.35);
    doc.font('sans').fontSize(8.5).fillColor(C.subtle).text(
      'Los números de este informe proceden de un cálculo automático determinista sobre la transcripción de tu documento — la IA solo lee el cuadrante, no calcula. Tu archivo se elimina tras el análisis. Este diagnóstico es informativo y no constituye asesoramiento legal.',
      M, doc.y, { width: CW, lineGap: 2 });

    // ===== Cierre / CTA =====
    ensureSpace(120);
    doc.moveDown(1.4);
    const ctaY = doc.y;
    const ctaH = 96;
    doc.roundedRect(M, ctaY, CW, ctaH, 10).fill(C.ink);
    const textW = qrBuffer ? CW - 48 - 96 : CW - 48;
    doc.font('serif-italic').fontSize(16).fillColor('#faf9f6')
      .text('¿Y si tu próximo cuadrante saliera ya así de auditado?', M + 24, ctaY + 20, { width: textW });
    doc.font('sans').fontSize(9.5).fillColor('#d8d6cf')
      .text('La IA de Shiftia genera la planilla respetando descansos, equidad y tu convenio. Te lo enseñamos con tus datos en 15 minutos: www.shiftia.es/#contact · info@shiftia.es', M + 24, ctaY + 48, { width: textW, lineGap: 2 });
    if (qrBuffer) {
      // QR sobre placa blanca para que escanee bien (perk: agenda desde el papel)
      doc.roundedRect(M + CW - 24 - 72, ctaY + 12, 72, 72, 6).fill('#ffffff');
      doc.image(qrBuffer, M + CW - 24 - 66, ctaY + 18, { width: 60, height: 60 });
    }
    doc.y = ctaY + ctaH + 14;

    // Pie de página en todas las páginas. OJO pdfkit: escribir por debajo del
    // margen inferior dispara un salto de página automático y genera páginas
    // en blanco — se anula el margen mientras se pinta el pie.
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      const savedBottom = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      doc.font('sans').fontSize(7.5).fillColor(C.subtle)
        .text(`Shiftia · Auditoría de cuadrante · ${generatedAt}`, M, doc.page.height - 36, { width: CW * 0.6, lineBreak: false });
      doc.text(`${i + 1} / ${range.count}`, M + CW * 0.6, doc.page.height - 36, { width: CW * 0.4, align: 'right', lineBreak: false });
      doc.page.margins.bottom = savedBottom;
    }

    doc.end();
  });
}

module.exports = { buildAuditPdf };
