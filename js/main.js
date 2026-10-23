// Cron Web Studio · Landing
// Rolagem suave (Lenis) + reveal com fade/blur (padrão MedControl)
// + header de vidro que escurece sobre seções escuras.

(function () {
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Logo: se o PNG não carregar, mostra o nome em texto
  document.querySelectorAll('img[data-fallback]').forEach(function (img) {
    function swap() {
      var span = document.createElement('span');
      span.className = 'logo-fallback';
      span.textContent = img.dataset.fallback;
      img.replaceWith(span);
    }
    if (img.complete && img.naturalWidth === 0) swap();
    else img.addEventListener('error', swap);
  });

  // ------------------------------------------------------------------
  // Rolagem suave (Lenis), sutil. Se a biblioteca não carregar,
  // a página usa a rolagem padrão do navegador e nada quebra.
  // ------------------------------------------------------------------
  var lenis = null;
  if (window.Lenis && !reduced) {
    lenis = new Lenis({ duration: 1.1 });
    (function raf(time) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    })(0);
  }

  var header = document.getElementById('header');
  function headerOffset() {
    return -((header ? header.offsetHeight : 80) + 24);
  }

  // Links internos (#secao) rolam suave, descontando o header flutuante
  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    var id = a.getAttribute('href');
    if (id.length < 2) return;
    a.addEventListener('click', function (e) {
      var target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      if (lenis) lenis.scrollTo(id === '#topo' ? 0 : target, { offset: headerOffset() });
      else window.scrollTo({ top: id === '#topo' ? 0 : target.getBoundingClientRect().top + window.scrollY + headerOffset(), behavior: reduced ? 'auto' : 'smooth' });
    });
  });

  // CTAs ainda sem link: não fazem nada por enquanto.
  // Cada botão tem um data-cta único, pronto para receber o link
  // do WhatsApp e os eventos de Pixel / GA4.
  document.querySelectorAll('a[data-cta]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      if (a.getAttribute('href') === '#') e.preventDefault();
    });
  });

  // ------------------------------------------------------------------
  // Header: vidro escuro quando passa sobre seções escuras
  // ------------------------------------------------------------------
  var darkZones = document.querySelectorAll('.section--dark, .footer');

  function onScroll() {
    var probe = (header ? header.offsetHeight / 2 + 14 : 40);
    var dark = false;
    darkZones.forEach(function (z) {
      var r = z.getBoundingClientRect();
      if (r.top <= probe && r.bottom >= probe) dark = true;
    });
    if (header) header.classList.toggle('is-dark', dark);
  }
  if (lenis) lenis.on('scroll', onScroll);
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  onScroll();

  // ------------------------------------------------------------------
  // Menu mobile
  // ------------------------------------------------------------------
  var toggle = document.getElementById('menuToggle');
  var nav = document.getElementById('nav');

  function setMenu(open) {
    nav.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
    if (lenis) open ? lenis.stop() : lenis.start();
  }
  toggle.addEventListener('click', function () {
    setMenu(!nav.classList.contains('is-open'));
  });
  nav.querySelectorAll('a').forEach(function (a) {
    a.addEventListener('click', function () { setMenu(false); });
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') setMenu(false);
  });

  // ------------------------------------------------------------------
  // Reveal ao rolar (fade + blur). Itens vizinhos entram em
  // sequência, com um pequeno atraso entre um e outro.
  // ------------------------------------------------------------------
  var items = document.querySelectorAll('.reveal');
  items.forEach(function (el) {
    var siblings = Array.prototype.filter.call(el.parentElement.children, function (c) {
      return c.classList.contains('reveal');
    });
    var i = siblings.indexOf(el);
    if (i > 0) el.style.setProperty('--d', Math.min(i, 5) * 0.08 + 's');
  });

  var io = null;
  if ('IntersectionObserver' in window && !reduced) {
    io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    var startReveal = function () { items.forEach(function (el) { io.observe(el); }); };
    // Com a abertura na tela, o hero só entra depois que ela sai
    if (document.documentElement.classList.contains('is-intro')) {
      if (lenis) lenis.stop();
      document.addEventListener('cron:intro-end', function () {
        if (lenis) lenis.start();
        setTimeout(startReveal, 150);
      }, { once: true });
    } else startReveal();
  } else {
    items.forEach(function (el) { el.classList.add('in-view'); });
  }

  // Usado pelos outros scripts (projetos dinâmicos, formulário)
  window.CronUI = {
    lenis: lenis,
    observeReveal: function (el, delay) {
      if (delay) el.style.setProperty('--d', delay + 's');
      if (io) io.observe(el); else el.classList.add('in-view');
    }
  };

  // FAQ: abre e fecha com animação; abrir uma fecha a que estiver aberta
  var faqs = Array.prototype.slice.call(document.querySelectorAll('.faq__item'));
  var EASE = 'cubic-bezier(.2, .7, .2, 1)';

  function faqAnim(d, opening) {
    var a = d.querySelector('.faq__a');
    if (!a || reduced || !a.animate) { d.open = opening; return; }
    if (d._anim) d._anim.cancel();
    if (opening) d.open = true;
    var h = a.scrollHeight;
    var frames = opening
      ? [{ height: '0px', opacity: 0, filter: 'blur(6px)' }, { height: h + 'px', opacity: 1, filter: 'blur(0)' }]
      : [{ height: h + 'px', opacity: 1, filter: 'blur(0)' }, { height: '0px', opacity: 0, filter: 'blur(6px)' }];
    a.style.overflow = 'hidden';
    d._anim = a.animate(frames, { duration: opening ? 480 : 360, easing: EASE });
    d._anim.onfinish = function () {
      if (!opening) { d.open = false; d.classList.remove('is-closing'); }
      a.style.overflow = '';
      d._anim = null;
      if (lenis) lenis.resize();
    };
  }

  faqs.forEach(function (d) {
    d.querySelector('summary').addEventListener('click', function (e) {
      e.preventDefault();
      var opening = !d.open || d.classList.contains('is-closing');
      d.classList.toggle('is-closing', !opening);
      if (opening) {
        faqs.forEach(function (o) {
          if (o !== d && o.open && !o.classList.contains('is-closing')) {
            o.classList.add('is-closing');
            faqAnim(o, false);
          }
        });
      }
      faqAnim(d, opening);
    });
  });

  // Cards de Formatos: inclinam de leve e acendem uma luz onde o mouse está
  if (!reduced && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    document.querySelectorAll('.plan').forEach(function (card) {
      var s = { mx: 50, my: 50, l: 0, tx: 0, ty: 0 };      // estado atual
      var t = { mx: 50, my: 50, l: 0, tx: 0, ty: 0 };      // alvo
      var raf = null;
      function tick() {
        var k = 0.16, done = true;
        for (var key in s) {
          s[key] += (t[key] - s[key]) * k;
          if (Math.abs(t[key] - s[key]) > 0.01) done = false;
        }
        // inclinação: eixo perpendicular ao deslocamento do mouse, até ~4 graus
        var ang = Math.sqrt(s.tx * s.tx + s.ty * s.ty);
        card.style.setProperty('--mx', s.mx.toFixed(2) + '%');
        card.style.setProperty('--my', s.my.toFixed(2) + '%');
        card.style.setProperty('--l', s.l.toFixed(3));
        card.style.setProperty('--rx', ang ? (-s.ty / ang).toFixed(3) : 0);
        card.style.setProperty('--ry', ang ? (s.tx / ang).toFixed(3) : 1);
        card.style.setProperty('--ra', (ang * 4).toFixed(3) + 'deg');
        raf = done ? null : requestAnimationFrame(tick);
      }
      function go() { if (!raf) raf = requestAnimationFrame(tick); }
      card.addEventListener('mousemove', function (e) {
        var r = card.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        t.mx = x * 100; t.my = y * 100; t.l = 1;
        t.tx = x - 0.5; t.ty = y - 0.5;
        go();
      });
      card.addEventListener('mouseleave', function () { t.l = 0; t.tx = 0; t.ty = 0; go(); });
    });
  }

  // Animação do painel: só roda enquanto está na tela
  var motion = document.getElementById('motion');
  if (motion && 'IntersectionObserver' in window && !reduced) {
    new IntersectionObserver(function (e) {
      motion.classList.toggle('is-playing', e[0].isIntersecting);
    }, { threshold: 0.2 }).observe(motion);
  }

  // Paralaxe da foto do Próximo passo: fundo e pessoa andam em ritmos diferentes
  // com a rolagem, e no desktop também acompanham o mouse
  var px = document.getElementById('parallax');
  if (px && !reduced) {
    var cur = { s: 0, mx: 0, my: 0 }, tgt = { s: 0, mx: 0, my: 0 }, pxRaf = null, pxOn = false;
    function pxRead() {
      var r = px.getBoundingClientRect();
      var c = r.top + r.height / 2 - window.innerHeight / 2;
      tgt.s = Math.max(-1, Math.min(1, c / (window.innerHeight / 2 + r.height / 2)));
    }
    function pxTick() {
      pxRead();
      var still = true;
      for (var k in cur) { cur[k] += (tgt[k] - cur[k]) * 0.1; if (Math.abs(tgt[k] - cur[k]) > 0.001) still = false; }
      var h = px.offsetHeight;
      px.style.setProperty('--by', (cur.s * h * 0.05 - cur.my * 8).toFixed(2) + 'px');
      px.style.setProperty('--bx', (-cur.mx * 10).toFixed(2) + 'px');
      px.style.setProperty('--fy', (-cur.s * h * 0.035 + cur.my * 10).toFixed(2) + 'px');
      px.style.setProperty('--fx', (cur.mx * 16).toFixed(2) + 'px');
      pxRaf = (pxOn || !still) ? requestAnimationFrame(pxTick) : null;
    }
    function pxStart() { if (!pxRaf) pxRaf = requestAnimationFrame(pxTick); }
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (e) { pxOn = e[0].isIntersecting; if (pxOn) pxStart(); }).observe(px);
    }
    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      px.addEventListener('mousemove', function (e) {
        var r = px.getBoundingClientRect();
        tgt.mx = (e.clientX - r.left) / r.width - 0.5;
        tgt.my = (e.clientY - r.top) / r.height - 0.5;
        pxStart();
      });
      px.addEventListener('mouseleave', function () { tgt.mx = 0; tgt.my = 0; pxStart(); });
    }
  }

  // Ano do rodapé
  var year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();
})();
