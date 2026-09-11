// Informe PDF de la auditoría de cuadrantes.
//
// A4 horizontal, porque lo primero que tiene que ver el cliente es SU
// cuadrante dibujado, no una tabla de números sobre él. Cuatro secciones:
//   1. Portada + parrilla del cuadrante que envió, con los conflictos marcados
//   2. Lo que hemos encontrado (equidad, descansos, fichas por persona)
//   3. El cuadrante corregido, con los cambios resaltados y su motivo
//   4. Cierre
//
// Todos los números vienen de lib/audit.js y lib/roster-fix.js. Aquí no se
// calcula nada: esto solo dibuja.
'use strict';

const path = require('path');
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
  card: '#ffffff',
  ink: '#0e0f0f',
  muted: '#4a4a47',
  subtle: '#8a8a85',
  border: '#e5e2da',
  borderSoft: '#f0ede6',
  teal: '#0f7a6d',
  tealDark: '#0a5950',
  tealSoft: '#e9f5f2',
  red: '#a31c22',
  redSoft: '#f8e9e8',
  amber: '#8a6220',
  amberSoft: '#fbf1e0',
  green: '#1c7c43'
};

// Paleta de turnos: la misma que la sección «Funciones en acción» de la web,
// para que el informe y el producto se reconozcan como la misma cosa.
const SHIFT_STYLE = {
  M: { bg: '#dcefe8', fg: '#1a6b5a', label: 'Mañana' },
  T: { bg: '#dfe9f6', fg: '#1a5a96', label: 'Tarde' },
  N: { bg: '#e7e2f6', fg: '#4a3a8a', label: 'Noche' },
  L: { bg: '#f2f0ed', fg: '#9a9891', label: 'Libre' },
  D: { bg: '#f2f0ed', fg: '#9a9891', label: 'Descanso' },
  V: { bg: '#fdeceb', fg: '#a33', label: 'Vacaciones' }
};
const OTHER_STYLE = { bg: '#f4f1ea', fg: '#6e6c66', label: 'Otro' };
function shiftStyle(code) { return SHIFT_STYLE[String(code || '').toUpperCase()] || OTHER_STYLE; }

const W = 841.89;   // A4 horizontal
const H = 595.28;
const M = 34;
const CW = W - M * 2;

const DOW = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
// «del 7 al 20 de septiembre de 2026» en vez de «del 2026-09-07 al 2026-09-20»
function humanRange(a, b) {
  const d1 = new Date(a + 'T00:00:00Z'), d2 = new Date(b + 'T00:00:00Z');
  const m1 = d1.getUTCMonth(), m2 = d2.getUTCMonth(), y1 = d1.getUTCFullYear(), y2 = d2.getUTCFullYear();
  if (m1 === m2 && y1 === y2) return `del ${d1.getUTCDate()} al ${d2.getUTCDate()} de ${MONTHS[m1]} de ${y1}`;
  if (y1 === y2) return `del ${d1.getUTCDate()} de ${MONTHS[m1]} al ${d2.getUTCDate()} de ${MONTHS[m2]} de ${y1}`;
  return `del ${d1.getUTCDate()} de ${MONTHS[m1]} de ${y1} al ${d2.getUTCDate()} de ${MONTHS[m2]} de ${y2}`;
}
function humanShort(iso) {
  const d = new Date(iso + 'T00:00:00Z');
  return `${DOW[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()].slice(0, 3)}`;
}
// «N 2026-09-11» (como lo guarda la auditoría) → «noche del vie 11 sep»
const SHIFT_WORD = { M: 'mañana', T: 'tarde', N: 'noche' };
function humanSeq(token) {
  const [code, iso] = String(token || '').split(' ');
  if (!iso) return String(token || '');
  return `${SHIFT_WORD[String(code).toUpperCase()] || code} del ${humanShort(iso)}`;
}
function dowOf(iso) { return DOW[new Date(iso + 'T00:00:00Z').getUTCDay()]; }
function isWeekend(iso) { const d = new Date(iso + 'T00:00:00Z').getUTCDay(); return d === 0 || d === 6; }
function dayNum(iso) { return String(new Date(iso + 'T00:00:00Z').getUTCDate()); }
function comma(x) { return String(x).replace('.', ','); }
function cut(s, n) { s = String(s == null ? '' : s); return s.length > n ? s.slice(0, n - 1) + '…' : s; }

