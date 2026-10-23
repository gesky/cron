// Cron Web Studio · Cursor
// Bolinha verde com rastro. Sobre links e botões, vira o ícone da Cron.
// Só ativa em mouse/trackpad (desativado no toque e com movimento reduzido).

(function () {
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!fine || reduced) return;

  var ICON = 'M195.9,111.98c26.43-39.36,38.58-79.98,17.4-101.17S151.47,1.78,112.1,28.23C72.74,1.78,32.11-10.38,10.92,10.81-10.27,31.99,1.88,72.62,28.31,111.98,1.81,151.38-10.4,192.08,10.81,213.29c21.21,21.21,61.9,9.01,101.29-17.48,39.39,26.49,80.09,38.69,101.29,17.48,21.21-21.21,9-61.91-17.5-101.31ZM28.19,28.08c7.53-7.53,30.91-3.58,60.33,13.95,1.32.79,1.46,2.65.27,3.63-4.84,3.99-9.58,8.15-14.2,12.45-.92.86-.94,2.32-.05,3.21l14.13,14.13c.84.84,2.21.86,3.08.04,4.49-4.18,8.95-8.08,13.36-11.72,4.05-3.35,9.95-3.35,14,0,4.41,3.64,8.87,7.54,13.36,11.72.87.81,2.24.8,3.08-.04l14.13-14.13c.89-.89.87-2.35-.05-3.21-4.62-4.29-9.37-8.45-14.2-12.45-1.19-.98-1.05-2.85.27-3.63,29.42-17.54,52.8-21.48,60.33-13.95,7.53,7.53,3.59,30.91-13.93,60.33-.79,1.32-2.65,1.46-3.63.27-3.97-4.8-8.1-9.51-12.36-14.09-.86-.92-2.32-.94-3.21-.05l-14.13,14.13c-.84.84-.86,2.21-.04,3.08,4.14,4.45,8.01,8.87,11.63,13.25,3.36,4.06,3.35,9.96,0,14.03-5.87,7.1-12.42,14.35-19.7,21.62-7.24,7.24-14.45,13.77-21.53,19.62-4.06,3.36-9.95,3.36-14.01,0-7.07-5.85-14.28-12.38-21.53-19.62-7.27-7.27-13.83-14.51-19.7-21.62-3.36-4.06-3.36-9.96,0-14.03,3.61-4.37,7.48-8.8,11.63-13.25.81-.87.8-2.24-.04-3.08l-14.13-14.13c-.89-.89-2.35-.87-3.21.05-4.26,4.58-8.39,9.29-12.36,14.09-.98,1.19-2.85,1.05-3.63-.27-17.53-29.42-21.46-52.8-13.93-60.33ZM28.08,196.02c-7.54-7.54-3.57-30.98,14.03-60.46.79-1.32,2.66-1.45,3.64-.27,6.46,7.83,13.36,15.43,20.55,22.62,7.15,7.15,14.72,14.02,22.51,20.46,1.19.98,1.05,2.85-.27,3.64-29.48,17.59-52.92,21.55-60.45,14.01ZM196.13,196.02c-7.54,7.54-30.98,3.58-60.45-14.01-1.32-.79-1.45-2.66-.27-3.64,7.79-6.44,15.35-13.31,22.51-20.46,7.19-7.19,14.09-14.79,20.55-22.62.98-1.19,2.85-1.05,3.64.27,17.6,29.48,21.57,52.92,14.03,60.46Z';

  var root = document.documentElement;
  root.classList.add('has-cursor');

  // Elementos
  var canvas = document.createElement('canvas');
  canvas.className = 'cursor-trail';
  canvas.setAttribute('aria-hidden', 'true');
  var ctx = canvas.getContext('2d');

  var cur = document.createElement('div');
  cur.className = 'cursor';
  cur.setAttribute('aria-hidden', 'true');
  cur.innerHTML =
    '<span class="cursor__dot"></span>' +
    '<svg class="cursor__icon" viewBox="0 0 224.21 224.1"><path d="' + ICON + '"/></svg>';

  document.body.appendChild(canvas);
  document.body.appendChild(cur);

  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  function resize() {
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
    canvas.style.width = innerWidth + 'px';
    canvas.style.height = innerHeight + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize);

  var mouse = { x: -100, y: -100 };
  var pos = { x: -100, y: -100 };
  var trail = [];
  var visible = false;
  var TRAIL_LIFE = 380; // ms

  window.addEventListener('mousemove', function (e) {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    if (!visible) { visible = true; pos.x = mouse.x; pos.y = mouse.y; cur.classList.add('is-visible'); }
    trail.push({ x: e.clientX, y: e.clientY, t: performance.now() });
  }, { passive: true });

  document.addEventListener('mouseleave', function () { visible = false; cur.classList.remove('is-visible'); trail.length = 0; });
  window.addEventListener('mousedown', function () { cur.classList.add('is-down'); });
  window.addEventListener('mouseup', function () { cur.classList.remove('is-down'); });

  // Estado sobre links, botões e campos de texto
  var LINKS = 'a, button, summary, label, [role="button"], .chip';
  var TEXT = 'input[type="text"], input[type="email"], input[type="tel"], input[type="password"], input[type="url"], textarea, select';
  document.addEventListener('mouseover', function (e) {
    var t = e.target;
    var isText = !!t.closest(TEXT);
    var isLink = !isText && !!t.closest(LINKS);
    cur.classList.toggle('is-link', isLink);
    cur.classList.toggle('is-text', isText);
    // dentro dos cards de Formatos a bolinha some e vira a luz do próprio card
    cur.classList.toggle('is-light', !!t.closest('.plan'));
  });

  // Cor do rastro (verde da marca)
  var LIME = '198, 255, 2';

  function frame() {
    var now = performance.now();

    // bolinha segue o mouse com leve atraso
    pos.x += (mouse.x - pos.x) * 0.32;
    pos.y += (mouse.y - pos.y) * 0.32;
    cur.style.transform = 'translate3d(' + pos.x + 'px,' + pos.y + 'px,0)';

    // rastro: linha que afina e some
    while (trail.length && now - trail[0].t > TRAIL_LIFE) trail.shift();
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    if (trail.length > 2 && !cur.classList.contains('is-link') && !cur.classList.contains('is-light')) {
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      // curva suavizada: cada trecho vai do meio de um ponto ao meio do próximo
      for (var i = 1; i < trail.length - 1; i++) {
        var a = trail[i - 1], b = trail[i], c = trail[i + 1];
        var life = 1 - (now - b.t) / TRAIL_LIFE;
        if (life <= 0) continue;
        var ease = life * life; // some de forma mais gradual
        ctx.strokeStyle = 'rgba(' + LIME + ',' + (ease * 0.45).toFixed(3) + ')';
        ctx.lineWidth = 1 + ease * 3.5;
        ctx.beginPath();
        ctx.moveTo((a.x + b.x) / 2, (a.y + b.y) / 2);
        ctx.quadraticCurveTo(b.x, b.y, (b.x + c.x) / 2, (b.y + c.y) / 2);
        ctx.stroke();
      }
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
