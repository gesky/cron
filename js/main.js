// Cron Web Studio · Landing

(function () {
  // Logo: se o PNG ainda não estiver na pasta, mostra o nome em texto
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

  // Header com borda ao rolar + botão flutuante depois do hero
  var header = document.querySelector('.header');
  var floatBtn = document.querySelector('.float-wa');
  var hero = document.querySelector('.hero');

  function onScroll() {
    var y = window.scrollY;
    header.classList.toggle('is-scrolled', y > 8);
    if (hero && floatBtn) {
      floatBtn.classList.toggle('is-visible', y > hero.offsetHeight * 0.7);
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Menu mobile
  var toggle = document.getElementById('menuToggle');
  var nav = document.getElementById('nav');

  function closeMenu() {
    nav.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Abrir menu');
    document.body.style.overflow = '';
  }

  toggle.addEventListener('click', function () {
    var open = nav.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
    document.body.style.overflow = open ? 'hidden' : '';
  });

  nav.querySelectorAll('a').forEach(function (a) {
    a.addEventListener('click', closeMenu);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeMenu();
  });

  // Reveal ao rolar
  var items = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    items.forEach(function (el) { io.observe(el); });
  } else {
    items.forEach(function (el) { el.classList.add('is-in'); });
  }

  // CTAs ainda sem link: não pulam para o topo.
  // Cada botão tem data-cta com um nome único, pronto para
  // receber o link do WhatsApp e os eventos de Pixel / GA4.
  document.querySelectorAll('a[data-cta]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      if (a.getAttribute('href') === '#') e.preventDefault();
    });
  });

  // Ano do rodapé
  var year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();
})();
