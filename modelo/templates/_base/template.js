// Cron Web Studio · Template base dos sites modelo
// Serve para qualquer empresa de serviço ou indústria. Três formatos: landing, institucional e catálogo.
// Textos padrão: sem dados inventados, sem preço, sem cidade. Marcadores: {empresa}, {servicoPrincipal}, {servicos}.
// Para criar um nicho novo: copie esta pasta, renomeie, ajuste os defaults e o visual e registre o nome em ../registry.js.

(function () {
  'use strict';

  var common = {
    benefits: [
      'Atendimento direto com quem entende do assunto',
      'Orçamento claro antes de começar',
      'Acompanhamento em cada etapa',
      'Compromisso com o que foi combinado'
    ],
    diferenciais: [
      'Atendimento próximo, do primeiro contato à entrega',
      'Soluções pensadas para a sua necessidade',
      'Comunicação clara durante todo o trabalho',
      'Suporte depois da entrega'
    ]
  };

  var defaults = {
    landing: {
      headline: '{servicoPrincipal} com cuidado do primeiro contato à entrega',
      subheadline: 'A {empresa} cuida de cada etapa para você ter tranquilidade e um resultado à altura do que precisa.',
      about: 'Cada trabalho começa entendendo o que você precisa. A partir daí, a {empresa} apresenta o melhor caminho, combina cada etapa e acompanha tudo até a entrega.',
      benefits: common.benefits,
      diferenciais: common.diferenciais,
      ctaPrimary: 'Pedir orçamento',
      ctaSecondary: 'Conhecer o serviço',
      contactTitle: 'Vamos conversar sobre o que você precisa?',
      contactText: 'Conte o que você precisa e a {empresa} responde com as próximas etapas.',
      catalogTitle: 'Catálogo',
      catalogText: 'Veja os produtos por categoria e peça um orçamento do que precisar.'
    },
    institucional: {
      headline: '{servicoPrincipal} com qualidade e atenção a cada detalhe',
      subheadline: 'A {empresa} reúne {servicos} com atendimento próximo, do primeiro contato à entrega.',
      about: 'A {empresa} trabalha para que cada cliente tenha clareza do começo ao fim. Antes de começar, a equipe entende a necessidade, apresenta a melhor solução e combina cada etapa. Durante o trabalho, você sabe o que está acontecendo. Depois da entrega, continua contando com quem conhece o seu projeto.',
      benefits: common.benefits,
      diferenciais: common.diferenciais,
      ctaPrimary: 'Falar com a gente',
      ctaSecondary: 'Ver serviços',
      contactTitle: 'Fale com a {empresa}',
      contactText: 'Conte o que você precisa. A equipe responde com as próximas etapas e um orçamento sob medida.',
      catalogTitle: 'Catálogo',
      catalogText: 'Veja os produtos por categoria e peça um orçamento do que precisar.'
    },
    catalogo: {
      headline: 'Conheça a linha de produtos da {empresa}',
      subheadline: 'Escolha os itens que interessam e peça um orçamento direto com a equipe.',
      about: 'A {empresa} trabalha para que cada cliente encontre o produto certo para a sua necessidade. A equipe ajuda a escolher, explica as opções e prepara um orçamento sob medida.',
      benefits: common.benefits,
      diferenciais: [
        'Ajuda para escolher o produto certo',
        'Orçamento sob medida para cada pedido',
        'Atendimento próximo do pedido à entrega',
        'Informações claras sobre cada item'
      ],
      ctaPrimary: 'Pedir orçamento',
      ctaSecondary: 'Ver catálogo',
      contactTitle: 'Não encontrou o que procura?',
      contactText: 'Fale com a {empresa}. A equipe ajuda a encontrar a melhor opção para o seu pedido.',
      catalogTitle: 'Catálogo',
      catalogText: 'Veja os produtos por categoria e peça um orçamento do que precisar.'
    }
  };

  var ICON = {
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    spark: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/></svg>',
    chat: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20l1.3-3.9A8 8 0 1 1 8 18.8L4 20Z"/></svg>'
  };

  function render(d, el, h) {
    var esc = h.esc;
    var t = d.texts;
    var hasServices = d.services.length > 0;
    var isCat = d.format === 'catalogo', isLanding = d.format === 'landing';

    var brand = d.logo
      ? '<img class="t-brand__logo" src="' + d.logo + '" alt="Logo da ' + esc(d.company) + '">'
      : '<span class="t-brand__mono" aria-hidden="true">' + esc(d.initials || 'E') + '</span>';

    var nav = [];
    if (isLanding) nav = [['#destaque', 'Serviço'], ['#beneficios', 'Por que nós'], ['#contato', 'Contato']];
    else {
      if (isCat) nav.push(['#catalogo', 'Catálogo']);
      if (hasServices) nav.push(['#servicos', 'Serviços']);
      nav.push(['#sobre', 'Sobre'], ['#contato', 'Contato']);
    }

    var html = '';
    // ---------- Topo ----------
    html += '<header class="t-header"><div class="t-wrap t-header__in">' +
      '<a class="t-brand" href="#topo">' + brand + '<span class="t-brand__name">' + esc(d.company) + '</span></a>' +
      '<nav class="t-nav" aria-label="Seções">' + nav.map(function (n) { return '<a href="' + n[0] + '">' + n[1] + '</a>'; }).join('') + '</nav>' +
      '<button class="t-btn t-btn--primary t-btn--sm" type="button" data-cta>' + esc(t.ctaPrimary) + '</button>' +
    '</div></header>';

    // ---------- Chamada principal ----------
    var secondHref = isLanding ? '#destaque' : (isCat ? '#catalogo' : (hasServices ? '#servicos' : '#sobre'));
    var chips = (hasServices ? d.services : (d.mainService ? [d.mainService] : [])).slice(0, 4);
    html += '<section class="t-hero" id="topo"><div class="t-wrap t-hero__grid">' +
      '<div class="t-hero__copy">' +
        (d.tagline ? '<p class="t-eyebrow">' + esc(d.tagline) + '</p>' : '') +
        '<h1>' + esc(t.headline) + '</h1>' +
        '<p class="t-lead">' + esc(t.subheadline) + '</p>' +
        '<div class="t-actions">' +
          '<button class="t-btn t-btn--primary" type="button" data-cta>' + ICON.chat + esc(t.ctaPrimary) + '</button>' +
          '<a class="t-btn t-btn--ghost" href="' + secondHref + '">' + esc(t.ctaSecondary) + ICON.arrow + '</a>' +
        '</div>' +
      '</div>' +
      '<div class="t-hero__art" aria-hidden="true">' +
        '<div class="t-card t-card--brand">' + (d.logo ? '<img src="' + d.logo + '" alt="">' : '<span>' + esc(d.initials || 'E') + '</span>') + '</div>' +
        (chips.length ? '<ul class="t-chips">' + chips.map(function (c) { return '<li>' + ICON.check + esc(c) + '</li>'; }).join('') + '</ul>' : '') +
        '<span class="t-orb t-orb--a"></span><span class="t-orb t-orb--b"></span>' +
      '</div>' +
    '</div></section>';

    // ---------- Landing ----------
    if (isLanding) {
      html += '<section class="t-section" id="destaque"><div class="t-wrap">' +
        '<div class="t-feature">' +
          '<div class="t-feature__icon" aria-hidden="true">' + ICON.spark + '</div>' +
          '<div><p class="t-eyebrow">Em destaque</p><h2>' + esc(d.mainService || d.company) + '</h2><p>' + esc(t.about) + '</p>' +
          '<button class="t-btn t-btn--primary" type="button" data-cta>' + esc(t.ctaPrimary) + '</button></div>' +
        '</div></div></section>';
      if (t.benefits.length) {
        html += '<section class="t-section t-section--soft" id="beneficios"><div class="t-wrap">' +
          '<h2 class="t-h2">Por que escolher ' + esc(d.company) + '</h2>' +
          '<ul class="t-checks">' + t.benefits.map(function (b) { return '<li><span class="t-checks__icon">' + ICON.check + '</span>' + esc(b) + '</li>'; }).join('') + '</ul>' +
        '</div></section>';
      }
    }

    // ---------- Catálogo ----------
    if (isCat) {
      html += '<section class="t-section" id="catalogo"><div class="t-wrap">' +
        '<div class="t-head"><h2 class="t-h2">' + esc(t.catalogTitle) + '</h2><p class="t-sub">' + esc(t.catalogText) + '</p></div>';
      if (d.categories.length > 1) {
        html += '<div class="t-filters" role="group" aria-label="Filtrar por categoria">' +
          '<button type="button" class="is-on" aria-pressed="true" data-cat="">Todos</button>' +
          d.categories.map(function (c, i) { return '<button type="button" aria-pressed="false" data-cat="' + i + '">' + esc(c) + '</button>'; }).join('') +
        '</div>';
      }
      if (d.products.length) {
        html += '<ul class="t-products" aria-live="polite">' + d.products.map(function (p) {
          var ci = d.categories.indexOf(p.category);
          return '<li class="t-product" data-pcat="' + (ci >= 0 ? ci : '') + '">' +
            '<div class="t-product__media">' + (p.image ? '<img src="' + p.image + '" alt="' + esc(p.name) + '" loading="lazy">' : '<span class="t-product__ph" aria-hidden="true">' + esc(p.name.charAt(0).toUpperCase()) + '</span>') + '</div>' +
            '<div class="t-product__body">' +
              (p.category ? '<span class="t-tag">' + esc(p.category) + '</span>' : '') +
              '<h3>' + esc(p.name) + '</h3>' +
              (p.description ? '<p>' + esc(p.description) + '</p>' : '') +
              '<button class="t-btn t-btn--soft" type="button" data-cta>Pedir orçamento</button>' +
            '</div></li>';
        }).join('') + '</ul>';
      } else {
        html += '<p class="t-empty">Os produtos aparecem aqui.</p>';
      }
      html += '</div></section>';
    }

    // ---------- Institucional e catálogo ----------
    if (!isLanding) {
      if (hasServices) {
        html += '<section class="t-section' + (isCat ? ' t-section--soft' : '') + '" id="servicos"><div class="t-wrap">' +
          '<div class="t-head"><h2 class="t-h2">Serviços</h2></div>' +
          '<ol class="t-services">' + d.services.map(function (s, i) {
            return '<li><span class="t-services__n">' + (i < 9 ? '0' : '') + (i + 1) + '</span><h3>' + esc(s) + '</h3></li>';
          }).join('') + '</ol></div></section>';
      }
      if (t.diferenciais.length) {
        html += '<section class="t-section' + (isCat ? '' : ' t-section--soft') + '"><div class="t-wrap">' +
          '<div class="t-head"><h2 class="t-h2">Diferenciais</h2></div>' +
          '<ul class="t-diffs">' + t.diferenciais.map(function (x) { return '<li><span class="t-checks__icon">' + ICON.check + '</span><p>' + esc(x) + '</p></li>'; }).join('') + '</ul>' +
        '</div></section>';
      }
      html += '<section class="t-section" id="sobre"><div class="t-wrap t-about">' +
        '<h2 class="t-h2">Sobre a empresa</h2>' +
        '<div class="t-about__text">' + esc(t.about).split(/\n+/).map(function (p) { return '<p>' + p + '</p>'; }).join('') + '</div>' +
      '</div></section>';
    }

    // ---------- Contato ----------
    html += '<section class="t-final" id="contato"><div class="t-wrap t-final__in">' +
      '<div><h2>' + esc(t.contactTitle) + '</h2><p>' + esc(t.contactText) + '</p></div>' +
      '<div class="t-actions">' +
        '<button class="t-btn t-btn--light" type="button" data-cta>' + ICON.chat + esc(t.ctaPrimary) + '</button>' +
      '</div>' +
    '</div></section>';

    html += '<footer class="t-footer"><div class="t-wrap t-footer__in">' +
      '<span class="t-brand">' + brand + '<span class="t-brand__name">' + esc(d.company) + '</span></span>' +
      (d.tagline ? '<span class="t-footer__tag">' + esc(d.tagline) + '</span>' : '') +
    '</div></footer>';

    el.innerHTML = html;

    // Filtro de categorias do catálogo
    var filters = el.querySelector('.t-filters');
    if (filters) {
      filters.addEventListener('click', function (e) {
        var b = e.target.closest('[data-cat]');
        if (!b) return;
        var cat = b.getAttribute('data-cat');
        Array.prototype.forEach.call(filters.querySelectorAll('button'), function (x) {
          var on = x === b;
          x.classList.toggle('is-on', on);
          x.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
        Array.prototype.forEach.call(el.querySelectorAll('.t-product'), function (p) {
          p.hidden = cat !== '' && p.getAttribute('data-pcat') !== cat;
        });
      });
    }
  }

  window.CRON_MODELO.register('_base', { defaults: defaults, render: render });
})();
