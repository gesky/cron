// Cron Web Studio · Página pública do site modelo (rascunho de apresentação)
// Lê ?id=<previewId>, busca a prévia ativa no Firestore e desenha com o template permitido.
// Modo demonstração: modelo/?demo=<id>, só no computador (file:// ou localhost).
// Nada aqui grava dados. Todo texto vindo do banco passa por esc; imagens só como data URL.

(function () {
  'use strict';

  // Anti-clickjacking: o rascunho nunca roda dentro de um iframe de outro site
  if (window.top !== window.self) {
    document.documentElement.innerHTML = '';
    try { window.top.location = window.self.location.href; } catch (e) {}
    return;
  }

  var M = window.CRON_MODELO;
  var ALLOWED = window.CRON_MODELO_TEMPLATES || ['_base'];
  var IMG = /^data:image\/(webp|png|jpeg);base64,[A-Za-z0-9+/=]+$/;
  var $ = function (s, r) { return (r || document).querySelector(s); };

  // ---------- Utilidades ----------
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function str(v, max) { return typeof v === 'string' ? v.slice(0, max) : ''; }
  function list(v, n, max) {
    return Array.isArray(v) ? v.filter(function (x) { return typeof x === 'string' && x.trim(); }).slice(0, n).map(function (x) { return x.slice(0, max); }) : [];
  }
  function img(v) { return typeof v === 'string' && IMG.test(v) ? v : ''; }
  function joinNice(arr) {
    if (!arr.length) return '';
    if (arr.length === 1) return arr[0];
    return arr.slice(0, -1).join(', ') + ' e ' + arr[arr.length - 1];
  }
  function initials(name) {
    var p = String(name || '').trim().split(/\s+/).filter(Boolean);
    return ((p[0] || '')[0] || '') + ((p[1] || '')[0] || '');
  }

  // Marcadores {empresa}, {servicoPrincipal}, {servicos}. Sem valor, somem sem espaço duplo.
  function fill(text, vars) {
    var out = String(text || '').replace(/\{(empresa|servicoPrincipal|servicos)\}/g, function (m, k) { return vars[k] || ''; });
    out = out.replace(/[ \t]{2,}/g, ' ').replace(/\s+([,.;:!?])/g, '$1').replace(/^\s+|\s+$/g, '');
    return out.charAt(0).toUpperCase() + out.slice(1);
  }

  // ---------- Cores com contraste (WCAG AA) ----------
  function hexToRgb(h) {
    var m = /^#?([0-9a-f]{6})$/i.exec(h || '');
    if (!m) return null;
    var n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgbToHex(c) { return '#' + c.map(function (v) { v = Math.max(0, Math.min(255, Math.round(v))); return (v < 16 ? '0' : '') + v.toString(16); }).join(''); }
  function lum(c) {
    var a = c.map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
  }
  function contrast(a, b) { var l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); }
  function mix(c, t, k) { return c.map(function (v, i) { return v + (t[i] - v) * k; }); }
  var WHITE = [255, 255, 255], INK = [17, 24, 32];
  // Escurece até ter contraste mínimo sobre o branco (para textos e links na cor da marca)
  function onWhite(c, min) {
    var x = c.slice();
    for (var i = 0; i < 30 && contrast(x, WHITE) < min; i++) x = mix(x, INK, 0.12);
    return x;
  }
  // Fundo na cor da marca: escolhe texto branco ou escuro; se nenhum passa, ajusta o fundo
  function fillPair(c) {
    var bg = c.slice();
    for (var i = 0; i < 30; i++) {
      if (contrast(bg, WHITE) >= 4.5) return { bg: bg, ink: WHITE };
      if (contrast(bg, INK) >= 4.5) return { bg: bg, ink: INK };
      bg = lum(bg) > 0.25 ? mix(bg, WHITE, 0.1) : mix(bg, INK, 0.1);
    }
    return { bg: bg, ink: contrast(bg, WHITE) > contrast(bg, INK) ? WHITE : INK };
  }
  function applyColors(primary, secondary) {
    var p = hexToRgb(primary) || [30, 41, 59];
    var s = hexToRgb(secondary) || (hexToRgb(primary) ? mix(p, WHITE, 0.55) : [148, 163, 184]);
    var pp = fillPair(p), sp = fillPair(s);
    var root = document.documentElement.style;
    root.setProperty('--c-primary', rgbToHex(pp.bg));
    root.setProperty('--c-on-primary', rgbToHex(pp.ink));
    root.setProperty('--c-primary-text', rgbToHex(onWhite(p, 4.5)));
    root.setProperty('--c-primary-soft', rgbToHex(mix(p, WHITE, 0.9)));
    root.setProperty('--c-primary-line', rgbToHex(mix(p, WHITE, 0.75)));
    root.setProperty('--c-secondary', rgbToHex(sp.bg));
    root.setProperty('--c-on-secondary', rgbToHex(sp.ink));
    root.setProperty('--c-secondary-text', rgbToHex(onWhite(s, 4.5)));
    root.setProperty('--c-secondary-soft', rgbToHex(mix(s, WHITE, 0.86)));
    var meta = $('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', rgbToHex(pp.bg));
  }

  // ---------- Dados prontos para o template ----------
  var FIELDS = ['headline', 'subheadline', 'about', 'ctaPrimary', 'ctaSecondary', 'contactTitle', 'contactText', 'catalogTitle', 'catalogText', 'diferenciais', 'benefits'];
  var LIMITS = { headline: 120, subheadline: 240, about: 900, ctaPrimary: 40, ctaSecondary: 40, contactTitle: 80, contactText: 240, catalogTitle: 80, catalogText: 240 };

  function prepare(p, def, base) {
    var format = ['landing', 'institucional', 'catalogo'].indexOf(p.format) !== -1 ? p.format : 'institucional';
    var company = str(p.companyName, 120) || 'Sua empresa';
    var services = list(p.services, 8, 60);
    // Opções do template (o _base não usa nenhuma): mainFromServices false não usa o primeiro
    // serviço como principal; mainFallback troca o "serviços sob medida"; lowerMain põe a
    // primeira letra em minúscula no meio da frase (só se a segunda já for minúscula, para não
    // estragar siglas como "CNC").
    var opt = (def && def.options) || {};
    var mainService = str(p.mainService, 80) || (opt.mainFromServices === false ? '' : services[0]) || '';
    var mainVar = mainService && opt.lowerMain && /^.[a-zà-ÿ]/.test(mainService) ? mainService.charAt(0).toLowerCase() + mainService.slice(1) : mainService;
    var vars = { empresa: company, servicoPrincipal: mainVar || opt.mainFallback || 'serviços sob medida', servicos: joinNice(services) || mainService };
    var tx = p.texts && typeof p.texts === 'object' ? p.texts : {};
    var dT = (def && def.defaults && def.defaults[format]) || {};
    var dB = (base && base.defaults && base.defaults[format]) || {};
    var texts = {};
    FIELDS.forEach(function (k) {
      var isList = k === 'diferenciais' || k === 'benefits';
      var own = isList ? list(tx[k], 6, 120) : str(tx[k], LIMITS[k]).trim();
      var v = (isList ? own.length : own) ? own : (dT[k] != null ? dT[k] : dB[k]);
      texts[k] = isList ? (v || []).map(function (x) { return fill(x, vars); }) : fill(v || '', vars);
    });
    var all = window.CRON_PRODUTOS ? window.CRON_PRODUTOS.unpack(p.products) : (Array.isArray(p.products) ? p.products : []);
    var products = format === 'catalogo' ? all.slice(0, 24).filter(function (x) {
      return x && typeof x.name === 'string' && x.name.trim();
    }).map(function (x) {
      return { name: str(x.name, 60), description: str(x.description, 160), category: str(x.category, 40), image: img(x.image) };
    }) : [];
    var categories = format === 'catalogo' ? list(p.categories, 12, 40) : [];
    if (format === 'catalogo') {
      products.forEach(function (x) { if (x.category && categories.indexOf(x.category) === -1 && categories.length < 12) categories.push(x.category); });
    }
    return {
      format: format, company: company, initials: initials(company).toUpperCase(),
      tagline: str(p.tagline, 120), mainService: mainService, services: services,
      logo: img(p.logo), products: products, categories: categories, texts: texts
    };
  }

  // ---------- Carregamento ----------
  var isLocal = location.protocol === 'file:' || /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  var params = new URLSearchParams(location.search);

  function unavailable() {
    $('#mLoading').hidden = true;
    $('#mSite').hidden = true;
    $('#mUnavailable').hidden = false;
    document.title = 'Rascunho indisponível';
  }

  function loadData() {
    var demoId = params.get('demo');
    if (demoId && isLocal) {
      var local = null;
      try { local = JSON.parse(localStorage.getItem('cron_demo_preview_' + demoId) || 'null'); } catch (e) {}
      var p = local || (window.CRON_MODELO_DEMO && window.CRON_MODELO_DEMO.get(demoId));
      return Promise.resolve(p && p.active !== false ? p : null);
    }
    var id = params.get('id') || '';
    if (!/^[A-Za-z0-9]{20}$/.test(id)) return Promise.resolve(null);
    var C = window.CRON || {};
    if (!C.db) return Promise.resolve(null);
    return C.db.collection('previews').doc(id).get().then(function (d) {
      var p = d.exists ? d.data() : null;
      return p && p.active === true ? p : null;
    }).catch(function () { return null; });
  }

  function loadTemplate(name) {
    return new Promise(function (resolve, reject) {
      if (ALLOWED.indexOf(name) === -1) { reject(new Error('template')); return; }
      if (M.defs[name]) { resolve(M.defs[name]); return; }
      var css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = 'templates/' + name + '/template.css';
      document.head.appendChild(css);
      var js = document.createElement('script');
      js.src = 'templates/' + name + '/template.js';
      js.onload = function () { M.defs[name] ? resolve(M.defs[name]) : reject(new Error('template')); };
      js.onerror = function () { reject(new Error('template')); };
      document.body.appendChild(js);
    });
  }

  // Botões de ação da prévia: só avisam como vai funcionar no site final
  var noticeTimer = null;
  function notice() {
    var n = $('#mNotice');
    n.hidden = false;
    requestAnimationFrame(function () { n.classList.add('is-on'); });
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(function () {
      n.classList.remove('is-on');
      setTimeout(function () { n.hidden = true; }, 300);
    }, 3200);
  }

  loadData().then(function (p) {
    if (!p) { unavailable(); return; }
    var name = ALLOWED.indexOf(p.template) !== -1 ? p.template : '_base';
    // o _base sempre carrega: os textos padrão dele são a última opção de qualquer template
    return loadTemplate('_base').then(function (base) {
      return (name === '_base' ? Promise.resolve(base) : loadTemplate(name).catch(function () { return base; })).then(function (def) {
        var data = prepare(p, def, base);
        applyColors(p.primaryColor, p.secondaryColor);
        var el = $('#mSite');
        document.body.classList.add('m-format-' + data.format);
        def.render(data, el, { esc: esc });
        document.title = data.company + (data.tagline ? ' | ' + data.tagline : '');
        $('#mDraftText').textContent = 'Rascunho feito pela Cron Web Studio para ' + data.company;
        $('#mLoading').hidden = true;
        el.hidden = false;
        $('#mDraftbar').hidden = false;
        el.addEventListener('click', function (e) {
          if (e.target.closest('[data-cta]')) { e.preventDefault(); notice(); }
        });
      });
    });
  }).catch(function (err) {
    console.error(err);
    unavailable();
  });

  M.esc = esc;
})();
