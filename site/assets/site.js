(function () {
  'use strict';
  var KEY = 'll-shortlist';
  function get() { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; } }
  function set(a) { try { localStorage.setItem(KEY, JSON.stringify(a)); } catch (e) {} }
  function sync() {
    var s = get();
    document.querySelectorAll('[data-save]').forEach(function (b) {
      var on = s.indexOf(b.getAttribute('data-save')) >= 0;
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      var t = b.querySelector('.save-label'); if (t) t.textContent = on ? 'Saved to shortlist' : 'Save to shortlist';
    });
    document.querySelectorAll('[data-count]').forEach(function (c) { c.textContent = s.length ? String(s.length) : ''; });
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-save]'); if (!b) return;
    e.preventDefault();
    var s = get(), id = b.getAttribute('data-save'), i = s.indexOf(id);
    if (i >= 0) s.splice(i, 1); else s.push(id);
    set(s); sync(); renderShortlist();
  });

  // filters on the venues page
  var form = document.getElementById('filters');
  if (form) {
    var cards = [].slice.call(document.querySelectorAll('#results .vcard'));
    var count = document.getElementById('count'), none = document.getElementById('none');
    try {
      var p = new URLSearchParams(location.search);
      ['area', 'style', 'guests'].forEach(function (k) { if (p.get(k) && form.elements[k]) form.elements[k].value = p.get(k); });
    } catch (e) {}
    var apply = function () {
      var a = form.elements.area.value, st = form.elements.style.value, g = parseInt(form.elements.guests.value, 10) || 0;
      var need = [].slice.call(form.querySelectorAll('input[type=checkbox]:checked')).map(function (c) { return c.name; });
      var n = 0;
      var match = function (d) { var cap = parseInt(d.cap, 10) || 0; return (!a || d.area === a) && (!st || d.type === st) && (!g || !cap || cap >= g) && need.every(function (k) { return d[k] === '1'; }); };
      cards.forEach(function (c) { var ok = match(c.dataset); c.hidden = !ok; if (ok) n++; });
      document.querySelectorAll('#map .pin').forEach(function (p) { p.classList.toggle('off', !match(p.dataset)); });
      count.textContent = n + (n === 1 ? ' venue' : ' venues');
      none.hidden = n > 0;
    };
    form.addEventListener('input', apply); form.addEventListener('change', apply);
    form.addEventListener('submit', function (e) { e.preventDefault(); });
    apply();
  }

  // shortlist page
  function renderShortlist() {
    var box = document.getElementById('shortlist'), data = window.LL_VENUES;
    if (!box || !data) return;
    var s = get().filter(function (id) { return data[id]; });
    if (!s.length) { box.innerHTML = '<p>Your shortlist is empty. <a href="venues.html">Browse the venues</a> and tap the heart on the ones you like.</p>'; return; }
    var esc = function (t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
    var rows = [['Style', 'type'], ['Where', 'town'], ['Guests', 'capacity'], ['Ceremony', 'licence'], ['Food and drink', 'catering'], ['Rooms', 'rooms'], ['Exclusive use', 'exclusive'], ['Finish time', 'finish']];
    var h = '<div class="tablewrap" tabindex="0" role="region" aria-label="Your shortlist compared"><table><thead><tr><th scope="col">Venue</th>' + s.map(function (id) {
      return '<th scope="col"><a href="venues/' + id + '.html">' + esc(data[id].name) + '</a><br><button class="btn" type="button" data-save="' + id + '" aria-pressed="true">Remove</button></th>';
    }).join('') + '</tr></thead><tbody>' + rows.map(function (r) {
      return '<tr><th scope="row">' + r[0] + '</th>' + s.map(function (id) { return '<td>' + esc(data[id][r[1]]) + '</td>'; }).join('') + '</tr>';
    }).join('') + '</tbody></table></div>';
    box.innerHTML = h;
  }

  // forms only submit on the live site
  var live = /(^|\.)aisleandacre\.co\.uk$|\.netlify\.app$/.test(location.hostname);
  document.querySelectorAll('form[data-netlify]').forEach(function (f) {
    f.addEventListener('submit', function (e) {
      if (live) return;
      e.preventDefault();
      var n = f.querySelector('.form-note'); if (n) n.hidden = false;
    });
  });

  // ---- maps: tooltips and style chips
  var esc = function (t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  document.querySelectorAll('[data-map]').forEach(function (m) {
    var tip = m.querySelector('.map-tip'); if (!tip) return;
    var show = function (p) {
      var a = p.getBoundingClientRect(), b = m.getBoundingClientRect();
      tip.innerHTML = '<b>' + esc(p.getAttribute('data-name')) + '</b><span>' + esc(p.getAttribute('data-meta')) + '</span><span>' + esc((p.getAttribute('data-chips') || '').split('|').join(' · ')) + '</span>';
      var x = Math.min(Math.max(a.left + a.width / 2 - b.left, 128), b.width - 128);
      tip.style.left = x + 'px'; tip.style.top = (a.top - b.top) + 'px'; tip.hidden = false;
    };
    m.querySelectorAll('.pin').forEach(function (p) {
      p.addEventListener('mouseenter', function () { show(p); }); p.addEventListener('focus', function () { show(p); });
      p.addEventListener('mouseleave', function () { tip.hidden = true; }); p.addEventListener('blur', function () { tip.hidden = true; });
    });
  });
  document.querySelectorAll('[data-map-type]').forEach(function (b) {
    b.addEventListener('click', function () {
      var t = b.getAttribute('data-map-type');
      document.querySelectorAll('[data-map-type]').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      document.querySelectorAll('.map-section .pin').forEach(function (p) { p.classList.toggle('off', !!t && p.getAttribute('data-type') !== t); });
      if (window.LL3D) window.LL3D.filter(t);
    });
  });

  // ---- motion, only when allowed
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reduce && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        var el = e.target; el.classList.add('in'); io.unobserve(el);
        var to = el.querySelectorAll('[data-count-to]');
        to.forEach(function (n) {
          var end = parseInt(n.getAttribute('data-count-to'), 10), t0 = null;
          var step = function (ts) { if (!t0) t0 = ts; var k = Math.min(1, (ts - t0) / 900); n.textContent = Math.round(end * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(step); };
          n.textContent = '0'; requestAnimationFrame(step);
        });
      });
    }, { rootMargin: '0px 0px -6% 0px' });
    var fold = window.innerHeight, n = 0;
    document.querySelectorAll('.sec-head, .vcard, .style-card, .area-card, .guide-card, .promise li, .qa, .v-main section, .cta, .compare-list li, .factcard, .enquire').forEach(function (el) {
      if (el.getBoundingClientRect().top < fold) return;
      el.style.setProperty('--rd', (n++ % 3) * 80 + 'ms'); el.classList.add('reveal'); io.observe(el);
    });
    document.querySelectorAll('.map, .stats').forEach(function (el) { io.observe(el); });
    var layers = [].slice.call(document.querySelectorAll('.hero-art .hl')), art = document.querySelector('.hero-art'), ticking = false;
    if (layers.length && art) {
      var upd = function () {
        ticking = false; var y = window.scrollY || 0; if (y > art.offsetTop + art.offsetHeight) return;
        layers.forEach(function (l) { l.style.transform = 'translate3d(0,' + (y * parseFloat(l.getAttribute('data-depth') || 0)).toFixed(1) + 'px,0)'; });
      };
      window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(upd); } }, { passive: true });
    }
  }


  // ---- official register: ceremony licence cross-check, updated weekly on the server
  if (/^https?:$/.test(location.protocol)) {
    var badges = document.querySelectorAll('[data-register]'), summary = document.querySelector('[data-register-summary]');
    if (badges.length || summary) {
      fetch('/api/register').then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
        if (!d || !d.venues) return;
        var day = function (x) { return x ? new Date(x).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : ''; };
        badges.forEach(function (b) {
          if (!d.venues[b.getAttribute('data-register')]) return;
          b.textContent = 'On the government’s list of venues approved for civil ceremonies (list published ' + day(d.publishedAt) + ', checked ' + day(d.checkedAt) + '). ';
          var a = document.createElement('a'); a.href = d.source; a.target = '_blank'; a.rel = 'noopener'; a.textContent = 'See the list on GOV.UK'; b.appendChild(a); b.hidden = false;
        });
        if (summary) { summary.textContent = 'Ceremony licences cross-checked every week against the government’s approved venues list, last checked ' + day(d.checkedAt) + '.'; summary.hidden = false; }
      }).catch(function () {});
    }
  }

  // ---- Sussex in 3D: desktop only, loads when the map comes into view
  var m3 = document.querySelector('[data-map3d]');
  var fine = window.matchMedia && window.matchMedia('(min-width: 900px) and (pointer: fine)').matches;
  var saveData = navigator.connection && navigator.connection.saveData;
  if (m3 && fine && !saveData && 'IntersectionObserver' in window) {
    var gl = null; try { var cv = document.createElement('canvas'); gl = cv.getContext('webgl2') || cv.getContext('webgl'); } catch (e) {}
    if (gl) {
      var wrap = m3.closest('.map-3d-wrap'), flat = wrap.querySelector('[data-map]'), tog = wrap.querySelector('.view-toggle');
      var view = function (v) {
        m3.hidden = v !== '3d'; flat.classList.toggle('vh-map', v === '3d');
        tog.querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-view') === v ? 'true' : 'false'); });
      };
      var io3 = new IntersectionObserver(function (es) {
        if (!es.some(function (e) { return e.isIntersecting; })) return;
        io3.disconnect();
        import(new URL(m3.getAttribute('data-src'), location.href).href).then(function (mod) {
          m3.hidden = false;
          return mod.mount(m3, new URL(m3.getAttribute('data-terrain'), location.href).href);
        }).then(function () {
          tog.hidden = false; view('3d'); m3.classList.add('ready');
          tog.addEventListener('click', function (e) { var b = e.target.closest('[data-view]'); if (b) view(b.getAttribute('data-view')); });
          var on = document.querySelector('[data-map-type][aria-pressed="true"]'); if (on && window.LL3D) window.LL3D.filter(on.getAttribute('data-map-type'));
        }).catch(function () { m3.hidden = true; });
      }, { rootMargin: '200px 0px' });
      io3.observe(wrap);
    }
  }

  // ---- hero depth: layers drift with the pointer on desktop
  var heroArt = document.querySelector('.hero-art');
  if (heroArt && fine && !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)) {
    var tx = 0, ty = 0, raf = 0;
    heroArt.addEventListener('pointermove', function (e) {
      var r = heroArt.getBoundingClientRect(); tx = (e.clientX - r.left) / r.width - 0.5; ty = (e.clientY - r.top) / r.height - 0.5;
      if (!raf) raf = requestAnimationFrame(function () { raf = 0; heroArt.style.setProperty('--px', tx.toFixed(3)); heroArt.style.setProperty('--py', ty.toFixed(3)); });
    });
    heroArt.addEventListener('pointerleave', function () { heroArt.style.setProperty('--px', 0); heroArt.style.setProperty('--py', 0); });
  }

  sync(); renderShortlist();
})();
