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

  // Ano do rodapé
  var year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();
})();
