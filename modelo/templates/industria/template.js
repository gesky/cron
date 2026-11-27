// Cron Web Studio · Template de nicho "industria"
// Para indústrias de máquinas, equipamentos e implementos de pequeno e médio porte.
// Três formatos: catálogo (principal), institucional e landing. A ação é sempre pedir orçamento.
//
// Como os campos da prévia são usados aqui (sem campo novo no banco):
//   mainService           linha principal de produtos ({servicoPrincipal})
//   services              aplicações e segmentos atendidos ({servicos}), seção "Aplicações"
//   products + categories linha de produtos por categoria
//   products[].description ficha técnica curta: até 4 linhas "Rótulo: valor" viram lista de
//                         especificações; qualquer outra coisa vira parágrafo
//   texts.diferenciais    diferenciais de fabricação
//   texts.benefits        passos de "Como pedir orçamento"
//
// Textos padrão: sem travessão, sem emoji, sem cidade, sem número, sem preço e sem dado inventado.
// Tudo que vem do banco passa por h.esc; imagens já chegam conferidas pelo modelo.js.
// Sem style="" nem on...= no HTML (a CSP da página não deixa).

(function () {
  'use strict';

  var steps = [
    'Escolha o modelo ou descreva a sua aplicação',
    'Envie os dados pelo formulário ou pelo WhatsApp',
    'A equipe analisa e retorna com a proposta'
  ];
  var diffs = [
    'Ajuda técnica para escolher o modelo certo',
    'Orçamento conforme a sua aplicação',
    'Informações técnicas claras de cada modelo',
    'Atendimento direto com quem fabrica'
  ];
  var catalog = {
    catalogTitle: 'Linha de produtos',
    catalogText: 'Filtre por categoria, veja as informações técnicas de cada modelo e peça o orçamento direto do card.'
  };

  var defaults = {
    catalogo: {
      headline: 'Conheça a linha de {servicoPrincipal} da {empresa}',
      subheadline: 'Veja os modelos por categoria, confira as informações técnicas e peça um orçamento direto com quem fabrica.',
      about: 'A {empresa} fabrica {servicoPrincipal} e atende cada pedido de perto. Antes do orçamento, a equipe entende a aplicação, indica o modelo mais adequado e explica as opções disponíveis.',
      benefits: steps,
      diferenciais: diffs,
      ctaPrimary: 'Pedir orçamento',
      ctaSecondary: 'Ver produtos',
      contactTitle: 'Peça um orçamento',
      contactText: 'Conte qual modelo interessa ou descreva a aplicação. A {empresa} retorna com as informações e a proposta.',
      catalogTitle: catalog.catalogTitle,
      catalogText: catalog.catalogText
    },
    institucional: {
      headline: 'Fabricação de {servicoPrincipal} com atendimento direto',
      subheadline: 'A {empresa} ajuda a escolher o equipamento certo para cada aplicação e prepara o orçamento conforme a sua necessidade.',
      about: 'A {empresa} fabrica {servicoPrincipal}. Cada pedido começa entendendo a aplicação: o que vai ser produzido, em que volume e em que condições. A partir daí, a equipe indica o modelo mais adequado e prepara um orçamento claro.',
      benefits: steps,
      diferenciais: diffs,
      ctaPrimary: 'Pedir orçamento',
      ctaSecondary: 'Conhecer a empresa',
      contactTitle: 'Peça um orçamento para a {empresa}',
      contactText: 'Conte qual é a sua aplicação. A equipe indica o modelo e retorna com a proposta.',
      catalogTitle: catalog.catalogTitle,
      catalogText: catalog.catalogText
    },
    landing: {
      headline: 'Orçamento de {servicoPrincipal} direto com quem fabrica',
      subheadline: 'Conte a sua aplicação e receba da {empresa} a indicação do modelo certo e uma proposta.',
      about: 'A {empresa} fabrica {servicoPrincipal} e atende cada cliente de perto. A equipe entende a aplicação, indica o modelo mais adequado e prepara um orçamento claro.',
      benefits: steps,
      diferenciais: diffs,
      ctaPrimary: 'Pedir orçamento',
      ctaSecondary: 'Ver a linha principal',
      contactTitle: 'Peça o seu orçamento',
      contactText: 'Preencha os dados ou chame no WhatsApp. A {empresa} retorna com a proposta.',
      catalogTitle: catalog.catalogTitle,
      catalogText: catalog.catalogText
    }
  };

  // services são aplicações, não a linha de produtos: não servem de {servicoPrincipal}
  var options = { mainFromServices: false, mainFallback: 'máquinas e equipamentos', lowerMain: true };

  var ICON = {
    arrow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    down: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M6 13l6 6 6-6"/></svg>',
    chat: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20l1.3-3.9A8 8 0 1 1 8 18.8L4 20Z"/></svg>',
    send: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12l16-8-6 16-2.5-6.5L4 12Z"/></svg>',
    gear: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3.2"/><path d="M12 2.8v2.6M12 18.6v2.6M21.2 12h-2.6M5.4 12H2.8M18.5 5.5l-1.8 1.8M7.3 16.7l-1.8 1.8M18.5 18.5l-1.8-1.8M7.3 7.3 5.5 5.5"/><circle cx="12" cy="12" r="6.2"/></svg>',
    factory: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 20V10l5 3V10l5 3V6h3l1 4h4v10H3Z"/><path d="M7 16h2M11 16h2M15 16h2"/></svg>',
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7"/></svg>',
    target: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>'
  };

  // Ficha técnica curta: 1 a 4 linhas "Rótulo: valor" viram especificações; senão, parágrafo
  function specs(desc) {
    var lines = String(desc || '').split(/\r?\n/).map(function (x) { return x.trim(); }).filter(Boolean);
    if (!lines.length) return null;
    if (lines.length > 4) return { text: lines };
    var rows = [];
    for (var i = 0; i < lines.length; i++) {
      var m = /^([^:]{1,40}):\s*(\S.*)$/.exec(lines[i]);
      if (!m) return { text: lines };
      rows.push([m[1].trim(), m[2].trim()]);
    }
    return { rows: rows };
  }

  function render(d, el, h) {
    var esc = h.esc;
    var t = d.texts;
    var isCat = d.format === 'catalogo', isLanding = d.format === 'landing', isInst = d.format === 'institucional';
    var hasApps = d.services.length > 0;
    var hasDiffs = t.diferenciais.length > 0;
    var hasSteps = !isLanding && t.benefits.length > 0;
    // landing sempre tem o destaque (é onde fica o texto sobre); institucional, só com a linha
    var hasLine = isLanding || (isInst && !!d.mainService);
    var products = isCat ? d.products : [];
    var mono = esc(d.initials || 'E');

    function brand(cls) {
      return d.logo
        ? '<img class="ti-brand__logo' + (cls || '') + '" src="' + d.logo + '" alt="Logo da ' + esc(d.company) + '">'
        : '<span class="ti-brand__mono" aria-hidden="true">' + mono + '</span>';
    }
    function head(eyebrow, title, text, id) {
      return '<div class="ti-head">' +
        (eyebrow ? '<p class="ti-eyebrow">' + esc(eyebrow) + '</p>' : '') +
        '<h2' + (id ? ' id="' + id + '"' : '') + '>' + esc(title) + '</h2>' +
        (text ? '<p class="ti-sub">' + esc(text) + '</p>' : '') +
      '</div>';
    }

    // ---------- Navegação ----------
    var nav = [];
    if (isCat) nav.push(['#produtos', 'Produtos']);
    if (hasLine) nav.push(['#linha', d.mainService ? 'Linha principal' : 'A empresa']);
    if (hasApps) nav.push(['#aplicacoes', 'Aplicações']);
    if (hasDiffs) nav.push(['#diferenciais', 'Diferenciais']);
    if (isInst) nav.push(['#sobre', 'Sobre']);
    nav.push(['#orcamento', 'Orçamento']);

    var html = '';
    html += '<header class="ti-header"><div class="ti-wrap ti-header__in">' +
      '<a class="ti-brand" href="#topo">' + brand() + '<span class="ti-brand__name">' + esc(d.company) + '</span></a>' +
      '<nav class="ti-nav" aria-label="Seções">' + nav.map(function (n) { return '<a href="' + n[0] + '">' + n[1] + '</a>'; }).join('') + '</nav>' +
      '<a class="ti-btn ti-btn--primary ti-btn--sm" href="#orcamento">' + esc(t.ctaPrimary) + '</a>' +
    '</div></header>';

    // ---------- Chamada principal ----------
    var heroImg = '';
    if (isCat) products.some(function (p) { if (p.image) { heroImg = p.image; return true; } return false; });
    var visual;
    if (heroImg) {
      visual = '<figure class="ti-visual ti-visual--photo"><img src="' + heroImg + '" alt="">' +
        (d.logo ? '<span class="ti-visual__badge"><img src="' + d.logo + '" alt=""></span>' : '') + '</figure>';
    } else if (d.logo) {
      visual = '<figure class="ti-visual ti-visual--logo"><img src="' + d.logo + '" alt=""></figure>';
    } else {
      visual = '<figure class="ti-visual ti-visual--mono"><span>' + mono + '</span></figure>';
    }
    var heroTags = (isCat ? d.categories : d.services).slice(0, 4);
    var secondHref = isCat ? '#produtos' : (isLanding ? '#linha' : '#sobre');
    html += '<section class="ti-hero" id="topo"><div class="ti-wrap ti-hero__grid">' +
      '<div class="ti-hero__copy">' +
        (d.tagline ? '<p class="ti-eyebrow">' + esc(d.tagline) + '</p>' : '') +
        '<h1>' + esc(t.headline) + '</h1>' +
        '<p class="ti-lead">' + esc(t.subheadline) + '</p>' +
        '<div class="ti-actions">' +
          '<a class="ti-btn ti-btn--primary" href="#orcamento">' + esc(t.ctaPrimary) + ICON.arrow + '</a>' +
          '<a class="ti-btn ti-btn--ghost" href="' + secondHref + '">' + esc(t.ctaSecondary) + ICON.down + '</a>' +
        '</div>' +
        (heroTags.length ? '<ul class="ti-hero__tags" aria-label="' + (isCat ? 'Categorias' : 'Aplicações') + '">' + heroTags.map(function (c) { return '<li>' + esc(c) + '</li>'; }).join('') + '</ul>' : '') +
      '</div>' +
      '<div class="ti-hero__art" aria-hidden="true">' + visual +
        (d.mainService ? '<p class="ti-plate"><span>Linha principal</span><strong>' + esc(d.mainService) + '</strong></p>' : '') +
      '</div>' +
    '</div></section>';

    // ---------- Linha principal (institucional e landing) ----------
    if (hasLine) {
      html += '<section class="ti-section ti-section--line" id="linha"><div class="ti-wrap">' +
        '<div class="ti-line">' +
          '<span class="ti-line__icon" aria-hidden="true">' + ICON.factory + '</span>' +
          '<div class="ti-line__copy"><p class="ti-eyebrow">' + (d.mainService ? 'Linha principal' : 'A empresa') + '</p><h2>' + esc(d.mainService || d.company) + '</h2>' +
          (isLanding ? '<div class="ti-prose">' + paragraphs(t.about) + '</div>' : '') + '</div>' +
          (isLanding ? '<a class="ti-btn ti-btn--primary" href="#orcamento">' + esc(t.ctaPrimary) + ICON.arrow + '</a>' : '') +
        '</div></div></section>';
    }

    // ---------- Linha de produtos (catálogo) ----------
    if (isCat) {
      var groups = [];
      d.categories.forEach(function (c, i) {
        var items = products.filter(function (p) { return p.category === c; });
        if (items.length) groups.push({ key: String(i), title: c, items: items });
      });
      var others = products.filter(function (p) { return !p.category || d.categories.indexOf(p.category) === -1; });
      if (others.length) groups.push({ key: 'o', title: 'Outros produtos', items: others });
      var showTitles = groups.length > 1 || (groups.length === 1 && groups[0].key !== 'o');
      var useFilter = groups.length > 1;
      var nameTag = showTitles ? 'h4' : 'h3';

      html += '<section class="ti-section" id="produtos"><div class="ti-wrap">' + head('Catálogo', t.catalogTitle, t.catalogText);
      if (useFilter) {
        html += '<div class="ti-filters" role="group" aria-label="Filtrar por categoria">' +
          '<button type="button" class="is-on" aria-pressed="true" data-ti-cat="">Todos</button>' +
          groups.map(function (g) { return '<button type="button" aria-pressed="false" data-ti-cat="' + g.key + '">' + esc(g.title) + '</button>'; }).join('') +
        '</div>';
      }
      if (products.length) {
        var single = products.length === 1;
        html += '<div class="ti-groups" aria-live="polite">' + groups.map(function (g) {
          var span = single ? ' ti-group--one' : ' ti-group--s' + Math.min(g.items.length, 4);
          return '<div class="ti-group' + span + '" data-ti-group="' + g.key + '">' +
            (showTitles ? '<h3 class="ti-group__title">' + esc(g.title) + '<span>' + g.items.length + (g.items.length === 1 ? ' modelo' : ' modelos') + '</span></h3>' : '') +
            '<ul class="ti-grid' + (single ? ' ti-grid--one' : '') + '">' + g.items.map(function (p) {
              var pi = products.indexOf(p);
              var sp = specs(p.description);
              var body = '';
              if (sp && sp.rows) body = '<dl class="ti-spec">' + sp.rows.map(function (r) { return '<div><dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd></div>'; }).join('') + '</dl>';
              else if (sp) body = '<p class="ti-card__text">' + sp.text.map(esc).join('<br>') + '</p>';
              return '<li class="ti-card">' +
                '<div class="ti-card__media">' + (p.image
                  ? '<img src="' + p.image + '" alt="' + esc(p.name) + '" loading="lazy" decoding="async">'
                  : '<span class="ti-ph" aria-hidden="true">' + ICON.gear + '<b>' + esc(p.name.charAt(0).toUpperCase()) + '</b></span>') + '</div>' +
                '<div class="ti-card__body">' +
                  (p.category ? '<span class="ti-tag">' + esc(p.category) + '</span>' : '') +
                  '<' + nameTag + ' class="ti-card__name">' + esc(p.name) + '</' + nameTag + '>' + body +
                  '<button class="ti-btn ti-btn--soft" type="button" data-cta data-ti-quote="' + pi + '">Pedir orçamento deste modelo</button>' +
                '</div></li>';
            }).join('') + '</ul></div>';
        }).join('') + '</div>';
      } else {
        html += '<p class="ti-empty">Os modelos aparecem aqui.</p>';
      }
      html += '</div></section>';
    }

    // ---------- Aplicações ----------
    if (hasApps) {
      html += '<section class="ti-section ti-section--soft" id="aplicacoes"><div class="ti-wrap">' +
        head('Onde os equipamentos trabalham', 'Aplicações e segmentos atendidos', '') +
        '<ul class="ti-apps">' + d.services.map(function (s) {
          return '<li><span class="ti-apps__icon" aria-hidden="true">' + ICON.target + '</span><span>' + esc(s) + '</span></li>';
        }).join('') + '</ul></div></section>';
    }

    // ---------- Diferenciais de fabricação ----------
    if (hasDiffs) {
      html += '<section class="ti-section' + (hasApps ? '' : ' ti-section--soft') + '" id="diferenciais"><div class="ti-wrap">' +
        head('Por que pedir aqui', 'Diferenciais de fabricação', '') +
        '<ul class="ti-diffs">' + t.diferenciais.map(function (x, i) {
          return '<li><span class="ti-diffs__n" aria-hidden="true">' + (i < 9 ? '0' : '') + (i + 1) + '</span><p>' + esc(x) + '</p></li>';
        }).join('') + '</ul></div></section>';
    }

    // ---------- Sobre (institucional antes dos passos; catálogo depois) ----------
    var about = !isLanding ? '<section class="ti-section ti-section--about" id="sobre"><div class="ti-wrap ti-about">' +
      '<div><p class="ti-eyebrow">A empresa</p><h2>Sobre a ' + esc(d.company) + '</h2></div>' +
      '<div class="ti-prose">' + paragraphs(t.about) + '</div>' +
    '</div></section>' : '';
    var stepsHtml = hasSteps ? '<section class="ti-section ti-section--soft" id="como"><div class="ti-wrap">' +
      head('Passo a passo', 'Como pedir orçamento', '') +
      '<ol class="ti-steps">' + t.benefits.map(function (x, i) {
        return '<li><span class="ti-steps__n" aria-hidden="true">' + (i + 1) + '</span><p>' + esc(x) + '</p></li>';
      }).join('') + '</ol></div></section>' : '';
    html += isInst ? about + stepsHtml : stepsHtml + about;

    // ---------- Pedido de orçamento (formulário só visual) ----------
    var interest = isCat && products.length
      ? '<select id="ti-f-prod" name="produto"><option value="">Selecione um modelo</option>' +
          products.map(function (p, i) { return '<option value="' + i + '">' + esc(p.name) + '</option>'; }).join('') +
          '<option value="outro">Outro ou ainda não sei</option></select>'
      : '<input id="ti-f-prod" name="produto" type="text" maxlength="120" autocomplete="off" placeholder="' + esc(d.mainService || 'Modelo ou aplicação') + '">';
    html += '<section class="ti-quote" id="orcamento"><div class="ti-wrap ti-quote__in">' +
      '<div class="ti-quote__copy">' +
        '<p class="ti-eyebrow">Orçamento</p>' +
        '<h2>' + esc(t.contactTitle) + '</h2>' +
        '<p>' + esc(t.contactText) + '</p>' +
        '<button class="ti-btn ti-btn--light" type="button" data-cta>' + ICON.chat + 'Falar no WhatsApp</button>' +
      '</div>' +
      '<form class="ti-form" novalidate aria-label="Pedido de orçamento">' +
        '<div class="ti-form__row">' +
          '<label class="ti-field" for="ti-f-nome"><span>Nome</span><input id="ti-f-nome" name="nome" type="text" maxlength="80" autocomplete="name"></label>' +
          '<label class="ti-field" for="ti-f-empresa"><span>Empresa</span><input id="ti-f-empresa" name="empresa" type="text" maxlength="120" autocomplete="organization"></label>' +
        '</div>' +
        '<label class="ti-field" for="ti-f-tel"><span>Telefone ou WhatsApp</span><input id="ti-f-tel" name="telefone" type="tel" maxlength="20" autocomplete="tel" inputmode="tel"></label>' +
        '<label class="ti-field" for="ti-f-prod"><span>' + (isCat ? 'Produto de interesse' : 'Produto ou aplicação de interesse') + '</span>' + interest + '</label>' +
        '<label class="ti-field" for="ti-f-msg"><span>Mensagem</span><textarea id="ti-f-msg" name="mensagem" rows="4" maxlength="600"></textarea></label>' +
        '<button class="ti-btn ti-btn--primary ti-btn--block" type="submit" data-cta>' + ICON.send + 'Enviar pedido de orçamento</button>' +
        '<p class="ti-form__note">Rascunho: este formulário ainda não envia nada.</p>' +
      '</form>' +
    '</div></section>';

    // ---------- Rodapé ----------
    html += '<footer class="ti-footer"><div class="ti-wrap ti-footer__in">' +
      '<span class="ti-brand">' + brand() + '<span class="ti-brand__name">' + esc(d.company) + '</span></span>' +
      (d.tagline ? '<span class="ti-footer__tag">' + esc(d.tagline) + '</span>' : '') +
    '</div></footer>';

    el.innerHTML = html;
    document.body.classList.add('ti-page');

    // Filtro por categoria: em "Todos", os grupos aparecem com o título; numa categoria, só ela
    var filters = el.querySelector('.ti-filters');
    if (filters) {
      filters.addEventListener('click', function (e) {
        var b = e.target.closest('[data-ti-cat]');
        if (!b) return;
        var key = b.getAttribute('data-ti-cat');
        Array.prototype.forEach.call(filters.querySelectorAll('button'), function (x) {
          var on = x === b;
          x.classList.toggle('is-on', on);
          x.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
        Array.prototype.forEach.call(el.querySelectorAll('.ti-group'), function (g) {
          g.hidden = key !== '' && g.getAttribute('data-ti-group') !== key;
        });
      });
    }

    // "Pedir orçamento deste modelo": marca o modelo no formulário e rola até ele.
    // O aviso de rascunho vem do modelo.js (data-cta). Nada é enviado.
    var form = el.querySelector('.ti-form');
    el.addEventListener('click', function (e) {
      var q = e.target.closest('[data-ti-quote]');
      if (!q || !form) return;
      var sel = form.querySelector('select');
      if (sel) sel.value = q.getAttribute('data-ti-quote');
      var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      document.getElementById('orcamento').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
      if (sel) setTimeout(function () { try { sel.focus({ preventScroll: true }); } catch (err) { sel.focus(); } }, reduce ? 0 : 450);
    });
    if (form) form.addEventListener('submit', function (e) { e.preventDefault(); });

    function paragraphs(text) {
      return esc(text).split(/\n+/).filter(function (p) { return p.trim(); }).map(function (p) { return '<p>' + p + '</p>'; }).join('');
    }
  }

  window.CRON_MODELO.register('industria', { defaults: defaults, options: options, render: render });
})();
