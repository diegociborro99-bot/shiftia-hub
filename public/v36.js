/* ============================================================================
   v3.6 — ANIMATIONS & INTERACTIVITY ENHANCEMENTS (runtime)
   - Hero "Demo viva" overlay (cursor + conflictos + Motor IA streaming + KPIs)
   - Counter-up de métricas con IntersectionObserver
   - Magnetic CTAs (botones que se inclinan al cursor)
   - Excel-vs-Shiftia animación destructiva al hacer scroll
   - Cursor "smart" que cambia según contexto
   ============================================================================ */
(function () {
  'use strict';
  if (window.__v36Init) return; // evita doble inicialización
  window.__v36Init = true;

  // Respeta usuarios con motion reducido
  var REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Cache fine-pointer check (hover + precise pointer = desktop with mouse)
  var HAS_FINE_POINTER = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  // ===========================================================================
  // 1. HERO "DEMO VIVA"
  // ===========================================================================
  function initHeroDemo() {
    var heroVisual = document.querySelector('.hero-visual');
    if (!heroVisual || heroVisual.querySelector('.hero-demo-overlay')) return;

    // Esperamos a que el SVG mockup esté inyectado (lo hace v3.4 hero-animator)
    function tryStart() {
      var mockup = heroVisual.querySelector('.hero-product-svg');
      if (!mockup) return setTimeout(tryStart, 200);

      // Construimos overlay
      var overlay = document.createElement('div');
      overlay.className = 'hero-demo-overlay';
      overlay.innerHTML = [
        // Cursor fantasma
        '<div class="hd-cursor" aria-hidden="true">',
        '  <svg viewBox="0 0 22 22" fill="none">',
        '    <path d="M3 3l16 8-7 1-2 7z" fill="#0f7a6d" stroke="white" stroke-width="1.4" stroke-linejoin="round"/>',
        '  </svg>',
        '</div>',
        // KPIs
        '<div class="hd-kpi-stack">',
        '  <div class="hd-kpi" data-kpi="cobertura"><span class="hd-kpi-dot is-bad"></span><span class="hd-kpi-label">Cobertura</span><span class="hd-kpi-value" data-from="62" data-to="100" data-suffix="%">62%</span></div>',
        '  <div class="hd-kpi" data-kpi="conflictos"><span class="hd-kpi-dot is-warm"></span><span class="hd-kpi-label">Conflictos</span><span class="hd-kpi-value" data-from="14" data-to="0" data-suffix="">14</span></div>',
        '  <div class="hd-kpi" data-kpi="equidad"><span class="hd-kpi-dot"></span><span class="hd-kpi-label">Equidad</span><span class="hd-kpi-value" data-from="71" data-to="98" data-suffix="%">71%</span></div>',
        '</div>',
        // Conflictos rojos (las posiciones son relativas al overlay)
        '<div class="hd-conflict" style="left: 22%; top: 35%;">Solapamiento turno noche</div>',
        '<div class="hd-conflict" style="left: 48%; top: 52%;">Sin cobertura sábado</div>',
        '<div class="hd-conflict" style="left: 30%; top: 70%;">Equidad por debajo del 75%</div>',
        // Streaming Motor IA
        '<div class="hd-ai-stream"><span class="hd-ai-text"></span><span class="hd-ai-cursor"></span></div>'
      ].join('');
      heroVisual.appendChild(overlay);

      if (REDUCED) {
        // En modo reducido, mostramos KPIs ya en estado final sin animación
        overlay.querySelectorAll('.hd-kpi').forEach(function (k) {
          k.classList.add('is-visible');
          var v = k.querySelector('.hd-kpi-value');
          if (v) v.textContent = (v.dataset.to || '') + (v.dataset.suffix || '');
        });
        return;
      }

      runHeroChoreography(overlay);
    }
    tryStart();
  }

  function runHeroChoreography(overlay) {
    var cursor = overlay.querySelector('.hd-cursor');
    var conflicts = Array.prototype.slice.call(overlay.querySelectorAll('.hd-conflict'));
    var kpis = Array.prototype.slice.call(overlay.querySelectorAll('.hd-kpi'));
    var aiStream = overlay.querySelector('.hd-ai-stream');
    var aiText = overlay.querySelector('.hd-ai-text');
    var aiCursor = overlay.querySelector('.hd-ai-cursor');

    var aiPhrases = [
      'Analizando 42 turnos en 7 días...',
      'Detectados 14 conflictos. Resolviendo...',
      'Reasignando turno noche \u2192 Pedro L.',
      'Cubriendo s\u00e1bado con María C.',
      'Equilibrando carga semanal...',
      'Optimización completa. 100% cobertura.'
    ];

    var moves = [
      { x: 18, y: 30 },   // empieza arriba izda
      { x: 22, y: 35 },   // sobre conflicto 1
      { x: 48, y: 52 },   // sobre conflicto 2
      { x: 30, y: 70 },   // sobre conflicto 3
      { x: 78, y: 18 }    // sale por arriba derecha
    ];

    var step = 0;
    function moveCursor(idx) {
      if (!cursor) return;
      var pos = moves[idx] || moves[0];
      cursor.style.left = pos.x + '%';
      cursor.style.top = pos.y + '%';
    }

    // Choreography
    function loop() {
      step = 0;
      // Reset KPIs y conflictos
      kpis.forEach(function (k) {
        k.classList.remove('is-visible');
        var v = k.querySelector('.hd-kpi-value');
        if (v) v.textContent = (v.dataset.from || '0') + (v.dataset.suffix || '');
      });
      conflicts.forEach(function (c) {
        c.classList.remove('is-visible', 'is-resolved', 'is-fading');
      });
      aiText.textContent = '';
      aiStream.classList.remove('is-visible');
      cursor.classList.remove('is-clicking');
      cursor.style.opacity = '0';

      // Fase 0: aparecen KPIs (estado malo)
      setTimeout(function () {
        kpis.forEach(function (k, i) {
          setTimeout(function () { k.classList.add('is-visible'); }, i * 150);
        });
      }, 400);

      // Fase 1: aparecen conflictos rojos
      setTimeout(function () {
        conflicts.forEach(function (c, i) {
          setTimeout(function () { c.classList.add('is-visible'); }, i * 250);
        });
      }, 1400);

      // Fase 2: aparece cursor + Motor IA empieza a "pensar"
      setTimeout(function () {
        cursor.style.opacity = '1';
        moveCursor(0);
        aiStream.classList.add('is-visible');
        typePhrase(aiPhrases[0], 0, function () {
          // sigue con la siguiente frase
          setTimeout(function () { typePhrase(aiPhrases[1], 0, function () {}); }, 600);
        });
      }, 2800);

      // Fase 3: cursor recorre y "click" sobre cada conflicto -> se resuelve
      [0, 1, 2].forEach(function (idx) {
        setTimeout(function () {
          moveCursor(idx + 1);
        }, 4400 + idx * 1300);
        setTimeout(function () {
          cursor.classList.add('is-clicking');
          setTimeout(function () { cursor.classList.remove('is-clicking'); }, 600);
          // Resolver conflicto
          if (conflicts[idx]) {
            conflicts[idx].classList.add('is-resolved');
            // Stream texto correspondiente
            typePhrase(aiPhrases[2 + idx], 0, function () {});
            // Fade out después de un momento
            setTimeout(function () {
              conflicts[idx].classList.add('is-fading');
            }, 900);
          }
          // Subir KPIs proporcionalmente
          tweenKpis(idx);
        }, 4900 + idx * 1300);
      });

      // Fase 4: cursor desaparece, mensaje final, KPIs full
      setTimeout(function () {
        moveCursor(4);
      }, 9000);
      setTimeout(function () {
        cursor.style.opacity = '0';
        typePhrase(aiPhrases[5], 0, function () {});
        kpis.forEach(function (k) {
          var v = k.querySelector('.hd-kpi-value');
          if (v) animateNumber(v, parseInt(v.dataset.from, 10), parseInt(v.dataset.to, 10), v.dataset.suffix || '', 800);
        });
        // Cambia los dots a "good"
        var dots = overlay.querySelectorAll('.hd-kpi-dot');
        dots.forEach(function (d) { d.className = 'hd-kpi-dot'; });
      }, 9800);

      // Loop después de descansar
      setTimeout(loop, 17000);
    }

    function tweenKpis(stepIdx) {
      // Avanza progresivamente: paso 0 -> 75%, paso 1 -> 88%, paso 2 -> casi
      var progressMap = [0.4, 0.7, 0.92];
      var p = progressMap[stepIdx] || 0;
      kpis.forEach(function (k) {
        var v = k.querySelector('.hd-kpi-value');
        if (!v) return;
        var from = parseInt(v.dataset.from, 10);
        var to = parseInt(v.dataset.to, 10);
        var current = parseInt(v.textContent, 10) || from;
        var target = Math.round(from + (to - from) * p);
        animateNumber(v, current, target, v.dataset.suffix || '', 700);
      });
    }

    function animateNumber(el, from, to, suffix, dur) {
      var start = performance.now();
      el.classList.add('is-counting');
      function tick(t) {
        var p = Math.min(1, (t - start) / dur);
        var eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
        var val = Math.round(from + (to - from) * eased);
        el.textContent = val + (suffix || '');
        if (p < 1) requestAnimationFrame(tick);
        else el.classList.remove('is-counting');
      }
      requestAnimationFrame(tick);
    }

    function typePhrase(phrase, idx, done) {
      if (!aiText || idx > phrase.length) return done && done();
      aiText.textContent = phrase.slice(0, idx);
      setTimeout(function () { typePhrase(phrase, idx + 1, done); }, 22);
    }

    loop();
  }

  // ===========================================================================
  // 2. COUNTER-UP de métricas
  // ===========================================================================
  function initCounters() {
    var nodes = document.querySelectorAll('[data-count]');
    if (!nodes.length || !('IntersectionObserver' in window)) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        if (el.__counted) return;
        el.__counted = true;
        var to = parseFloat(el.dataset.count);
        var dur = parseInt(el.dataset.countDuration || el.dataset.duration || '1600', 10);
        // Aceptamos data-suffix (ya existente) y data-count-suffix
        var suffix = el.dataset.countSuffix || el.dataset.suffix || '';
        var prefix = el.dataset.countPrefix || el.dataset.prefix || '';
        var decimals = parseInt(el.dataset.countDecimals || el.dataset.decimals || '0', 10);
        var from = parseFloat(el.dataset.countFrom || el.dataset.from || '0');
        var start = performance.now();
        el.classList.add('metric-count');
        if (REDUCED) {
          el.textContent = prefix + to.toFixed(decimals) + suffix;
          io.unobserve(el);
          return;
        }
        function tick(t) {
          var p = Math.min(1, (t - start) / dur);
          var eased = 1 - Math.pow(1 - p, 3);
          var val = from + (to - from) * eased;
          el.textContent = prefix + val.toFixed(decimals) + suffix;
          if (p < 1) requestAnimationFrame(tick);
          else io.unobserve(el);
        }
        requestAnimationFrame(tick);
      });
    }, { threshold: 0.4 });
    nodes.forEach(function (n) { io.observe(n); });
  }

  // ===========================================================================
  // 3. MAGNETIC CTAs
  // ===========================================================================
  function initMagnetic() {
    if (REDUCED) return;
    if (!HAS_FINE_POINTER) return;

    // Marcar automáticamente los CTAs principales
    var ctas = document.querySelectorAll('.btn-lg.primary, .nav-btn-primary, .hero-actions a.primary, .ds-btn-primary');
    ctas.forEach(function (el) {
      el.classList.add('magnetic');
    });

    document.querySelectorAll('.magnetic').forEach(function (el) {
      var strength = parseFloat(el.dataset.magneticStrength || '0.35');
      var radius = parseInt(el.dataset.magneticRadius || '120', 10);
      el.addEventListener('mousemove', function (e) {
        var rect = el.getBoundingClientRect();
        var cx = rect.left + rect.width / 2;
        var cy = rect.top + rect.height / 2;
        var dx = e.clientX - cx;
        var dy = e.clientY - cy;
        var dist = Math.hypot(dx, dy);
        if (dist > radius) {
          el.style.transform = '';
          return;
        }
        var fade = 1 - dist / radius;
        el.style.transform = 'translate(' + (dx * strength * fade) + 'px, ' + (dy * strength * fade) + 'px)';
      });
      el.addEventListener('mouseleave', function () { el.style.transform = ''; });
    });
  }

  // ===========================================================================
  // 4. EXCEL-VS-SHIFTIA destructiva al ver la sección
  // ===========================================================================
  function initVsAnimation() {
    var table = document.querySelector('.vs-table');
    if (!table || !('IntersectionObserver' in window)) return;

    // Auto-marcado de celdas según semantica existente (.vs-bad / .vs-good)
    var bads = table.querySelectorAll('.vs-bad');
    var goods = table.querySelectorAll('.vs-good');
    bads.forEach(function (el, i) {
      el.classList.add('vs-cell-x');
      el.style.setProperty('--cell-delay', (i * 80) + 'ms');
    });
    goods.forEach(function (el, i) {
      el.classList.add('vs-cell-s');
      el.style.setProperty('--cell-delay', (i * 100) + 'ms');
    });

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          table.classList.add('is-anim');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.3 });
    io.observe(table);
  }

  // ===========================================================================
  // 5. CURSOR SMART
  // ===========================================================================
  function initSmartCursor() {
    if (REDUCED) return;
    if (!HAS_FINE_POINTER || !window.matchMedia('(min-width: 901px)').matches) return;

    var cursor = document.createElement('div');
    cursor.className = 'smart-cursor';
    document.body.appendChild(cursor);

    var x = 0, y = 0, tx = 0, ty = 0;
    var visible = false;

    document.addEventListener('mousemove', function (e) {
      tx = e.clientX; ty = e.clientY;
      if (!visible) {
        cursor.classList.add('is-visible');
        x = tx; y = ty;
        visible = true;
      }
    });
    document.addEventListener('mouseleave', function () {
      cursor.classList.remove('is-visible'); visible = false;
    });

    function loop() {
      x += (tx - x) * 0.22;
      y += (ty - y) * 0.22;
      cursor.style.transform = 'translate(' + x + 'px, ' + y + 'px) translate(-50%, -50%)';
      requestAnimationFrame(loop);
    }
    loop();

    function classify(target) {
      cursor.classList.remove('on-link', 'on-cta', 'on-text');
      if (!target) return;
      // CTAs grandes
      if (target.closest('.btn-lg.primary, .nav-btn-primary')) {
        cursor.classList.add('on-cta');
        return;
      }
      // Links/botones
      if (target.closest('a, button, [role="button"], .magnetic, .clickable, .feat-card, .price-card')) {
        cursor.classList.add('on-link');
        return;
      }
      // Texto editable / inputs
      if (target.closest('input, textarea, [contenteditable="true"]')) {
        cursor.classList.add('on-text');
        return;
      }
    }
    document.addEventListener('mouseover', function (e) { classify(e.target); });
  }

  // ===========================================================================
  // BOOT
  // ===========================================================================
  function boot() {
    try { initHeroDemo(); } catch (e) { console.warn('[v3.6] hero demo failed:', e); }
    try { initCounters(); } catch (e) { console.warn('[v3.6] counters failed:', e); }
    try { initMagnetic(); } catch (e) { console.warn('[v3.6] magnetic failed:', e); }
    try { initVsAnimation(); } catch (e) { console.warn('[v3.6] vs anim failed:', e); }
    try { initSmartCursor(); } catch (e) { console.warn('[v3.6] cursor failed:', e); }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