async function buildAuditPdf({ metrics, summary, lead, generatedAt, schedule, fix }) {
  let qrBuffer = null;
  try {
    qrBuffer = await QRCode.toBuffer('https://www.shiftia.es/?utm_source=auditoria_pdf#contact',
      { width: 180, margin: 1, color: { dark: '#0e0f0f', light: '#ffffff' } });
  } catch (e) { /* sin QR si falla */ }

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margins: { top: M, bottom: M, left: M, right: M }, bufferPages: true });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.registerFont('serif', FONTS.serif);
    doc.registerFont('serif-italic', FONTS.serifItalic);
    doc.registerFont('sans', FONTS.sans);
    doc.registerFont('sans-bold', FONTS.sansBold);

    const m = metrics;
    const hard = m.rest_violations.filter(v => v.severity !== 'revisar_convenio');
    const soft = m.rest_violations.filter(v => v.severity === 'revisar_convenio');

    // ── Utilidades de dibujo ────────────────────────────────────────────────
    function paper() { doc.save().rect(0, 0, W, H).fill(C.paper).restore(); }

    function card(x, y, w, h, opts) {
      const o = opts || {};
      doc.save().roundedRect(x, y, w, h, o.r == null ? 9 : o.r)
        .fillAndStroke(o.bg || C.card, o.border || C.border);
      doc.restore();
      if (o.accent) {
        doc.save().rect(x, y, 3, h).fill(o.accent).restore();
      }
    }

    // Cabecera de página: logo, eyebrow, título y línea
    function header(eyebrow, title, titleAccent, sub) {
      paper();
      try { doc.image(LOGO_PATH, M, M - 2, { width: 30 }); } catch (e) { /* sin logo */ }
      doc.font('sans-bold').fontSize(7).fillColor(C.subtle)
        .text(eyebrow.toUpperCase(), M + 40, M + 1, { characterSpacing: 1.3, lineBreak: false });
      doc.font('serif').fontSize(21).fillColor(C.ink)
        .text(title, M + 40, M + 11, { lineBreak: false, continued: !!titleAccent });
      if (titleAccent) doc.font('serif-italic').fontSize(21).fillColor(C.subtle).text(' ' + titleAccent, { lineBreak: false });
      if (sub) {
        doc.font('sans').fontSize(8.5).fillColor(C.muted)
          .text(sub, M + 40, M + 38, { width: CW - 160, lineBreak: false });
      }
      doc.font('sans-bold').fontSize(9).fillColor(C.tealDark)
        .text('Shiftia', W - M - 120, M + 2, { width: 120, align: 'right', lineBreak: false });
      doc.font('sans').fontSize(7).fillColor(C.subtle)
        .text('shiftia.es', W - M - 120, M + 14, { width: 120, align: 'right', lineBreak: false });
      const y = M + 54;
      doc.moveTo(M, y).lineTo(M + CW, y).lineWidth(1).strokeColor(C.ink).stroke();
      return y + 14;
    }

    function footer() {
      const range = doc.bufferedPageRange();
      for (let i = 0; i < range.count; i++) {
        doc.switchToPage(range.start + i);
        const saved = doc.page.margins.bottom;
        doc.page.margins.bottom = 0;
        doc.font('sans').fontSize(7).fillColor(C.subtle)
          .text(`Auditoría de cuadrante generada por Shiftia con el documento facilitado por ${cut(lead.cleanName, 40)} · shiftia.es · ${generatedAt}`,
            M, H - 24, { width: CW * 0.75, lineBreak: false });
        doc.text(`${i + 1} / ${range.count}`, M + CW * 0.75, H - 24, { width: CW * 0.25, align: 'right', lineBreak: false });
        doc.page.margins.bottom = saved;
      }
    }

    // Fila de KPIs a lo ancho
    function kpiRow(y, items) {
      const gap = 9;
      const w = (CW - gap * (items.length - 1)) / items.length;
      const h = 52;
      items.forEach((it, i) => {
        const x = M + i * (w + gap);
        card(x, y, w, h, { bg: it.dark ? C.ink : C.card, border: it.dark ? C.ink : C.border });
        doc.font('sans-bold').fontSize(6.5).fillColor(it.dark ? '#9a968c' : C.subtle)
          .text(String(it.label).toUpperCase(), x + 12, y + 10, { characterSpacing: 1, width: w - 24, lineBreak: false });
        doc.font('sans-bold').fontSize(17).fillColor(it.dark ? C.paper : (it.color || C.ink))
          .text(String(it.value), x + 12, y + 21, { width: w - 24, lineBreak: false, continued: !!it.unit });
        if (it.unit) doc.font('sans').fontSize(8).fillColor(it.dark ? '#9a968c' : C.subtle).text(' ' + it.unit, { lineBreak: false });
        if (it.sub) {
          doc.font('sans').fontSize(6.5).fillColor(it.dark ? '#9a968c' : C.subtle)
            .text(cut(it.sub, 46), x + 12, y + 40, { width: w - 24, lineBreak: false });
        }
      });
      return y + h + 14;
    }

    function sectionLabel(x, y, text, w) {
      doc.font('sans-bold').fontSize(7).fillColor(C.subtle)
        .text(String(text).toUpperCase(), x, y, { characterSpacing: 1.1, width: w || CW, lineBreak: false });
      doc.moveTo(x, y + 11).lineTo(x + (w || CW), y + 11).lineWidth(0.6).strokeColor(C.border).stroke();
      return y + 19;
    }

    // Barra horizontal con valor y, opcionalmente, línea de umbral
    function bar(x, y, w, value, max, opts) {
      const o = opts || {};
      const h = o.h || 7;
      doc.save().roundedRect(x, y, w, h, h / 2).fill(o.track || C.borderSoft).restore();
      const filled = max > 0 ? Math.max(0, Math.min(1, value / max)) * w : 0;
      if (filled > 0.5) doc.save().roundedRect(x, y, filled, h, h / 2).fill(o.color || C.teal).restore();
      if (o.threshold != null && max > 0) {
        const tx = x + Math.max(0, Math.min(1, o.threshold / max)) * w;
        doc.save().moveTo(tx, y - 2.5).lineTo(tx, y + h + 2.5).lineWidth(1).dash(2, { space: 1.5 })
          .strokeColor(o.thresholdColor || C.red).stroke().undash().restore();
      }
    }

    // ── Parrilla del cuadrante ──────────────────────────────────────────────
    // rows: [{ name, role, cells: [{code, flag}] }] · flag: 'conflict' | 'changed'
    function rosterGrid(x, y, w, dates, rows, opts) {
      const o = opts || {};
      const nameW = o.nameW || 118;
      const totW = o.totals ? 52 : 0;
      const colW = (w - nameW - totW) / dates.length;
      const rowH = Math.max(15, Math.min(o.maxRowH || 30, (o.maxH || 260) / (rows.length + 1)));
      const headH = 20;

      // Cabecera de días
      doc.save().rect(x + nameW, y, w - nameW - totW, headH).fill('#f4f2ec').restore();
      dates.forEach((d, i) => {
        const cx = x + nameW + i * colW;
        if (isWeekend(d)) doc.save().rect(cx, y, colW, headH).fill('#eaf0f6').restore();
        doc.font('sans').fontSize(5.5).fillColor(C.subtle)
          .text(dowOf(d), cx, y + 4, { width: colW, align: 'center', lineBreak: false });
        doc.font('sans-bold').fontSize(8).fillColor(isWeekend(d) ? '#1a5a96' : C.ink)
          .text(dayNum(d), cx, y + 11, { width: colW, align: 'center', lineBreak: false });
      });
      if (totW) {
        doc.font('sans-bold').fontSize(6).fillColor(C.subtle)
          .text('TOTAL', x + nameW + dates.length * colW, y + 8, { width: totW, align: 'center', characterSpacing: 0.6, lineBreak: false });
      }

      // Filas
      rows.forEach((r, ri) => {
        const ry = y + headH + ri * rowH;
        if (ri % 2 === 1) doc.save().rect(x, ry, w, rowH).fill('#fbfaf7').restore();
        doc.font('sans-bold').fontSize(7.5).fillColor(C.ink)
          .text(cut(r.name, 20), x + 6, ry + (r.role ? 2.5 : rowH / 2 - 4), { width: nameW - 10, lineBreak: false });
        if (r.role) {
          doc.font('sans').fontSize(5.5).fillColor(C.subtle)
            .text(cut(r.role, 26), x + 6, ry + 11, { width: nameW - 10, lineBreak: false });
        }
        r.cells.forEach((cell, ci) => {
          const cx = x + nameW + ci * colW;
          const pad = 1.2;
          const st = shiftStyle(cell.code);
          if (cell.code) {
            doc.save().roundedRect(cx + pad, ry + pad, colW - pad * 2, rowH - pad * 2, 2.5).fill(st.bg).restore();
            doc.font('sans-bold').fontSize(colW < 24 ? 5.5 : 6.5).fillColor(st.fg)
              .text(cut(cell.code, 4), cx, ry + rowH / 2 - (colW < 24 ? 2.6 : 3.2), { width: colW, align: 'center', lineBreak: false });
          } else if (isWeekend(dates[ci])) {
            doc.save().rect(cx, ry, colW, rowH).fill('#f7f5f0').restore();
          }
          if (cell.flag === 'conflict') {
            doc.save().roundedRect(cx + pad, ry + pad, colW - pad * 2, rowH - pad * 2, 2.5)
              .lineWidth(1.1).strokeColor(C.red).stroke().restore();
          } else if (cell.flag === 'changed') {
            doc.save().roundedRect(cx + pad, ry + pad, colW - pad * 2, rowH - pad * 2, 2.5)
              .lineWidth(1.3).strokeColor(C.teal).stroke().restore();
          }
        });
        if (totW) {
          const tx = x + nameW + dates.length * colW;
          doc.font('sans-bold').fontSize(7).fillColor(C.ink)
            .text(String(r.total || 0), tx, ry + rowH / 2 - 4, { width: totW, align: 'center', lineBreak: false });
        }
        doc.moveTo(x, ry + rowH).lineTo(x + w, ry + rowH).lineWidth(0.4).strokeColor(C.borderSoft).stroke();
      });

      const bottom = y + headH + rows.length * rowH;
      doc.save().roundedRect(x, y, w, bottom - y, 6).lineWidth(0.7).strokeColor(C.border).stroke().restore();
      return bottom;
    }

    // Cuánta gente hay en cada turno, día a día. Alineada con la parrilla:
    // es la comprobación que hace cualquier encargado al mirar el cuadrante.
    function coverageStrip(x, y, w, dates, sched, opts) {
      const o = opts || {};
      const nameW = o.nameW || 118;
      const totW = o.totals ? 52 : 0;
      const colW = (w - nameW - totW) / dates.length;
      const rowH = 14;

      const codes = [];
      for (const c of ['M', 'T', 'N']) {
        if ((sched.workers || []).some(wk => (wk.shifts || []).some(sh => String(sh.code).toUpperCase() === c))) codes.push(c);
      }
      if (!codes.length) return y;

      const count = new Map(); // code|date → nº de personas
      for (const wk of (sched.workers || [])) {
        for (const sh of (wk.shifts || [])) {
          const c = String(sh.code || '').toUpperCase();
          if (!codes.includes(c)) continue;
          const k = c + '|' + sh.date;
          count.set(k, (count.get(k) || 0) + 1);
        }
      }
      const perDay = dates.map(d => codes.reduce((a, c) => a + (count.get(c + '|' + d) || 0), 0));
      const maxDay = Math.max(1, ...perDay);

      codes.forEach((c, ci) => {
        const ry = y + ci * rowH;
        const st = shiftStyle(c);
        doc.save().roundedRect(x + 8, ry + 3.5, 20, 8, 2).fill(st.bg).restore();
        doc.font('sans-bold').fontSize(5.5).fillColor(st.fg)
          .text(c, x + 8, ry + 5.4, { width: 20, align: 'center', lineBreak: false });
        doc.font('sans').fontSize(6.5).fillColor(C.muted)
          .text(st.label, x + 32, ry + 4.5, { width: nameW - 40, lineBreak: false });
        dates.forEach((d, di) => {
          const cx = x + nameW + di * colW;
          const n = count.get(c + '|' + d) || 0;
          if (isWeekend(d)) doc.save().rect(cx, ry, colW, rowH).fill('#f7f5f0').restore();
          doc.font('sans-bold').fontSize(7).fillColor(n === 0 ? C.red : C.muted)
            .text(n === 0 ? '—' : String(n), cx, ry + 3.5, { width: colW, align: 'center', lineBreak: false });
        });
      });

      // Total de gente por día, como barra bajo las columnas
      const by = y + codes.length * rowH + 2;
      doc.font('sans').fontSize(6.5).fillColor(C.subtle)
        .text('Total en el centro', x + 8, by + 4, { width: nameW - 12, lineBreak: false });
      dates.forEach((d, di) => {
        const cx = x + nameW + di * colW;
        const hgt = Math.max(1.5, (perDay[di] / maxDay) * 11);
        doc.save().roundedRect(cx + colW * 0.22, by + 12 - hgt, colW * 0.56, hgt, 1.2).fill(C.teal).restore();
        doc.font('sans').fontSize(5.5).fillColor(C.subtle)
          .text(String(perDay[di]), cx, by + 13.5, { width: colW, align: 'center', lineBreak: false });
      });
      return by + 22;
    }

    function legend(x, y, codes, extra) {
      let cx = x;
      doc.font('sans').fontSize(6.5);
      for (const code of codes) {
        const st = shiftStyle(code.code);
        doc.save().roundedRect(cx, y, 9, 7, 2).fill(st.bg).restore();
        const text = code.hours ? `${st.label} ${code.hours}` : st.label;
        doc.fillColor(C.muted).text(text, cx + 12, y + 0.5, { lineBreak: false });
        cx += 12 + doc.widthOfString(text) + 12;
      }
      for (const e of (extra || [])) {
        doc.save().roundedRect(cx, y, 9, 7, 2).lineWidth(1).strokeColor(e.color).stroke().restore();
        doc.fillColor(C.muted).text(e.label, cx + 12, y + 0.5, { lineBreak: false });
        cx += 12 + doc.widthOfString(e.label) + 12;
      }
      return y + 12;
    }

    // ── Datos de la parrilla ────────────────────────────────────────────────
    // Fechas del periodo y celdas por persona, con los conflictos marcados a
    // partir de las violaciones que ya calculó la auditoría.
    function buildRosterRows(sched, changedSet) {
      const workers = (sched && sched.workers) || [];
      const dates = [...new Set(workers.flatMap(w => (w.shifts || []).map(s => s && s.date).filter(Boolean)))].sort();
      const conflictCells = new Set();
      for (const v of m.rest_violations) {
        const d = String(v.to || '').split(' ')[1];
        if (d) conflictCells.add(v.worker + '|' + d);
      }
      for (const s of m.night_streaks) conflictCells.add(s.worker + '|' + s.end_date);
      for (const r of m.consecutive_work_runs) conflictCells.add(r.worker + '|' + r.end_date);

      const rows = workers.map(w => {
        const byDate = new Map((w.shifts || []).map(s => [s.date, s.code]));
        let worked = 0;
        const cells = dates.map(d => {
          const code = byDate.get(d) || null;
          const st = String(code || '').toUpperCase();
          if (code && !['L', 'D', 'V'].includes(st)) worked++;
          const key = w.name + '|' + d;
          return {
            code,
            flag: changedSet && changedSet.has(key) ? 'changed' : (conflictCells.has(key) ? 'conflict' : null)
          };
        });
        return { name: w.name, role: w.role || null, cells, total: worked };
      });
      return { dates, rows };
    }

    const shiftCodes = (() => {
      const defs = (schedule && schedule.shift_definitions) || [];
      const seen = new Map();
      for (const d of defs) {
        if (!d || !d.code) continue;
        seen.set(String(d.code).toUpperCase(), d.start && d.end ? `${d.start}–${d.end}` : null);
      }
      if (!seen.size) for (const c of ['M', 'T', 'N', 'L']) seen.set(c, null);
      return [...seen.entries()].slice(0, 6).map(([code, hours]) => ({ code, hours }));
    })();

    // ════════════════════════════════════════════════════════════════════════
    // PÁGINA 1 · Portada y parrilla del cuadrante recibido
    // ════════════════════════════════════════════════════════════════════════
    const periodTxt = m.period ? `${humanRange(m.period.start, m.period.end)} · ${m.period.days} días` : 'periodo analizado';
    let y = header(
      `Auditoría de cuadrante · ${lead.sector || 'régimen general'}`,
      'Tu cuadrante,', 'auditado',
      `${cut(lead.cleanName, 40)} · ${periodTxt} · régimen aplicado: ${m.legal_context.sector_label}`
    );

    y = kpiRow(y, [
      { label: 'Puntuación global', value: m.score, unit: '/100', sub: m.score_label, dark: true },
      { label: 'Personas', value: m.workers_count, sub: `${m.total_shifts} turnos analizados` },
      { label: 'Descansos < 12 h', value: m.rest_violations.length, color: m.rest_violations.length ? C.red : C.green, sub: hard.length ? `${hard.length} incumplimientos` : 'ninguno' },
      { label: 'Rachas de noches', value: m.night_streaks.length, color: m.night_streaks.length ? C.amber : C.green, sub: '3 o más seguidas' },
      { label: 'Días seguidos > 6', value: m.consecutive_work_runs.length, color: m.consecutive_work_runs.length ? C.amber : C.green, sub: 'sin librar' },
      { label: 'Reparto de noches', value: { justo: 'Justo', mejorable: 'Mejorable', critico: 'Crítico' }[m.nights.verdict] || '—', color: m.nights.verdict === 'justo' ? C.green : m.nights.verdict === 'critico' ? C.red : C.amber, sub: `diferencia máx-mín: ${m.nights.range}` }
    ]);

    const current = schedule ? buildRosterRows(schedule, null) : null;
    if (current && current.dates.length && current.rows.length) {
      y = sectionLabel(M, y, `El cuadrante que nos enviaste · ${current.rows.length} personas × ${current.dates.length} días`);
      const gridBottom = rosterGrid(M, y, CW, current.dates, current.rows, { totals: true, maxH: H - y - 190 });
      y = gridBottom + 10;
      y = legend(M, y, shiftCodes, [{ color: C.red, label: 'celda en conflicto' }]) + 8;
      y = sectionLabel(M, y, 'Cobertura día a día · lo que la corrección NO toca');
      card(M, y - 4, CW, 78, { bg: '#fdfcfa' });
      y = coverageStrip(M, y, CW, current.dates, schedule, { totals: true });
    } else {
      // Sin parrilla dibujable (el documento no daba para reconstruirla): la
      // portada no se queda en blanco, lleva el resumen y el reparto de noches.
      const colTop = y;
      y = sectionLabel(M, y, 'Resumen del diagnóstico', CW * 0.62);
      if (summary && summary.headline) {
        doc.font('serif').fontSize(15).fillColor(C.ink)
          .text(String(summary.headline), M, y, { width: CW * 0.62 });
        y = doc.y + 8;
      }
      for (const p2 of (summary && Array.isArray(summary.paragraphs) ? summary.paragraphs : []).slice(0, 3)) {
        doc.font('sans').fontSize(9).fillColor(C.muted).text(String(p2), M, y, { width: CW * 0.62, lineGap: 2 });
        y = doc.y + 6;
      }
      doc.font('sans').fontSize(7.5).fillColor(C.subtle)
        .text('La parrilla completa no ha podido reconstruirse a partir del documento recibido; los hallazgos de las páginas siguientes sí se han calculado sobre los turnos extraídos.',
          M, y + 4, { width: CW * 0.62, lineGap: 1.4 });

      const nx = M + CW * 0.66;
      let ny = sectionLabel(nx, colTop, 'Reparto de noches por persona', CW * 0.34);
      const maxN0 = Math.max(1, m.nights.max);
      for (const p3 of m.nights.per_worker.slice(0, 12)) {
        const over = m.nights.overloaded.includes(p3.name);
        doc.font('sans').fontSize(7.5).fillColor(over ? C.red : C.ink)
          .text(cut(p3.name, 20), nx, ny, { width: 90, lineBreak: false });
        bar(nx + 94, ny + 1.5, CW * 0.34 - 94 - 26, p3.nights, maxN0, { color: over ? C.red : C.teal });
        doc.font('sans-bold').fontSize(7.5).fillColor(over ? C.red : C.ink)
          .text(String(p3.nights), nx + CW * 0.34 - 22, ny, { width: 22, align: 'right', lineBreak: false });
        ny += 13;
      }
    }

    // ════════════════════════════════════════════════════════════════════════
    // PÁGINA 2 · Lo que hemos encontrado
    // ════════════════════════════════════════════════════════════════════════
    doc.addPage();
    y = header('Diagnóstico', 'Lo que hemos', 'encontrado',
      'Todo lo de esta página lo calcula un motor de reglas verificado; la IA solo ha leído el documento.');

    const colW2 = (CW - 16) / 2;

    // Columna izquierda: resumen + reparto de noches
    let ly = y;
    ly = sectionLabel(M, ly, 'Resumen', colW2);
    const paras = (summary && Array.isArray(summary.paragraphs) ? summary.paragraphs : [])
      .map(p => String(p)).filter(Boolean);
    if (summary && summary.headline) {
      doc.font('sans-bold').fontSize(9.5).fillColor(C.ink)
        .text(String(summary.headline), M, ly, { width: colW2 });
      ly = doc.y + 5;
    }
    for (const p of paras.slice(0, 3)) {
      doc.font('sans').fontSize(8).fillColor(C.muted).text(p, M, ly, { width: colW2, lineGap: 1.5 });
      ly = doc.y + 4;
    }

    ly += 6;
    ly = sectionLabel(M, ly, `Reparto de noches · media ${comma(m.nights.mean)} · índice de equidad ${comma(m.nights.jain)}`, colW2);
    const maxN = Math.max(1, m.nights.max);
    for (const p of m.nights.per_worker.slice(0, 10)) {
      const over = m.nights.overloaded.includes(p.name);
      doc.font('sans').fontSize(7.5).fillColor(over ? C.red : C.ink)
        .text(cut(p.name, 22), M, ly, { width: 96, lineBreak: false });
      bar(M + 100, ly + 1.5, colW2 - 100 - 52, p.nights, maxN, { color: over ? C.red : C.teal });
      doc.font('sans-bold').fontSize(7.5).fillColor(over ? C.red : C.ink)
        .text(String(p.nights), M + colW2 - 48, ly, { width: 22, align: 'right', lineBreak: false });
      if (over) doc.font('sans').fontSize(6).fillColor(C.red).text('de más', M + colW2 - 24, ly + 0.8, { width: 24, align: 'right', lineBreak: false });
      ly += 13;
    }

    // Columna derecha: descansos + rachas
    const rx = M + colW2 + 16;
    let ry = y;
    ry = sectionLabel(rx, ry, `Descansos entre jornadas · mínimo ${m.legal_context.min_rest_hours} h`, colW2);
    if (!m.rest_violations.length) {
      card(rx, ry, colW2, 30, { bg: C.tealSoft, border: C.tealSoft, accent: C.teal });
      doc.font('sans-bold').fontSize(8.5).fillColor(C.tealDark)
        .text('Ningún descanso por debajo del mínimo en el periodo analizado.', rx + 12, ry + 11, { width: colW2 - 24, lineBreak: false });
      ry += 40;
    } else {
      doc.font('sans').fontSize(6.5).fillColor(C.subtle)
        .text('PERSONA', rx, ry, { width: 88, lineBreak: false })
        .text('SECUENCIA', rx + 92, ry, { width: colW2 - 92 - 92, lineBreak: false })
        .text('DESCANSO', rx + colW2 - 92, ry, { width: 44, align: 'right', lineBreak: false })
        .text('', rx + colW2 - 46, ry, { width: 46, align: 'right', lineBreak: false });
      ry += 10;
      for (const v of m.rest_violations.slice(0, 11)) {
        const isHard = v.severity !== 'revisar_convenio';
        doc.font('sans').fontSize(7.5).fillColor(C.ink).text(cut(v.worker, 18), rx, ry, { width: 88, lineBreak: false });
        doc.font('sans').fontSize(7).fillColor(C.muted)
          .text(`${humanSeq(v.from)} → ${humanSeq(v.to)}`, rx + 92, ry + 0.4, { width: colW2 - 92 - 96, lineBreak: false });
        doc.font('sans-bold').fontSize(7.5).fillColor(isHard ? C.red : C.amber)
          .text(comma(v.rest_hours) + ' h', rx + colW2 - 96, ry, { width: 44, align: 'right', lineBreak: false });
        doc.font('sans').fontSize(6).fillColor(isHard ? C.red : C.amber)
          .text(isHard ? 'incumple' : 'revisar', rx + colW2 - 50, ry + 0.8, { width: 50, align: 'right', lineBreak: false });
        ry += 12;
      }
      if (m.rest_violations.length > 11) {
        doc.font('sans').fontSize(7).fillColor(C.subtle)
          .text(`…y ${m.rest_violations.length - 11} más.`, rx, ry, { width: colW2, lineBreak: false });
        ry += 12;
      }
      ry += 4;
    }

    if (m.night_streaks.length || m.consecutive_work_runs.length || m.weekly_rest_issues.length) {
      ry = sectionLabel(rx, ry, 'Otros puntos de riesgo', colW2);
      const risks = [];
      for (const s of m.night_streaks.slice(0, 4)) risks.push(`${s.worker}: ${s.length} noches seguidas hasta el ${humanShort(s.end_date)}`);
      for (const r of m.consecutive_work_runs.slice(0, 3)) risks.push(`${r.worker}: ${r.length} días seguidos sin librar hasta el ${humanShort(r.end_date)}`);
      for (const w of m.weekly_rest_issues.slice(0, 3)) risks.push(`${w.worker}: ${w.days_without_weekly_rest} días sin 36 h continuas de descanso`);
      for (const t of risks.slice(0, 8)) {
        doc.font('sans').fontSize(7.5).fillColor(C.muted).text('·  ' + t, rx, ry, { width: colW2, lineBreak: false });
        ry += 11;
      }
    }

    // Fichas por persona, a lo ancho del pie de la página
    const fichasY = Math.max(ly, ry) + 10;
    if (fichasY < H - 120) {
      let fy = sectionLabel(M, fichasY, 'Ficha de cada persona en el periodo');
      const per = Math.min(7, m.nights.per_worker.length);
      if (per > 0) {
        const gap = 8;
        const fw = (CW - gap * (per - 1)) / per;
        const nightsByName = new Map(m.nights.per_worker.map(p => [p.name, p.nights]));
        const wkByName = new Map((m.weekends.per_worker || []).map(p => [p.name, p.weekend_shifts]));
        const restByName = new Map();
        for (const v of m.rest_violations) restByName.set(v.worker, (restByName.get(v.worker) || 0) + 1);
        const names = m.nights.per_worker.slice(0, per).map(p => p.name);
        names.forEach((name, i) => {
          const x = M + i * (fw + gap);
          const bad = (restByName.get(name) || 0) > 0;
          card(x, fy, fw, 62, { accent: bad ? C.red : C.teal });
          doc.font('sans-bold').fontSize(8).fillColor(C.ink).text(cut(name, 16), x + 10, fy + 9, { width: fw - 16, lineBreak: false });
          const rows = [
            ['Noches', String(nightsByName.get(name) ?? 0)],
            ['Findes', String(wkByName.get(name) ?? '—')],
            ['Descansos < 12 h', String(restByName.get(name) || 0)]
          ];
          rows.forEach(([k, v2], j) => {
            const ty = fy + 24 + j * 11;
            doc.font('sans').fontSize(6.5).fillColor(C.subtle).text(k, x + 10, ty, { width: fw - 40, lineBreak: false });
            doc.font('sans-bold').fontSize(7).fillColor(k.startsWith('Descansos') && (restByName.get(name) || 0) > 0 ? C.red : C.ink)
              .text(v2, x + fw - 30, ty - 0.4, { width: 20, align: 'right', lineBreak: false });
          });
        });
        fy += 62;
      }
      void fy;
    }

    // ════════════════════════════════════════════════════════════════════════
    // PÁGINA 3 · El cuadrante corregido (solo si hay cambios que proponer)
    // ════════════════════════════════════════════════════════════════════════
    const hasFix = fix && fix.changed && fix.changes.length && fix.schedule;
    if (hasFix) {
      doc.addPage();
      const after = fix.after || null;
      y = header('Propuesta', 'Tu cuadrante,', 'corregido',
        `${fix.changes.length} ${fix.changes.length === 1 ? 'día cambiado' : 'días cambiados'} · misma gente en cada turno que en tu cuadrante: solo cambia quién lo hace`);

      const deltas = [
        { label: 'Puntuación', value: after ? after.score : '—', unit: '/100', sub: `antes ${m.score}`, dark: true },
        { label: 'Descansos < 12 h', value: after ? after.rest_violations.length : '—', color: after && after.rest_violations.length ? C.amber : C.green, sub: `antes ${m.rest_violations.length}` },
        { label: 'Rachas de noches', value: after ? after.night_streaks.length : '—', color: after && after.night_streaks.length ? C.amber : C.green, sub: `antes ${m.night_streaks.length}` },
        { label: 'Días seguidos > 6', value: after ? after.consecutive_work_runs.length : '—', color: after && after.consecutive_work_runs.length ? C.amber : C.green, sub: `antes ${m.consecutive_work_runs.length}` },
        { label: 'Diferencia de noches', value: after ? after.nights.range : '—', color: after && after.nights.range > 2 ? C.amber : C.green, sub: `antes ${m.nights.range}` },
        { label: 'Cambios propuestos', value: fix.changes.length, color: C.teal, sub: 'todos reversibles' }
      ];
      y = kpiRow(y, deltas);

      const changedSet = new Set();
      for (const c of fix.changes) for (const mv of c.moves) changedSet.add(mv.worker + '|' + c.date);
      const fixed = buildRosterRows(fix.schedule, changedSet);
      // En la parrilla corregida solo se resaltan los cambios, no los conflictos
      for (const r of fixed.rows) for (const cell of r.cells) if (cell.flag === 'conflict') cell.flag = null;

      y = sectionLabel(M, y, 'Cuadrante corregido · en verde, las celdas que cambian');
      const gridBottom = rosterGrid(M, y, CW, fixed.dates, fixed.rows, { totals: true, maxH: 190 });
      y = gridBottom + 10;
      y = legend(M, y, shiftCodes, [{ color: C.teal, label: 'celda cambiada' }]) + 4;

      // Lista de cambios en dos columnas
      y = sectionLabel(M, y, 'Qué cambia exactamente y por qué');
      const half = (CW - 16) / 2;
      const perCol = Math.ceil(Math.min(fix.changes.length, 8) / 2);
      fix.changes.slice(0, 8).forEach((c, i) => {
        const col = i < perCol ? 0 : 1;
        const row = i % perCol;
        const cx = M + col * (half + 16);
        const cy = y + row * 26;
        if (cy + 24 > H - 40) return;
        doc.font('sans-bold').fontSize(7).fillColor(C.ink)
          .text(`${dowOf(c.date)} ${dayNum(c.date)}`, cx, cy, { width: 30, lineBreak: false });
        const txt = c.moves.map(mv => `${cut(mv.worker, 12)} ${mv.from || 'libre'}→${mv.to || 'libre'}`).join('   ');
        doc.font('sans').fontSize(7).fillColor(C.muted).text(cut(txt, 78), cx + 32, cy, { width: half - 34, lineBreak: false });
        doc.font('sans').fontSize(6.5).fillColor(C.teal).text(cut(c.reason, 88), cx + 32, cy + 10, { width: half - 34, lineBreak: false });
      });
      y += Math.min(fix.changes.length, 8) > 0 ? perCol * 26 + 6 : 0;

      if (after && after.rest_violations.length === 0 && m.rest_violations.length > 0) {
        card(M, y, CW, 30, { bg: C.tealSoft, border: C.tealSoft, accent: C.teal });
        doc.font('sans-bold').fontSize(8.5).fillColor(C.tealDark)
          .text(`Con estos ${fix.changes.length} cambios desaparecen los ${m.rest_violations.length} descansos por debajo del mínimo, sin tocar la cobertura de ningún turno.`,
            M + 12, y + 11, { width: CW - 24, lineBreak: false });
      }
    }

    // ════════════════════════════════════════════════════════════════════════
    // PÁGINA 4 · Cierre
    // ════════════════════════════════════════════════════════════════════════
    doc.addPage();
    y = header('Siguiente paso', 'Esto es una foto.', 'Shiftia lo mantiene así',
      'El diagnóstico y la corrección de estas páginas los ha hecho Shiftia en segundos con el documento que nos enviaste.');

    const half2 = (CW - 16) / 2;
    let cy2 = sectionLabel(M, y, 'Marco legal aplicado', half2);
    doc.font('sans').fontSize(8).fillColor(C.muted)
      .text(m.legal_context.note, M, cy2, { width: half2, lineGap: 1.5 });
    cy2 = doc.y + 8;
    for (const ref of m.legal_context.legal_refs.slice(0, 4)) {
      doc.font('sans').fontSize(7).fillColor(C.subtle).text('·  ' + ref, M, cy2, { width: half2 });
      cy2 = doc.y + 2;
    }
    cy2 += 8;
    cy2 = sectionLabel(M, cy2, 'Supuestos del cálculo', half2);
    doc.font('sans').fontSize(7).fillColor(C.subtle)
      .text(`Descanso mínimo de ${m.assumptions.min_rest_hours} h entre el fin de una jornada y el inicio de la siguiente. Horarios aplicados: ${m.assumptions.shift_definitions.join(', ') || 'los del documento'}. Tu cuadrante se elimina tras el análisis. Este diagnóstico es informativo y no constituye asesoramiento legal.`,
        M, cy2, { width: half2, lineGap: 1.4 });

    // Tarjeta oscura de cierre
    const cardX = M + half2 + 16;
    card(cardX, y, half2, 150, { bg: C.ink, border: C.ink, r: 12 });
    doc.font('serif').fontSize(19).fillColor(C.paper)
      .text('¿Lo montamos con tu plantilla entera?', cardX + 22, y + 24, { width: half2 - 44 - (qrBuffer ? 80 : 0) });
    doc.font('sans').fontSize(8.5).fillColor('#b9b5ab')
      .text('Con tu cuadro de personal, los contratos y las vacaciones del año, Shiftia genera el mes completo respetando el convenio y avisa de cada conflicto antes de que llegue. Te lo enseñamos en 15 minutos con tus datos.',
        cardX + 22, doc.y + 8, { width: half2 - 44 - (qrBuffer ? 80 : 0), lineGap: 1.6 });
    doc.font('sans-bold').fontSize(9).fillColor(C.paper)
      .text('shiftia.es  ·  info@shiftia.es  ·  663 50 46 47', cardX + 22, y + 150 - 34, { width: half2 - 44, lineBreak: false });
    if (qrBuffer) {
      doc.save().roundedRect(cardX + half2 - 86, y + 24, 64, 64, 6).fill('#ffffff').restore();
      try { doc.image(qrBuffer, cardX + half2 - 82, y + 28, { width: 56 }); } catch (e) { /* sin QR */ }
      doc.font('sans').fontSize(6).fillColor('#b9b5ab')
        .text('Agenda aquí', cardX + half2 - 86, y + 92, { width: 64, align: 'center', lineBreak: false });
    }

    // Lo que entra en la misma herramienta, además de este diagnóstico.
    // Sin nombres de clientes: la decisión de no citarlos vale también aquí.
    const featY = Math.max(cy2, y + 150) + 18;
    if (featY < H - 150) {
      let fy2 = sectionLabel(M, featY, 'Lo que hace Shiftia además de auditar');
      const FEATS = [
        ['Genera el mes entero', 'Describe en una frase cómo lo quieres y la IA construye el cuadrante completo.'],
        ['Cubre las ausencias', 'Ante una baja propone 3 personas de tu plantilla en menos de un segundo, y por qué.'],
        ['Vigila el convenio', 'Descansos, noches seguidas, jornadas reducidas y festivos. No genera turnos que rompan las reglas.'],
        ['Reparte con equidad', 'Mide las noches y los fines de semana por persona y avisa cuando alguien acumula de más.'],
        ['Lee tu PDF o Excel', 'Importa el cuadrante que ya usas sin picarlo de nuevo, como se ha hecho con el de estas páginas.'],
        ['App para el equipo', 'Cada persona ve sus turnos en el móvil, pide días y propone cambios. Tú apruebas.'],
        ['Vacaciones y ausencias', 'Avisa si unas fechas dejan un turno descubierto antes de concederlas.'],
        ['Control horario', 'Horas por persona y coste por turno, cuadrados con el convenio y listos para nómina.']
      ];
      const cols = 4, gap2 = 9;
      const fw2 = (CW - gap2 * (cols - 1)) / cols;
      FEATS.forEach((f, i) => {
        const col = i % cols, row = Math.floor(i / cols);
        const fx = M + col * (fw2 + gap2);
        const fyy = fy2 + row * 58;
        if (fyy + 52 > H - 36) return;
        card(fx, fyy, fw2, 52);
        doc.font('sans-bold').fontSize(8).fillColor(C.ink)
          .text(f[0], fx + 11, fyy + 9, { width: fw2 - 22, lineBreak: false });
        doc.font('sans').fontSize(6.8).fillColor(C.muted)
          .text(f[1], fx + 11, fyy + 21, { width: fw2 - 22, height: 26, lineGap: 1.2, ellipsis: true });
      });
    }

    footer();
    doc.end();
  });
}

module.exports = { buildAuditPdf };
