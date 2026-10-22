// Cron Web Studio · Projetos no ar (dinâmico)
// Lê a coleção "projects" do Firestore (só os publicados) e monta os cards.
// Se o Firebase não estiver configurado ou não houver projetos,
// os cards de exemplo do HTML continuam na página.

(function () {
  var wrap = document.getElementById('cases');
  if (!wrap || !window.CRON || !CRON.configured || !CRON.db) return;

  function esc(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function safeUrl(url) {
    url = String(url || '').trim();
    if (!url) return '';
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    return url;
  }

  function slug(str) {
    return String(str || 'projeto').toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'projeto';
  }

  function render(p, i) {
    var media = p.image
      ? '<div class="case__media"><img src="' + esc(p.image) + '" alt="' + esc(p.imageAlt || p.title) + '" loading="lazy" decoding="async"></div>'
      : '<div class="ph ph--case" role="img" aria-label="Espaço para imagem"><span class="ph__label">Imagem do projeto</span></div>';

    var meta = [p.client, p.segment].filter(Boolean).map(esc).join(' · ');

    var quote = (p.quote && p.quote.text)
      ? '<blockquote class="quote">“' + esc(p.quote.text) + '”' + (p.quote.author ? '<cite>' + esc(p.quote.author) + '</cite>' : '') + '</blockquote>'
      : '';

    var tags = (p.tags || []).length
      ? '<ul class="tags">' + p.tags.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>'
      : '';

    var url = safeUrl(p.siteUrl);
    var site = url
      ? '<a href="' + esc(url) + '" class="link" target="_blank" rel="noopener" data-no-form>' + esc(p.siteLabel || 'Ver site no ar') + ' ↗</a>'
      : '';

    var cta = '<a href="#" class="btn btn--primary btn--sm" data-cta="case-' + slug(p.client) + '" data-project="' + esc(p.client || p.title) + '">' + esc(p.ctaLabel || 'Quero um assim') + '</a>';

    var el = document.createElement('article');
    el.className = 'case reveal' + (i % 2 === 1 ? ' case--reverse' : '');
    el.innerHTML = media +
      '<div class="case__body">' +
        (meta ? '<p class="case__meta">' + meta + '</p>' : '') +
        '<h3>' + esc(p.title) + '</h3>' +
        (p.description ? '<p>' + esc(p.description) + '</p>' : '') +
        quote + tags +
        '<div class="case__ctas">' + cta + site + '</div>' +
      '</div>';
    return el;
  }

  CRON.db.collection('projects').where('published', '==', true).get()
    .then(function (snap) {
      var list = [];
      snap.forEach(function (d) { list.push(Object.assign({ id: d.id }, d.data())); });
      if (!list.length) return;
      list.sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
      list = list.slice(0, CRON.MAX_PROJECTS);

      wrap.innerHTML = '';
      list.forEach(function (p, i) {
        var el = render(p, i);
        wrap.appendChild(el);
        if (window.CronUI) CronUI.observeReveal(el);
        else el.classList.add('in-view');
      });
      if (window.CronUI && CronUI.lenis) CronUI.lenis.resize();
    })
    .catch(function (e) {
      console.warn('[Cron] Não foi possível carregar os projetos:', e);
    });
})();
