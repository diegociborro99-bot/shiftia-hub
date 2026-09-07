/* ==========================================================================
   Funciones en acción — simuladores del producto (landing shiftia.es)
   Replica las vistas reales de Shiftia (Día/Cobertura, Mes, Equipo, Importar,
   Conflictos) con datos de ejemplo. Nombres y plantillas ficticios.
   Sin manejadores inline (CSP con nonce): todo se engancha aquí.
   ========================================================================== */
(function () {
  'use strict';

  /* <pure> — lógica sin DOM (reglas, solver, comprobador), testeable en Node */
  var NAMES = ['Ana G.', 'Marcos R.', 'Lucía P.', 'Iván T.', 'Sara M.', 'Pablo N.', 'Elena V.', 'Jorge C.'];
  var COLORS = ['#0f7a6d', '#1a5a96', '#7c5fb8', '#c26360', '#b8730a', '#2e8b7a', '#5b5bd6', '#8a6d3b'];
  var DAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  var DAYL = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'];
  var DAYF = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

  var SECTORS = {
    sanidad: {
      label: 'Hospital / Residencia', org: 'Residencia Los Robles · Planta 2', group: 'Enfermería y auxiliares', url: 'residencia-los-robles',
      roles: ['Enfermería', 'Enfermería', 'T.C.A.E.', 'Enfermería', 'Auxiliar', 'Celador', 'Enfermería', 'T.C.A.E.'],
      shifts: { M: { code: 'MAÑ', name: 'Mañana', hours: '8–15' }, T: { code: 'TAR', name: 'Tarde', hours: '15–22' }, N: { code: 'NOC', name: 'Noche', hours: '22–8' }, L: { code: 'LIB', name: 'Libre', hours: '' } },
      rules: { afterN: ['L', 'N'], noTM: true, maxDays: 6, maxN: 3, cover: { M: 1, T: 1, N: 1 } },
      eq: { one: 'noche', many: 'noches', cons: 'Noches consecutivas', exempt: 'Exento · convenio (nocturnidad)' },
      absent: { name: 'Marina L.', role: 'Enfermería', cause: 'baja (IT)' },
      file: 'plantilla_personal.xlsx', catCol: 'Categoría',
      cons: [
        { id: 'weT', label: 'Refuerza las tardes del finde' },
        { id: 'max5', label: 'Máximo 5 días seguidos' },
        { id: 'noN2', label: 'Sin noches para Lucía P.' }
      ]
    },
    retail: {
      label: 'Retail', org: 'Tienda Centro · Moda', group: 'Equipo de tienda', url: 'tienda-centro',
      roles: ['Encargada', 'Dependiente', 'Dependienta', 'Cajero', 'Dependienta', 'Reponedor', 'Cajera', 'Dependiente'],
      shifts: { M: { code: 'APE', name: 'Apertura', hours: '9:30–15' }, T: { code: 'TAR', name: 'Tarde', hours: '15–22' }, N: { code: 'CIE', name: 'Cierre', hours: '16–23:30' }, L: { code: 'LIB', name: 'Libre', hours: '' } },
      rules: { afterN: ['L', 'T', 'N'], noTM: true, maxDays: 6, maxN: 3, cover: { M: 1, T: 1, N: 1 } },
      eq: { one: 'cierre', many: 'cierres', cons: 'Cierres consecutivos', exempt: 'Exento · jornada reducida' },
      absent: { name: 'Marina L.', role: 'Dependienta', cause: 'baja (IT)' },
      file: 'personal_tienda.xlsx', catCol: 'Puesto',
      cons: [
        { id: 'weT', label: 'Refuerza las tardes del finde' },
        { id: 'max5', label: 'Máximo 5 días seguidos' },
        { id: 'noN2', label: 'Sin cierres para Lucía P.' }
      ]
    },
    hosteleria: {
      label: 'Hostelería', org: 'Restaurante La Plaza', group: 'Sala y cocina', url: 'restaurante-la-plaza',
      roles: ['Jefa de sala', 'Camarero', 'Cocina', 'Camarera', 'Barra', 'Cocina', 'Camarera', 'Camarero'],
      shifts: { M: { code: 'DES', name: 'Desayunos', hours: '7–15' }, T: { code: 'COM', name: 'Comidas', hours: '12–20' }, N: { code: 'CIE', name: 'Cierre', hours: '17–1' }, L: { code: 'LIB', name: 'Libre', hours: '' } },
      rules: { afterN: ['L', 'N'], noTM: true, maxDays: 6, maxN: 3, cover: { M: 1, T: 1, N: 1 } },
      eq: { one: 'cierre', many: 'cierres', cons: 'Cierres consecutivos', exempt: 'Exento · jornada reducida' },
      absent: { name: 'Marina L.', role: 'Camarera', cause: 'baja (IT)' },
      file: 'plantilla_restaurante.pdf', catCol: 'Puesto',
      cons: [
        { id: 'weT', label: 'Refuerza las comidas del finde' },
        { id: 'max5', label: 'Máximo 5 días seguidos' },
        { id: 'noN2', label: 'Sin cierres para Lucía P.' }
      ]
    }
  };

  // Ciclo rotatorio base por tamaño de equipo: mañanas → tardes → noche → libres.
  // El orden garantiza transiciones legales (nunca T→M ni N→M/T) y cobertura
  // idéntica cada día; la racha máxima es n − nº de libres.
  function cycleFor(n, opts) {
    var base = { 5: ['M', 'M', 'T', 'N', 'L'], 6: ['M', 'M', 'T', 'N', 'L', 'L'], 7: ['M', 'M', 'T', 'T', 'N', 'L', 'L'], 8: ['M', 'M', 'M', 'T', 'T', 'N', 'L', 'L'] }[n] || ['M', 'M', 'T', 'N', 'L', 'L'];
    var cyc = base.slice(), maxDays = opts.maxDays || 6;
    function runLen(c) { var l = 0; c.forEach(function (x) { if (x === 'L') l++; }); return c.length - l; }
    while (runLen(cyc) > maxDays && cyc.filter(function (x) { return x === 'M'; }).length > 1) { cyc[cyc.lastIndexOf('M')] = 'L'; cyc.sort(function (a, b) { return 'MTNL'.indexOf(a) - 'MTNL'.indexOf(b); }); }
    return cyc;
  }

  // Generador: rotación cíclica + instrucciones (refuerzo de finde, tope de racha,
  // exención de noches). Devuelve grid[persona][día] con 'M'|'T'|'N'|'L'.
  function solve(sector, n, days, opts) {
    var cyc = cycleFor(n, opts), grid = [], counts = [], over = {}, d, i, maxDays = opts.maxDays || sector.rules.maxDays;
    for (i = 0; i < n; i++) { grid.push([]); counts.push({ M: 0, T: 0, N: 0, L: 0, run: 0 }); }
    var mLast = cyc.lastIndexOf('M');                                 // último hueco de mañana (le sigue tarde)
    function countOf(arr, sh) { var c = 0; arr.forEach(function (x) { if (x === sh) c++; }); return c; }
    for (d = 0; d < days; d++) {
      var today = [];
      for (i = 0; i < n; i++) today.push(over[i + ':' + d] || cyc[(i + d) % n]);
      if (opts.noNight >= 0 && opts.noNight < n && today[opts.noNight] === 'N') {
        // La persona exenta libra; hace la noche quien libra hoy y puede descansar
        // mañana (o se le fuerza el descanso), eligiendo a quien menos noches lleva.
        var best = -1, bestCost = Infinity, bestOver = false, spareM = countOf(today, 'M') >= 2, tomorrowAll = [];
        for (i = 0; i < n; i++) tomorrowAll.push(d + 1 < days ? (over[i + ':' + (d + 1)] || cyc[(i + d + 1) % n]) : 'L');
        for (i = 0; i < n; i++) {
          if (i === opts.noNight) continue;
          if (today[i] !== 'L' && !(today[i] === 'M' && spareM)) continue;
          var tomorrow = tomorrowAll[i];
          var needsOver = tomorrow !== 'L';
          if (needsOver && countOf(tomorrowAll, tomorrow) < 2) continue; // mañana faltaría cobertura
          if (!needsOver && counts[i].run + 1 > maxDays) continue;      // rompería la racha máxima
          var cost = counts[i].N * 10 + (needsOver ? 5 : 0) + (today[i] === 'M' ? 3 : 0); // reparte noches; evita forzar descansos
          if (cost < bestCost) { bestCost = cost; best = i; bestOver = needsOver; }
        }
        if (best >= 0) {
          today[best] = 'N';
          if (bestOver) over[best + ':' + (d + 1)] = 'L';
          today[opts.noNight] = 'L';
        }
      }
      if (opts.weT && d % 7 >= 5 && countOf(today, 'M') >= 2) for (i = 0; i < n; i++) if ((i + d) % n === mLast && today[i] === 'M') today[i] = 'T';
      for (i = 0; i < n; i++) { grid[i].push(today[i]); counts[i][today[i]]++; counts[i].run = today[i] === 'L' ? 0 : counts[i].run + 1; }
    }
    var holes = check(sector, grid, opts).filter(function (x) { return x.rule === 'Cobertura mínima'; }).length;
    return { grid: grid, counts: counts, holes: holes, cycle: cyc };
  }

  // Comprobador de convenio: devuelve incidencias {sev, rule, p, d, text}
  function check(sector, grid, opts) {
    var rules = sector.rules, S = sector.shifts, issues = [], n = grid.length, days = n ? grid[0].length : 0;
    var maxDays = (opts && opts.maxDays) || rules.maxDays;
    for (var i = 0; i < n; i++) {
      var run = 0, nrun = 0;
      for (var d = 0; d < days; d++) {
        var cur = grid[i][d], prev = d > 0 ? grid[i][d - 1] : null, dn = DAYL[d % 7];
        if (prev === 'N' && rules.afterN.indexOf(cur) < 0) {
          issues.push({ sev: 'bad', rule: 'Descanso post-' + sector.eq.one, p: i, d: d, text: S.N.name.toLowerCase() + ' el ' + DAYL[(d - 1) % 7] + ' y ' + S[cur].name.toLowerCase() + ' el ' + dn + ': descanso inferior a 12 h', ref: 'art. 34.3 ET' });
        } else if (prev === 'T' && cur === 'M' && rules.noTM) {
          issues.push({ sev: 'bad', rule: 'Descanso mínimo entre jornadas', p: i, d: d, text: S.T.name.toLowerCase() + ' el ' + DAYL[(d - 1) % 7] + ' y ' + S.M.name.toLowerCase() + ' el ' + dn + ': menos de 12 h de descanso', ref: 'art. 34.3 ET' });
        }
        run = cur === 'L' ? 0 : run + 1;
        if (run === maxDays + 1) issues.push({ sev: 'bad', rule: 'Días consecutivos', p: i, d: d, text: 'encadena ' + run + ' días seguidos (máximo de convenio: ' + maxDays + ')', ref: 'convenio' });
        nrun = cur === 'N' ? nrun + 1 : 0;
        if (nrun === rules.maxN + 1) issues.push({ sev: 'warn', rule: sector.eq.cons, p: i, d: d, text: nrun + ' ' + sector.eq.many + ' seguid' + (sector.eq.one === 'noche' ? 'as' : 'os') + ' (tope: ' + rules.maxN + ')', ref: 'regla interna' });
        if (opts && opts.noNight === i && cur === 'N') issues.push({ sev: 'bad', rule: 'Exención', p: i, d: d, text: 'tiene exención de ' + sector.eq.many, ref: 'convenio' });
      }
    }
    for (var dd = 0; dd < days; dd++) {
      var c = { M: 0, T: 0, N: 0 };
      for (var k = 0; k < n; k++) if (c[grid[k][dd]] !== undefined) c[grid[k][dd]]++;
      Object.keys(rules.cover).forEach(function (sh) {
        if (c[sh] < rules.cover[sh]) issues.push({ sev: 'warn', rule: 'Cobertura mínima', p: -1, d: dd, text: DAYF[dd % 7].charAt(0).toUpperCase() + DAYF[dd % 7].slice(1) + ' · ' + S[sh].name.toLowerCase() + ': ' + c[sh] + '/' + rules.cover[sh] + ' personas', ref: 'mínimos del servicio' });
      });
    }
    return issues;
  }

  // Semana base de la vista Conflictos (8 filas; se recorta al tamaño del equipo).
  // Contiene exactamente 4 incidencias en las filas 0-2 y domingo noche.
  var CONF_WEEK = [
    ['M', 'M', 'T', 'T', 'N', 'M', 'L'],
    ['M', 'M', 'M', 'T', 'T', 'T', 'T'],
    ['L', 'T', 'N', 'N', 'N', 'N', 'L'],
    ['T', 'N', 'L', 'L', 'M', 'L', 'L'],
    ['N', 'L', 'M', 'M', 'L', 'L', 'M'],
    ['T', 'L', 'L', 'M', 'M', 'T', 'L'],
    ['L', 'M', 'M', 'L', 'T', 'T', 'T'],
    ['M', 'T', 'L', 'M', 'L', 'M', 'T']
  ];
  var CONF_FIXES = [
    { p: 0, d: 5, from: 'M', to: 'L', why: 'descanso tras la noche del viernes' },
    { p: 4, d: 5, from: 'L', to: 'M', why: 'mantiene la cobertura de mañana del sábado' },
    { p: 1, d: 3, from: 'T', to: 'L', why: 'corta la racha de 7 días seguidos' },
    { p: 2, d: 2, from: 'N', to: 'L', why: 'deja 3 noches seguidas como máximo' },
    { p: 3, d: 2, from: 'L', to: 'N', why: 'cubre la noche del miércoles' },
    { p: 3, d: 6, from: 'L', to: 'N', why: 'cobertura mínima del domingo noche' }
  ];

  function stats(vals) {
    var n = vals.length, sum = vals.reduce(function (a, b) { return a + b; }, 0), mean = sum / n;
    var sd = Math.sqrt(vals.reduce(function (a, v) { return a + (v - mean) * (v - mean); }, 0) / n);
    var sq = vals.reduce(function (a, v) { return a + v * v; }, 0);
    return { mean: mean, sd: sd, range: Math.max.apply(null, vals) - Math.min.apply(null, vals), jain: sq ? (sum * sum) / (n * sq) : 1 };
  }
  // Redistribución: mueve del que más tiene al que menos hasta que la diferencia sea ≤1
  function redistribute(vals, exempt) {
    var out = vals.slice(), moves = [];
    for (var it = 0; it < 40; it++) {
      var hi = -1, lo = -1;
      for (var i = 0; i < out.length; i++) {
        if (exempt.indexOf(i) >= 0) continue;
        if (hi < 0 || out[i] > out[hi]) hi = i;
        if (lo < 0 || out[i] < out[lo]) lo = i;
      }
      if (hi < 0 || out[hi] - out[lo] <= 1) break;
      out[hi]--; out[lo]++; moves.push({ from: hi, to: lo });
    }
    return { vals: out, moves: moves };
  }
  var SX_PURE = { NAMES: NAMES, COLORS: COLORS, SECTORS: SECTORS, solve: solve, check: check, CONF_WEEK: CONF_WEEK, CONF_FIXES: CONF_FIXES, stats: stats, redistribute: redistribute, cycleFor: cycleFor };
  if (typeof module !== 'undefined' && module.exports) { module.exports = SX_PURE; return; }
  /* </pure> */

  var root = document.getElementById('demo-funciones');
  if (!root) return;
  var MOTION = !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  function q(s, c) { return (c || root).querySelector(s); }
  function qa(s, c) { return Array.prototype.slice.call((c || root).querySelectorAll(s)); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, MOTION ? ms : 0); }); }
  function initials(n) { return n.split(/\s+/).map(function (p) { return p.charAt(0); }).join('').slice(0, 2).toUpperCase(); }
  function av(p, lg) { return '<span class="sx-av' + (lg ? ' lg' : '') + '" style="background:' + p.color + '" aria-hidden="true">' + initials(p.name) + '</span>'; }
  function who(p, sub) { return '<span class="sx-who">' + av(p) + '<span class="sx-who-t"><b>' + esc(p.name) + '</b><span>' + esc(sub || p.role) + '</span></span></span>'; }
  function fmt1(x) { return (Math.round(x * 10) / 10).toFixed(1).replace('.', ','); }
  var I = {
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>',
    spark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8"/></svg>',
    warn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.3 3.8 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.8a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/></svg>',
    bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0"/></svg>',
    undo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-15-6.7L3 13"/></svg>',
    doc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/></svg>',
    up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 16V6M8 10l4-4 4 4M5 19h14"/></svg>',
    phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6" y="2" width="12" height="20" rx="2"/><path d="M11 18h2"/></svg>'
  };

  var state = { sector: 'sanidad', team: 6, feature: 0 };
  function S() { return SECTORS[state.sector]; }
  function team() { var s = S(); return NAMES.slice(0, state.team).map(function (n, i) { return { i: i, name: n, role: s.roles[i], color: COLORS[i] }; }); }
  function pill(sh, extra, label) { var s = S(); return '<span class="sx-pill ' + sh + (extra ? ' ' + extra : '') + '" title="' + esc(s.shifts[sh].name + (s.shifts[sh].hours ? ' ' + s.shifts[sh].hours : '')) + '">' + esc(label || s.shifts[sh].code) + '</span>'; }
  function legend() { var s = S(); return ['M', 'T', 'N', 'L'].map(function (k) { return '<span><i class="' + k + '"></i>' + esc(s.shifts[k].name) + (s.shifts[k].hours ? ' <small style="color:var(--ink3)">' + esc(s.shifts[k].hours) + '</small>' : '') + '</span>'; }).join(''); }

  /* ====================================================================
     Vista 0 · Cubrir una baja (Día + Gestor de cobertura)
     ==================================================================== */
  var cov = { busy: false, timer: null };
  function covCandidates(free) {
    // Rasgos deterministas por persona (carga, descanso, historial…)
    var traits = [
      { nights: 2, consec: 2, accept: 90, pref: true, rest: 26, poly: 80 },
      { nights: 4, consec: 4, accept: 70, pref: false, rest: 14, poly: 60 },
      { nights: 1, consec: 1, accept: 80, pref: true, rest: 38, poly: 90 },
      { nights: 3, consec: 3, accept: 60, pref: false, rest: 18, poly: 55 },
      { nights: 5, consec: 0, accept: 50, pref: true, rest: 50, poly: 70 }
    ];
    var s = S();
    return free.map(function (p, k) {
      var t = traits[k % traits.length];
      var score = 58 + (5 - t.nights) * 4 + Math.round(t.accept / 8) + (t.pref ? 6 : 0) - t.consec * 2 + Math.min(t.rest, 40) / 8;
      score = Math.max(61, Math.min(97, Math.round(score)));
      var why = [
        { c: 'ok', t: 'Descanso ≥ 12 h (' + t.rest + ' h)' },
        { c: t.nights <= 2 ? 'ok' : 'warn', t: t.nights + ' ' + (t.nights === 1 ? s.eq.one : s.eq.many) + ' este mes' },
        { c: t.accept >= 75 ? 'ok' : '', t: 'Acepta el ' + t.accept + ' % de las coberturas' },
        { c: t.pref ? 'ok' : '', t: t.pref ? 'Prefiere ' + s.eq.many : 'Sin preferencia' }
      ];
      if (t.consec) why.push({ c: t.consec >= 4 ? 'warn' : '', t: t.consec + ' días seguidos' });
      var crit = [100 - t.nights * 14, Math.min(100, t.rest * 2), 100 - t.consec * 12, t.accept, t.poly, t.pref ? 92 : 55, 70 + (k * 7) % 25];
      return { p: p, score: score, why: why, crit: crit };
    }).sort(function (a, b) { return b.score - a.score; });
  }
  function renderCov() {
    var s = S(), ppl = team(), n = ppl.length, v = q('[data-view="0"]');
    var M = [ppl[0], ppl[1]], T = [ppl[2]], free = ppl.slice(3);
    var withPeople = M.length + T.length;
    var need = withPeople + 1;
    v.innerHTML =
      '<div class="sx-h">' +
        '<div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">' +
          '<div class="sx-daynav" aria-hidden="true"><button type="button" tabindex="-1">‹</button><button type="button" tabindex="-1">›</button><span>Hoy</span></div>' +
          '<div class="sx-dayt"><span class="sx-eyebrow">Sábado · semana 2 · septiembre 2026</span><strong>12 de septiembre <span class="sx-tag acc">hoy</span></strong></div>' +
        '</div>' +
        '<div class="sx-actions">' +
          '<span class="sx-stat"><b id="sxCovCount">' + withPeople + '/' + need + '</b> con gente</span>' +
          '<span class="sx-stat"><b class="bad">1</b> ausente</span>' +
          '<span class="sx-stat"><b class="bad" id="sxCovHoles">1</b> hueco</span>' +
        '</div>' +
      '</div>' +
      '<div class="sx-card sx-alert" id="sxCovAlert">' +
        '<span class="sx-alert-ico">' + I.warn + '</span>' +
        '<div class="sx-alert-t"><b>' + esc(s.absent.name) + '</b> ha causado ' + esc(s.absent.cause) + ' — el turno de <b>' + esc(s.shifts.N.name.toLowerCase()) + ' ' + esc(s.shifts.N.hours) + '</b> se queda sin cubrir.<small>Mínimo del servicio: 1 · asignadas: 0 · aviso creado a las 07:42</small></div>' +
        '<button type="button" class="sx-btn grad" id="sxCovGo">' + I.spark + ' Sugerir cobertura</button>' +
      '</div>' +
      '<div class="sx-cols">' +
        '<div class="sx-card sx-slots">' +
          '<div class="sx-slothead"><span class="sx-eyebrow"><i></i>' + esc(s.group) + '</span><small><b id="sxCovOk">' + withPeople + '/' + need + '</b> con gente · ordinaria</small></div>' +
          slot('M', M) + slot('T', T) +
          '<div class="sx-slot"><div class="sx-slot-l"><b>' + esc(s.shifts.N.name) + '</b><span>' + esc(s.shifts.N.hours) + '</span></div><div class="sx-slot-r" id="sxCovN">' +
            '<span class="sx-person off" style="--c:' + COLORS[7] + '"><span class="sx-av" style="background:#b8b6b0">' + initials(s.absent.name) + '</span>' + esc(s.absent.name) + ' <small>BAJA</small></span>' +
            '<span class="sx-hole" id="sxCovHole">' + I.warn + ' 1 persona sin cubrir</span>' +
          '</div></div>' +
        '</div>' +
        '<div class="sx-side" id="sxCovSide">' +
          '<div class="sx-card" style="padding:12px 14px"><span class="sx-eyebrow">Gestor de cobertura</span>' +
            '<div class="sx-prog" id="sxCovProg"><i></i></div><div class="sx-status" id="sxCovStatus" aria-live="polite">Pulsa <b>Sugerir cobertura</b>: Shiftia compara ' + (n - 3) + ' personas disponibles con 11 criterios.</div></div>' +
          '<div class="sx-cands" id="sxCovCands"></div>' +
          '<div class="sx-discard" id="sxCovDiscard" hidden></div>' +
        '</div>' +
      '</div>';
    function slot(sh, list) {
      return '<div class="sx-slot"><div class="sx-slot-l"><b>' + esc(s.shifts[sh].name) + '</b><span>' + esc(s.shifts[sh].hours) + '</span></div><div class="sx-slot-r">' +
        list.map(function (p) { return '<span class="sx-person" style="--c:' + p.color + '">' + av(p) + esc(p.name) + ' <small>' + esc(p.role) + '</small></span>'; }).join('') + '</div></div>';
    }
    q('#sxCovGo').addEventListener('click', covSuggest);
    cov.busy = false;
    cov.free = free; cov.M = M; cov.T = T;
  }
  function covSuggest() {
    if (cov.busy) return;
    cov.busy = true;
    var s = S(), btn = q('#sxCovGo'), prog = q('#sxCovProg i'), st = q('#sxCovStatus'), cands = q('#sxCovCands');
    btn.classList.add('busy'); btn.disabled = true;
    cands.innerHTML = '';
    var steps = ['Leyendo descansos y turnos de hoy…', 'Aplicando convenio: 12 h, días seguidos, exenciones…', 'Puntuando carga, preferencias e historial (11 criterios)…'];
    st.textContent = steps[0]; prog.style.width = '30%';
    wait(450).then(function () { st.textContent = steps[1]; prog.style.width = '65%'; return wait(450); })
      .then(function () { st.textContent = steps[2]; prog.style.width = '100%'; return wait(500); })
      .then(function () {
        var list = covCandidates(cov.free), top = list.slice(0, 3);
        st.innerHTML = '<b>' + top.length + ' candidat' + (top.length === 1 ? 'a/o' : 'as/os') + '</b> en 0,4 s · ' + (cov.M.length + cov.T.length) + ' descartados por convenio';
        cands.innerHTML = top.map(function (c, k) {
          return '<div class="sx-card sx-cand' + (k === 0 ? ' top' : '') + '" data-k="' + k + '" style="animation-delay:' + (k * 90) + 'ms">' +
            '<span class="sx-ring" style="--p:' + c.score + '"><b>' + c.score + '</b></span>' +
            '<div><span class="sx-rank">#' + (k + 1) + '</span><b style="font-size:13px">' + esc(c.p.name) + '</b> <span style="color:var(--ink3);font-size:11.5px">· ' + esc(c.p.role) + '</span>' +
              '<div class="sx-why">' + c.why.slice(0, 3).map(function (w) { return '<span class="' + w.c + '">' + esc(w.t) + '</span>'; }).join('') + '</div>' +
              '<div class="sx-crit" aria-hidden="true">' + c.crit.map(function (h, j) { return '<i class="' + (j < 3 ? '' : j < 6 ? 's' : 'hst') + '" style="--h:' + h + ';animation-delay:' + (j * 40) + 'ms"></i>'; }).join('') + '</div>' +
              (k === 0 ? '<div class="sx-critl"><span><i></i>objetivos</span><span><i class="s"></i>subjetivos</span><span><i class="hst"></i>historial</span></div>' : '') +
            '</div>' +
            '<button type="button" class="sx-btn sm' + (k === 0 ? ' dark' : '') + '" data-pick="' + k + '">Asignar</button>' +
          '</div>';
        }).join('');
        var disc = q('#sxCovDiscard');
        disc.hidden = false;
        disc.innerHTML = '<b>Descartados por convenio:</b> ' + cov.M.map(function (p) { return esc(p.name) + ' (' + esc(s.shifts.M.name.toLowerCase()) + ' hoy · descanso insuficiente)'; }).concat(cov.T.map(function (p) { return esc(p.name) + ' (' + esc(s.shifts.T.name.toLowerCase()) + ' hoy · doble turno)'; })).join(', ') + '.';
        qa('[data-pick]', cands).forEach(function (b) { b.addEventListener('click', function () { covAssign(top[+b.getAttribute('data-pick')], +b.getAttribute('data-pick')); }); });
        btn.classList.remove('busy'); btn.disabled = false; btn.innerHTML = I.spark + ' Volver a sugerir';
        cov.busy = false;
      });
  }
  function covAssign(c, k) {
    var s = S(), hole = q('#sxCovHole'), slotN = q('#sxCovN'), alert = q('#sxCovAlert'), st = q('#sxCovStatus');
    if (!hole) return;
    qa('.sx-cand').forEach(function (el, j) { el.classList.toggle('picked', j === k); el.classList.toggle('gone', j !== k); qa('button', el).forEach(function (b) { b.disabled = true; }); });
    hole.remove();
    slotN.insertAdjacentHTML('beforeend', '<span class="sx-person new" style="--c:' + c.p.color + '">' + av(c.p) + esc(c.p.name) + ' <small>' + esc(c.p.role) + '</small></span>');
    var withPeople = cov.M.length + cov.T.length + 1, need = withPeople;
    q('#sxCovCount').textContent = withPeople + '/' + need; q('#sxCovCount').classList.add('ok');
    q('#sxCovOk').textContent = withPeople + '/' + need;
    q('#sxCovHoles').textContent = '0'; q('#sxCovHoles').className = 'ok';
    alert.classList.add('ok');
    alert.innerHTML = '<span class="sx-alert-ico">' + I.check + '</span>' +
      '<div class="sx-alert-t"><b>' + esc(s.shifts.N.name) + ' cubierta con ' + esc(c.p.name) + '</b> · puntuación ' + c.score + '/100.<small id="sxCovPush">' + I.phone.replace('<svg', '<svg style="width:11px;height:11px;vertical-align:-1px"') + ' Aviso enviado a su móvil · esperando confirmación…</small></div>' +
      '<button type="button" class="sx-btn" id="sxCovUndo">' + I.undo + ' Deshacer</button>';
    st.innerHTML = 'Asignación registrada en el historial · <b>1 corrección aprendida</b> para futuras sugerencias.';
    q('#sxCovUndo').addEventListener('click', renderCov);
    wait(1600).then(function () { var el = q('#sxCovPush'); if (el) el.innerHTML = '<span style="color:var(--ok);font-weight:600">✓ ' + esc(c.p.name) + ' ha aceptado el turno desde la app</span> · cuadrante actualizado para todo el equipo.'; });
  }

  /* ====================================================================
     Vista 1 · Auto-generar el mes (vista Mes)
     ==================================================================== */
  var gen = { busy: false, cons: {}, done: false };
  var DAY0 = 7; // lunes 7 de septiembre de 2026 → 14 días
  function renderGen() {
    var s = S(), ppl = team(), n = ppl.length, v = q('[data-view="1"]');
    gen.done = false; gen.busy = false;
    var days = 14, cells = n * days;
    v.innerHTML =
      '<div class="sx-h">' +
        '<div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">' +
          '<div class="sx-daynav" aria-hidden="true"><button type="button" tabindex="-1">‹</button><span style="border-left:0;color:var(--ink);font-size:14px">Septiembre 2026</span><button type="button" tabindex="-1">›</button></div>' +
          '<div class="sx-actions"><button type="button" class="sx-btn" tabindex="-1" aria-hidden="true">Revisar mes</button><button type="button" class="sx-btn" tabindex="-1" aria-hidden="true">Completar huecos</button><button type="button" class="sx-btn" tabindex="-1" aria-hidden="true">Imprimir</button></div>' +
        '</div>' +
      '</div>' +
      '<div class="sx-card sx-prompt">' +
        '<span class="sx-prompt-ico">' + I.spark + '</span>' +
        '<div class="sx-prompt-in"><span class="sx-eyebrow">Instrucción en lenguaje natural</span>' +
          '<div class="sx-prompt-text" id="sxGenPrompt">Cuadrante de septiembre equilibrado, respetando el convenio<span class="caret"></span></div>' +
          '<div class="sx-cons" id="sxGenCons">' + s.cons.map(function (c) { return '<button type="button" class="sx-con' + (gen.cons[c.id] ? ' is-on' : '') + '" data-con="' + c.id + '">' + esc(c.label) + '</button>'; }).join('') + '</div>' +
        '</div>' +
        '<button type="button" class="sx-btn grad" id="sxGenGo">' + I.spark + ' Generar con IA</button>' +
      '</div>' +
      '<div class="sx-kpis">' +
        '<div class="sx-card sx-kpi"><span class="sx-kpi-l">Turnos por asignar</span><div class="sx-kpi-v warn" id="sxGenLeft">' + cells + '</div><span class="sx-kpi-s">' + n + ' personas · 14 días</span></div>' +
        '<div class="sx-card sx-kpi"><span class="sx-kpi-l">Huecos de cobertura</span><div class="sx-kpi-v bad" id="sxGenHoles">' + (days * 3) + '</div><span class="sx-kpi-s" id="sxGenHolesS">mínimos sin cubrir</span></div>' +
        '<div class="sx-card sx-kpi"><span class="sx-kpi-l">Conflictos de convenio</span><div class="sx-kpi-v" id="sxGenConf">—</div><span class="sx-kpi-s" id="sxGenConfS">pendiente de generar</span></div>' +
        '<div class="sx-card sx-kpi"><span class="sx-kpi-l">Confianza</span><div class="sx-kpi-v acc" id="sxGenTrust">—</div><span class="sx-kpi-s" id="sxGenTrustS">del cuadrante propuesto</span></div>' +
      '</div>' +
      '<div class="sx-legend" style="margin-bottom:10px">' + legend() + '</div>' +
      '<div class="sx-card sx-month"><div class="sx-mg" id="sxGenGrid" role="table" aria-label="Cuadrante de septiembre">' + gridHead(days) +
        '<div class="grp">' + esc(s.group) + ' · ' + n + '</div>' +
        ppl.map(function (p) {
          return '<div class="c0" role="rowheader">' + who(p) + '</div>' +
            Array.apply(null, Array(days)).map(function (_, d) { return '<div class="' + (d % 7 >= 5 ? 'we' : '') + '" data-c="' + p.i + '-' + d + '"><span class="sx-pill vac"></span></div>'; }).join('') +
            '<div class="tot" data-t="' + p.i + '"><span>—</span></div>';
        }).join('') +
        '<div class="cov c0">Cobertura ' + esc(s.shifts.M.code) + '·' + esc(s.shifts.T.code) + '·' + esc(s.shifts.N.code) + '</div>' + Array.apply(null, Array(days)).map(function (_, d) { return '<div class="cov' + (d % 7 >= 5 ? ' we' : '') + '" data-cov="' + d + '">·</div>'; }).join('') + '<div class="cov"></div>' +
      '</div></div>' +
      '<div class="sx-monthfoot"><div class="sx-checks" id="sxGenChecks"></div><div id="sxGenAfter"></div></div>';
    q('#sxGenGo').addEventListener('click', genRun);
    qa('[data-con]', v).forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-con'); gen.cons[id] = !gen.cons[id]; b.classList.toggle('is-on', !!gen.cons[id]);
        var txt = 'Cuadrante de septiembre equilibrado, respetando el convenio';
        var extra = s.cons.filter(function (c) { return gen.cons[c.id]; }).map(function (c) { return c.label.charAt(0).toLowerCase() + c.label.slice(1); });
        q('#sxGenPrompt').innerHTML = esc(txt + (extra.length ? '. ' + extra.join('; ') : '')) + '<span class="caret"></span>';
        if (gen.done && !gen.busy) genRun();
      });
    });
  }
  function gridHead(days) {
    return '<div class="hd c0">Septiembre 2026</div>' + Array.apply(null, Array(days)).map(function (_, d) { return '<div class="hd' + (d % 7 >= 5 ? ' we' : '') + '"><small>' + DAYS[d % 7] + '</small><b>' + (DAY0 + d) + '</b></div>'; }).join('') + '<div class="hd">Total</div>';
  }
  function genRun() {
    if (gen.busy) return;
    gen.busy = true;
    var s = S(), ppl = team(), n = ppl.length, days = 14, btn = q('#sxGenGo');
    var opts = { weT: !!gen.cons.weT, maxDays: gen.cons.max5 ? 5 : s.rules.maxDays, noNight: gen.cons.noN2 ? 2 : -1 };
    var res = solve(s, n, days, opts), issues = check(s, res.grid, opts);
    btn.classList.add('busy'); btn.disabled = true;
    qa('[data-c]').forEach(function (c) { c.innerHTML = '<span class="sx-pill vac"></span>'; });
    qa('[data-t]').forEach(function (c) { c.innerHTML = '<span>—</span>'; });
    qa('[data-cov]').forEach(function (c) { c.textContent = '·'; });
    q('#sxGenChecks').innerHTML = ''; q('#sxGenAfter').innerHTML = '';
    var left = q('#sxGenLeft'), holes = q('#sxGenHoles'), total = n * days, placed = 0;
    left.className = 'sx-kpi-v warn'; left.textContent = total;
    holes.className = 'sx-kpi-v bad'; holes.textContent = days * 3;
    q('#sxGenConf').textContent = '…'; q('#sxGenConfS').textContent = 'validando';
    q('#sxGenTrust').textContent = '…';
    var step = MOTION ? 16 : 0, chain = wait(350);
    var covCount = [];
    for (var d = 0; d < days; d++) covCount.push({ M: 0, T: 0, N: 0 });
    var order = [];
    for (var dd = 0; dd < days; dd++) for (var i = 0; i < n; i++) order.push([i, dd]);
    order.forEach(function (o, k) {
      chain = chain.then(function () {
        var i = o[0], d = o[1], sh = res.grid[i][d], cell = q('[data-c="' + i + '-' + d + '"]');
        if (cell) cell.innerHTML = pill(sh, 'new');
        placed++; left.textContent = total - placed;
        if (sh !== 'L') covCount[d][sh]++;
        if (i === n - 1) {
          var c = covCount[d], ok = c.M >= s.rules.cover.M && c.T >= s.rules.cover.T && c.N >= s.rules.cover.N;
          var cv = q('[data-cov="' + d + '"]'); if (cv) cv.innerHTML = '<b class="' + (ok ? '' : 'bad') + '">' + c.M + '·' + c.T + '·' + c.N + '</b>';
          holes.textContent = String((days - d - 1) * 3 + (ok ? 0 : 1));
        }
        return wait(step);
      });
    });
    chain.then(function () {
      left.textContent = '0'; left.className = 'sx-kpi-v ok';
      holes.textContent = String(res.holes); holes.className = 'sx-kpi-v ' + (res.holes ? 'bad' : 'ok');
      q('#sxGenHolesS').textContent = res.holes ? 'revisar cobertura' : 'todos los mínimos cubiertos';
      ppl.forEach(function (p) {
        var c = res.counts[p.i], t = q('[data-t="' + p.i + '"]');
        if (t) t.innerHTML = '<b>' + (c.M + c.T + c.N) + ' turnos</b><span>' + s.shifts.M.code.charAt(0) + c.M + ' · ' + s.shifts.T.code.charAt(0) + c.T + ' · ' + s.shifts.N.code.charAt(0) + c.N + '</span>';
      });
      var bad = issues.filter(function (x) { return x.sev === 'bad'; }).length;
      q('#sxGenConf').textContent = String(issues.length); q('#sxGenConf').className = 'sx-kpi-v ' + (issues.length ? 'bad' : 'ok');
      q('#sxGenConfS').textContent = issues.length ? bad + ' graves · ' + (issues.length - bad) + ' avisos' : 'convenio validado';
      var nights = res.counts.map(function (c) { return c.N; }).filter(function (_, i) { return opts.noNight !== i; });
      var st = stats(nights);
      var trust = Math.max(60, Math.min(99, 99 - res.holes * 6 - issues.length * 8 - Math.round(st.range * 2)));
      q('#sxGenTrust').textContent = trust + ' %';
      q('#sxGenTrustS').textContent = trust >= 90 ? 'lista para publicar' : 'revisar antes de publicar';
      var checks = [
        { ok: !issues.some(function (x) { return /Descanso/.test(x.rule); }), t: 'Descanso mínimo de 12 h entre turnos' },
        { ok: !issues.some(function (x) { return x.rule === 'Días consecutivos'; }), t: 'Máximo ' + opts.maxDays + ' días seguidos' },
        { ok: !res.holes, t: 'Cobertura mínima cada día (' + s.shifts.M.code + '·' + s.shifts.T.code + '·' + s.shifts.N.code + ')' },
        { ok: st.range <= 1, t: s.eq.many.charAt(0).toUpperCase() + s.eq.many.slice(1) + ' equilibradas (diferencia máx–mín: ' + st.range + ')' }
      ];
      if (opts.weT) checks.push({ ok: true, t: s.cons[0].label + ' aplicado: +1 ' + s.shifts.T.name.toLowerCase() + ' sáb y dom' });
      if (opts.noNight >= 0) checks.push({ ok: !issues.some(function (x) { return x.rule === 'Exención'; }), t: 'Exención respetada: ' + NAMES[2] + ' sin ' + s.eq.many });
      q('#sxGenChecks').innerHTML = checks.map(function (c, k) { return '<div class="sx-check' + (c.ok ? '' : ' bad') + '" style="animation-delay:' + (k * 70) + 'ms">' + (c.ok ? I.check : I.warn) + esc(c.t) + '</div>'; }).join('');
      q('#sxGenAfter').innerHTML = '<div class="sx-note ok in">' + I.check + '<span><b>Cuadrante generado en 1,8 s.</b> Se publica en la app del equipo con un clic; cada cambio posterior avisa solo a quien le afecta.</span></div>';
      btn.classList.remove('busy'); btn.disabled = false; btn.innerHTML = I.spark + ' Generar otra variante';
      gen.busy = false; gen.done = true;
    });
  }

  /* ====================================================================
     Vista 2 · Equidad (Equipo → Cargas del equipo)
     ==================================================================== */
  var eq = { busy: false };
  var EQ_BASE = [7, 6, 5, 2, 1, 0, 4, 3];
  var EQ_DATES = ['vie 14 ago', 'sáb 22 ago', 'mié 26 ago', 'dom 30 ago', 'jue 3 sep', 'sáb 5 sep', 'mar 8 sep', 'vie 11 sep'];
  function renderEq() {
    var s = S(), ppl = team(), n = ppl.length, v = q('[data-view="2"]');
    var vals = EQ_BASE.slice(0, n), exempt = n >= 6 ? [5] : [];
    var active = vals.filter(function (_, i) { return exempt.indexOf(i) < 0; }), st = stats(active), max = Math.max(8, Math.max.apply(null, vals) + 1);
    eq.vals = vals; eq.exempt = exempt; eq.max = max; eq.busy = false;
    var Many = s.eq.many.charAt(0).toUpperCase() + s.eq.many.slice(1);
    v.innerHTML =
      '<div class="sx-h"><div><span class="sx-eyebrow">Equipo · ' + esc(s.group) + '</span><h3>Cargas del equipo</h3><p>' + Many + ' de los últimos 30 días por persona. La IA reparte lo que toca a cada cual sin romper descansos ni exenciones.</p></div>' +
        '<div class="sx-actions"><div class="sx-seg" aria-hidden="true"><span class="is-on">' + Many + '</span><span>Fines de semana</span><span>Festivos</span></div></div></div>' +
      '<div class="sx-cols">' +
        '<div class="sx-card sx-loads" id="sxEqLoads">' + ppl.map(function (p, i) {
          var ex = exempt.indexOf(i) >= 0;
          return '<div class="sx-load' + (ex ? ' ex' : '') + '" data-row="' + i + '">' + who(p, ex ? s.eq.exempt : p.role) +
            '<div class="sx-bar" style="--max:' + max + '"><i style="--v:' + vals[i] + '" class="' + (vals[i] >= st.mean + 1.5 ? 'hi' : vals[i] <= st.mean - 1.5 ? 'lo' : '') + '"></i>' + (ex ? '' : '<span class="tgt" style="--t:' + st.mean + '"></span>') + '</div>' +
            '<div class="sx-load-n"><span data-n="' + i + '">' + vals[i] + '</span><span class="d" data-d="' + i + '"></span></div></div>';
        }).join('') + '</div>' +
        '<div class="sx-side">' +
          '<div class="sx-metrics">' +
            '<div class="sx-card sx-metric"><span class="sx-kpi-l">Desviación</span><div class="sx-kpi-v" id="sxEqSd">' + fmt1(st.sd) + '</div><span class="sx-kpi-s">' + s.eq.many + ' · típica</span></div>' +
            '<div class="sx-card sx-metric"><span class="sx-kpi-l">Máx – mín</span><div class="sx-kpi-v bad" id="sxEqRange">' + st.range + '</div><span class="sx-kpi-s">' + s.eq.many + ' de diferencia</span></div>' +
            '<div class="sx-card sx-metric"><span class="sx-kpi-l">Índice de equidad</span><div class="sx-kpi-v warn" id="sxEqJain">' + Math.round(st.jain * 100) + ' %</div><span class="sx-kpi-s">Jain · 100 % = reparto igual</span></div>' +
          '</div>' +
          '<button type="button" class="sx-btn grad" id="sxEqGo" style="justify-content:center">' + I.spark + ' Redistribuir ' + esc(s.eq.many) + ' con IA</button>' +
          '<div class="sx-status" id="sxEqStatus" aria-live="polite">Objetivo: que nadie tenga más de 1 ' + esc(s.eq.one) + ' de diferencia con el resto' + (exempt.length ? ', respetando la exención de ' + esc(ppl[5].name) : '') + '.</div>' +
          '<div class="sx-moves" id="sxEqMoves"></div>' +
        '</div>' +
      '</div>';
    q('#sxEqGo').addEventListener('click', eqRun);
  }
  function eqRun() {
    if (eq.busy) return;
    eq.busy = true;
    var s = S(), ppl = team(), btn = q('#sxEqGo'), st = q('#sxEqStatus'), movesEl = q('#sxEqMoves');
    var before = eq.vals, res = redistribute(before, eq.exempt), after = res.vals;
    var actB = before.filter(function (_, i) { return eq.exempt.indexOf(i) < 0; }), actA = after.filter(function (_, i) { return eq.exempt.indexOf(i) < 0; });
    var sB = stats(actB), sA = stats(actA);
    btn.classList.add('busy'); btn.disabled = true;
    st.textContent = 'Buscando ' + s.eq.many + ' intercambiables sin romper descansos ni cobertura…';
    qa('.tgt').forEach(function (t) { t.classList.add('show'); });
    wait(700).then(function () {
      ppl.forEach(function (p, i) {
        var bar = q('[data-row="' + i + '"] .sx-bar i'), num = q('[data-n="' + i + '"]'), dlt = q('[data-d="' + i + '"]');
        if (!bar) return;
        bar.style.setProperty('--v', after[i]); bar.className = '';
        num.textContent = after[i];
        var d = after[i] - before[i];
        dlt.textContent = d ? (d > 0 ? '+' + d : String(d)) : ''; dlt.className = 'd' + (d > 0 ? ' up' : '');
      });
      function metric(id, from, to, fmt) { var el = q(id); el.innerHTML = esc(fmt(from)) + '<span class="to">→<b>' + esc(fmt(to)) + '</b></span>'; el.className = 'sx-kpi-v'; }
      metric('#sxEqSd', sB.sd, sA.sd, fmt1);
      metric('#sxEqRange', sB.range, sA.range, String);
      metric('#sxEqJain', sB.jain, sA.jain, function (x) { return Math.round(x * 100) + ' %'; });
      st.innerHTML = '<b>' + res.moves.length + ' cambios</b> propuestos · descansos de 12 h y cobertura intactos · ' + (eq.exempt.length ? 'exención respetada · ' : '') + 'pendientes de tu aprobación.';
      movesEl.innerHTML = res.moves.map(function (m, k) {
        return '<div class="sx-card sx-move" style="animation-delay:' + (k * 70) + 'ms">' + who(ppl[m.from], '−1 ' + s.eq.one) + '<span class="arr">→</span>' + who(ppl[m.to], '+1 ' + s.eq.one) + '<span class="dt">' + esc(EQ_DATES[k % EQ_DATES.length]) + '</span></div>';
      }).join('') + '<button type="button" class="sx-btn dark" id="sxEqApply" style="justify-content:center">Aprobar y avisar a ' + (res.moves.length * 2 > ppl.length ? 'los afectados' : (res.moves.length * 2) + ' personas') + '</button>';
      q('#sxEqApply').addEventListener('click', function () {
        this.disabled = true;
        movesEl.insertAdjacentHTML('beforeend', '<div class="sx-note ok in">' + I.check + '<span><b>Reparto publicado.</b> Solo reciben aviso las ' + (Math.min(res.moves.length * 2, ppl.length)) + ' personas afectadas; el resto no ve ningún cambio.</span></div>');
      });
      btn.classList.remove('busy'); btn.innerHTML = I.undo + ' Volver al reparto original'; btn.disabled = false; btn.classList.remove('grad');
      btn.removeEventListener('click', eqRun); btn.addEventListener('click', renderEq);
      eq.busy = false;
    });
  }

  /* ====================================================================
     Vista 3 · Lector PDF/Excel (Importar)
     ==================================================================== */
  var imp = { busy: false };
  function renderImp() {
    var s = S(), ppl = team(), n = ppl.length, v = q('[data-view="3"]');
    imp.busy = false;
    var isPdf = /\.pdf$/.test(s.file);
    v.innerHTML =
      '<div class="sx-h"><div><span class="sx-eyebrow">Importar</span><h3>Importar plantilla desde PDF o Excel</h3><p>Sube el documento que ya tienes. La IA detecta columnas, valida DNIs y crea las fichas: sin teclear.</p></div></div>' +
      '<div class="sx-cols">' +
        '<div class="sx-side">' +
          '<button type="button" class="sx-drop" id="sxImpDrop"><span class="sx-drop-ico">' + I.up + '</span><b>Arrastra tu PDF o Excel aquí</b><small>o haz clic para elegir · planillas, cuadrantes, listados de personal</small><span class="sx-btn sm dark" style="margin-top:14px">Usar un ejemplo · ' + esc(s.file) + '</span></button>' +
          '<div class="sx-card sx-steps" id="sxImpSteps" hidden>' + ['Leyendo ' + (isPdf ? 'el PDF (2 páginas)' : 'la hoja "Plantilla"') + ' y detectando la tabla', 'Identificando columnas: Nombre · DNI · ' + s.catCol + ' · Rol', 'Validando DNIs (letra de control) y duplicados', 'Infiriendo roles y reglas de convenio por ' + s.catCol.toLowerCase()].map(function (t) { return '<div class="sx-stp"><i>' + I.check + '</i>' + esc(t) + '</div>'; }).join('') + '</div>' +
          '<div id="sxImpCols" hidden><span class="sx-eyebrow" style="display:block;margin-bottom:6px">Columnas detectadas</span><div class="sx-cols-det" id="sxImpColTags"></div></div>' +
          '<div id="sxImpSum"></div>' +
        '</div>' +
        '<div>' +
          '<div class="sx-card sx-what" id="sxImpWhat"><span>Nombre y ' + esc(s.catCol.toLowerCase()) + '</span><span>DNI/NIE validado</span><span>Turnos del calendario</span><span>' + esc(s.eq.many.charAt(0).toUpperCase() + s.eq.many.slice(1)) + ' y cómputo</span><span>Vacaciones y libres</span><span>Antigüedad</span><span>Reducciones de jornada</span><span>Horas por tipo de turno</span></div>' +
          '<div class="sx-card sx-tablewrap" id="sxImpTable" hidden><table class="sx-table"><thead><tr><th>Nombre</th><th>DNI</th><th>' + esc(s.catCol) + '</th><th>Rol / reglas</th></tr></thead><tbody id="sxImpRows"></tbody></table></div>' +
        '</div>' +
      '</div>';
    q('#sxImpDrop').addEventListener('click', impRun);
    void n; void ppl;
  }
  function impRun() {
    if (imp.busy) return;
    imp.busy = true;
    var s = S(), ppl = team(), n = ppl.length, drop = q('#sxImpDrop'), steps = q('#sxImpSteps'), stps = qa('.sx-stp', steps);
    drop.classList.add('done'); drop.innerHTML = '<span class="sx-drop-ico">' + I.doc + '</span><b>' + esc(s.file) + '</b><small>' + (/\.pdf$/.test(s.file) ? '2 páginas · 184 KB' : '1 hoja · ' + (n + 1) + ' filas · 38 KB') + '</small><span class="sx-file">' + I.check + ' subido · procesando en tu cuenta</span>';
    steps.hidden = false;
    var chain = Promise.resolve();
    stps.forEach(function (el, k) {
      chain = chain.then(function () { el.classList.add('run'); return wait(k === 2 ? 700 : 520); }).then(function () { el.classList.remove('run'); el.classList.add('done'); if (k === 1) impCols(); });
    });
    chain.then(function () {
      q('#sxImpWhat').hidden = true; var tbl = q('#sxImpTable'); tbl.hidden = false;
      var rows = q('#sxImpRows'), html = '', dupIdx = n >= 6 ? n - 1 : -1, noDni = 3, red = 2;
      ppl.forEach(function (p, i) {
        var dup = i === dupIdx;
        var dni = dup ? '····000' + (1) + 'A' : '····000' + (i + 1) + String.fromCharCode(65 + i);
        html += '<tr class="' + (dup ? 'dup' : '') + '" style="animation-delay:' + (i * 60) + 'ms"><td>' + who(dup ? p : p, dup ? 'duplicado de ' + ppl[0].name : p.role) + '</td>' +
          '<td class="dni">' + (i === noDni ? '<span class="sx-tag warn">sin DNI</span>' : esc(dni) + I.check) + '</td>' +
          '<td>' + esc(p.role) + '</td>' +
          '<td><span class="sx-tag acc">' + esc(i === 0 ? 'coordina' : 'turnos') + '</span> ' + (i === red ? '<span class="sx-tag blue">reducción 80 %</span> ' : '') + (i === 4 ? '<span class="sx-tag">inferido</span>' : '') + '</td></tr>';
      });
      rows.innerHTML = html;
      var ready = n - (dupIdx >= 0 ? 1 : 0);
      q('#sxImpSum').innerHTML = '<div class="sx-note ok in">' + I.check + '<span><b>' + ready + ' fichas listas</b> · ' + (dupIdx >= 0 ? '1 duplicado descartado · ' : '') + '1 sin DNI (aviso, se importa igual) · 1 reducción de jornada detectada.</span></div>' +
        '<button type="button" class="sx-btn dark" id="sxImpApply" style="margin-top:10px;justify-content:center;width:100%">Crear ' + ready + ' fichas en Equipo</button>';
      q('#sxImpApply').addEventListener('click', function () {
        this.disabled = true; this.textContent = '✓ ' + ready + ' fichas creadas';
        q('#sxImpSum').insertAdjacentHTML('beforeend', '<div class="sx-note in" style="margin-top:8px">' + I.doc + '<span>Reglas aplicadas: descanso de 12 h, ' + esc(s.eq.many) + ' y días seguidos según convenio · reducción de jornada de ' + esc(ppl[red].name) + ' registrada.</span></div>');
      });
      imp.busy = false;
    });
    function impCols() {
      var c = q('#sxImpCols'); c.hidden = false;
      q('#sxImpColTags').innerHTML = [['Nombre', '99 %'], ['DNI', '96 %'], [s.catCol, '93 %'], ['Rol', '87 % · inferido', true]].map(function (t, k) { return '<span style="animation-delay:' + (k * 80) + 'ms">' + esc(t[0]) + '<em class="' + (t[2] ? 'inf' : '') + '">' + esc(t[1]) + '</em></span>'; }).join('');
    }
  }

  /* ====================================================================
     Vista 4 · Conflictos (semana)
     ==================================================================== */
  var cf = { busy: false };
  function renderCf() {
    var s = S(), ppl = team(), n = ppl.length, v = q('[data-view="4"]');
    cf.busy = false;
    var grid = CONF_WEEK.slice(0, n).map(function (r) { return r.slice(); });
    var issues = check(s, grid, {});
    cf.grid = grid; cf.issues = issues;
    v.innerHTML =
      '<div class="sx-h"><div><span class="sx-eyebrow">Conflictos · semana del 14 al 20 de septiembre</span><h3>' + issues.length + ' conflictos detectados</h3><p>Shiftia vigila el cuadrante en tiempo real: cada cambio se contrasta con el convenio y los mínimos del servicio.</p></div>' +
        '<div class="sx-actions"><button type="button" class="sx-btn grad" id="sxCfGo">' + I.spark + ' Resolver con IA</button></div></div>' +
      '<div class="sx-cols cf">' +
        '<div class="sx-issues" id="sxCfIssues">' + issues.map(function (x, k) {
          return '<div class="sx-card sx-issue ' + x.sev + '" data-i="' + k + '" style="animation-delay:' + (k * 70) + 'ms"><span class="sx-tag ' + x.sev + '">' + (x.sev === 'bad' ? 'crítico' : 'aviso') + '</span>' +
            '<div class="sx-issue-t">' + (x.p >= 0 ? '<b>' + esc(ppl[x.p].name) + '</b> · ' : '') + '<b>' + esc(x.rule) + '</b>: ' + esc(x.text) + '<small>' + esc(x.ref) + '</small></div></div>';
        }).join('') + '</div>' +
        '<div class="sx-side">' +
          '<div class="sx-card sx-week"><div class="sx-wg" id="sxCfGrid" role="table" aria-label="Cuadrante semanal">' +
            '<div class="hd c0">14–20 sep</div>' + DAYS.map(function (d, k) { return '<div class="hd' + (k >= 5 ? ' we' : '') + '"><small>' + d + '</small><b>' + (14 + k) + '</b></div>'; }).join('') +
            ppl.map(function (p, i) {
              return '<div class="c0">' + who(p) + '</div>' + grid[i].map(function (sh, d) {
                var conf = issues.some(function (x) { return x.p === i && (x.d === d || (x.rule === 'Días consecutivos' && d <= x.d && d > x.d - 7) || (/consecutivas/.test(x.rule) && d <= x.d && d > x.d - 4)); });
                var hole = issues.some(function (x) { return x.p === -1 && x.d === d; }) && sh === 'L' && i === 3;
                return '<div class="' + (d >= 5 ? 'we' : '') + '" data-w="' + i + '-' + d + '">' + (hole ? '<span class="sx-pill hole" title="Hueco de cobertura">' + esc(s.shifts.N.code) + '?</span>' : pill(sh, conf ? 'conf' : '')) + '</div>';
              }).join('');
            }).join('') +
          '</div></div>' +
          '<div class="sx-legend">' + legend() + '<span><i style="box-shadow:0 0 0 1.5px var(--bad);background:#fff"></i>en conflicto</span></div>' +
          '<div id="sxCfProp"></div>' +
        '</div>' +
      '</div>';
    q('#sxCfGo').addEventListener('click', cfRun);
  }
  function cfRun() {
    if (cf.busy) return;
    cf.busy = true;
    var s = S(), ppl = team(), n = ppl.length, btn = q('#sxCfGo'), prop = q('#sxCfProp');
    btn.classList.add('busy'); btn.disabled = true;
    var fixes = CONF_FIXES.filter(function (f) { return f.p < n; });
    wait(900).then(function () {
      var after = cf.grid.map(function (r) { return r.slice(); });
      fixes.forEach(function (f) { after[f.p][f.d] = f.to; });
      var left = check(s, after, {});
      prop.innerHTML = '<div class="sx-card" style="padding:12px 14px"><div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px"><span class="sx-eyebrow" style="color:var(--ink)">' + I.spark.replace('<svg', '<svg style="width:12px;height:12px;vertical-align:-2px;margin-right:4px"') + 'Propuesta de resolución</span><span class="sx-tag ' + (left.length ? 'warn' : 'ok') + '">' + left.length + ' conflictos tras aplicar</span></div>' +
        '<div class="sx-fixes">' + fixes.map(function (f, k) {
          return '<div class="sx-card sx-fix" style="animation-delay:' + (k * 70) + 'ms"><span><b>' + esc(ppl[f.p].name) + '</b> <span class="dy">' + DAYL[f.d] + ' ' + (14 + f.d) + '</span></span>' + pill(f.from) + '<span class="arr">→</span>' + pill(f.to) + '<span class="why">' + esc(f.why) + '</span></div>';
        }).join('') + '</div>' +
        '<button type="button" class="sx-btn dark" id="sxCfApply" style="margin-top:10px;width:100%;justify-content:center">Aplicar ' + fixes.length + ' cambios</button></div>';
      btn.classList.remove('busy'); btn.disabled = true;
      q('#sxCfApply').addEventListener('click', function () {
        this.disabled = true;
        var chain = Promise.resolve();
        fixes.forEach(function (f, k) {
          chain = chain.then(function () {
            var cell = q('[data-w="' + f.p + '-' + f.d + '"]'); if (cell) cell.innerHTML = pill(f.to, 'new fix');
            return wait(160);
          });
        });
        chain.then(function () {
          qa('.sx-pill.conf').forEach(function (p) { p.classList.remove('conf'); });
          qa('.sx-issue').forEach(function (el, k) { setTimeout(function () { el.classList.add('solved'); }, MOTION ? k * 90 : 0); });
          return wait(700);
        }).then(function () {
          q('#sxCfIssues').innerHTML = '<div class="sx-card sx-empty"><span class="ico">' + I.check + '</span><b>Sin conflictos en los próximos 3 meses</b><small>Todo bien. Cuando se detecten problemas de cobertura o descanso, aparecerán aquí.</small></div>';
          q('[data-view="4"] h3').textContent = '0 conflictos detectados';
          prop.innerHTML = '<div class="sx-note ok in">' + I.check + '<span><b>' + fixes.length + ' cambios aplicados.</b> Avisados ' + Math.min(4, n) + ' trabajadores por push · historial de cambios actualizado.</span></div>' +
            '<button type="button" class="sx-btn" id="sxCfReset" style="margin-top:8px">' + I.undo + ' Volver a la semana original</button>';
          q('#sxCfReset').addEventListener('click', renderCf);
          cf.busy = false;
        });
      });
    });
  }

  /* ====================================================================
     Cableado: pestañas, personalización, barra de la app, autoplay
     ==================================================================== */
  var NAV_MAP = { dia: 0, semana: 4, mes: 1, cobertura: 0, equipo: 2, conflictos: 4, importar: 3 };
  var FEATURE_NAV = ['cobertura', 'mes', 'equipo', 'importar', 'conflictos'];
  function renderAll() {
    var s = S();
    var org = q('#sxOrg'); if (org) org.textContent = s.org;
    renderCov(); renderGen(); renderEq(); renderImp(); renderCf();
    setFeature(state.feature, true);
  }
  function setFeature(i, silent) {
    state.feature = i;
    qa('.sx-tab').forEach(function (t, k) { t.setAttribute('aria-selected', k === i ? 'true' : 'false'); t.tabIndex = k === i ? 0 : -1; });
    qa('.sx-view').forEach(function (v, k) { v.classList.toggle('is-on', k === i); });
    qa('.sx-nav button').forEach(function (b) { b.classList.toggle('is-on', b.getAttribute('data-nav') === FEATURE_NAV[i]); });
    var url = q('#sxUrl'); if (url) url.textContent = 'app.shiftia.es/' + S().url + '/' + FEATURE_NAV[i];
    void silent;
  }
  qa('.sx-tab').forEach(function (t, k) {
    t.addEventListener('click', function () { setFeature(k); });
    t.addEventListener('keydown', function (e) {
      var tabs = qa('.sx-tab'), j = k;
      if (e.key === 'ArrowRight') j = (k + 1) % tabs.length; else if (e.key === 'ArrowLeft') j = (k - 1 + tabs.length) % tabs.length; else return;
      e.preventDefault(); setFeature(j); tabs[j].focus();
    });
  });
  qa('.sx-nav button').forEach(function (b) { b.addEventListener('click', function () { var f = NAV_MAP[b.getAttribute('data-nav')]; if (f !== undefined) setFeature(f); }); });
  qa('#sxSector .sx-chip').forEach(function (b) {
    b.addEventListener('click', function () {
      state.sector = b.getAttribute('data-s');
      qa('#sxSector .sx-chip').forEach(function (x) { x.classList.toggle('is-on', x === b); x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      renderAll();
    });
  });
  var minus = q('#sxTeamMinus'), plus = q('#sxTeamPlus'), val = q('#sxTeamVal');
  function clampTeam() { state.team = Math.max(5, Math.min(8, state.team)); if (val) val.textContent = state.team; if (minus) minus.disabled = state.team <= 5; if (plus) plus.disabled = state.team >= 8; }
  if (minus) minus.addEventListener('click', function () { state.team--; clampTeam(); renderAll(); });
  if (plus) plus.addEventListener('click', function () { state.team++; clampTeam(); renderAll(); });
  clampTeam();
  renderAll();

  // Autoplay: al entrar la ventana en pantalla, lanza la primera demo
  if (MOTION && 'IntersectionObserver' in window) {
    var fired = false;
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting && !fired) {
          fired = true; io.disconnect();
          setTimeout(function () { if (state.feature === 0 && !cov.busy) { var b = q('#sxCovGo'); if (b && !b.disabled && !q('.sx-cand')) b.click(); } }, 700);
        }
      });
    }, { threshold: 0.35 });
    io.observe(q('.sx-win'));
  }
})();
