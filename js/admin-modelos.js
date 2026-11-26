// Cron Web Studio · Sites modelo no painel (qualificação, marca, kit e prévias)
// Um painel "Qualificação e prévia" que aparece na gaveta do lead (CRM) e numa gaveta própria
// (aberta a partir da Prospecção), mais um bloco compacto para os cartões da Prospecção.
// Expõe CRON_ADMIN.previews para o CRM e a Prospecção usarem sem duplicar código.
// Nada é enviado: a prévia só ganha link; quem manda é o Pedro.

(function () {
  'use strict';

  var A = window.CRON_ADMIN;
  if (!A || !A.api) return;

  var api = A.api, $ = A.$, $$ = A.$$, esc = A.esc, toDate = A.toDate, fmtDate = A.fmtDate,
    toast = A.toast, confirmBox = A.confirmBox, promptBox = A.promptBox;

  var SITE = 'https://cronwebstudio.com.br';
  var ALLOWED = window.CRON_MODELO_TEMPLATES || ['_base'];
  var DEFS = (window.CRON_MODELO && window.CRON_MODELO.defs) || {};
  var FORMATS = { landing: 'Landing', institucional: 'Institucional', catalogo: 'Catálogo' };
  var QUAL = { qualificado: 'Qualificado', desqualificado: 'Desqualificado', '': 'Sem avaliação' };
  var HEX = /^#[0-9a-fA-F]{6}$/;
  var IMG = /^data:image\/(webp|png|jpeg);base64,.+/;
  var KIT_WARN = 800 * 1024, PREVIEW_MAX = 950000;
  var TEXT_FIELDS = [
    ['headline', 'Chamada principal', 120], ['subheadline', 'Texto de apoio da chamada', 240], ['about', 'Sobre', 900],
    ['ctaPrimary', 'Botão principal', 40], ['ctaSecondary', 'Botão secundário', 40],
    ['contactTitle', 'Título do contato', 80], ['contactText', 'Texto do contato', 240],
    ['catalogTitle', 'Título do catálogo', 80], ['catalogText', 'Texto do catálogo', 240]
  ];

  // ---------- Estado ----------
  var leads = [];
  var kits = {};        // leadId -> { loaded, data, draft, dirty }
  var plists = {};      // leadId -> lista de prévias (carregada sob demanda)
  var mounts = [];      // [{ el, leadId, dirty }]
  A.onLeads(function (list) { leads = list; mounts.forEach(function (m) { if (m.el.isConnected) renderPanel(m); }); });

  function lead(id) { return leads.find(function (l) { return l.id === id; }); }
  function slugOk(v) { return /^[a-z0-9-]{2,60}$/.test(v || ''); }
  // Endereço completo para mandar ao cliente (no demo, o endereço local da página)
  function absUrl(id) {
    return A.demo ? location.href.replace(/admin\.html.*$/, '') + 'modelo/?demo=' + id : SITE + '/modelo/?id=' + id;
  }
  function previewUrl(id, absolute) {
    if (A.demo) return 'modelo/?demo=' + id;
    return (absolute ? SITE + '/' : '') + 'modelo/?id=' + id;
  }
  function saveErr(err) {
    console.error(err);
    toast(err && err.code === 'permission-denied'
      ? 'O banco recusou a gravação. Confira se as regras novas foram publicadas.'
      : 'Não foi possível salvar. Tente de novo.', true);
  }
  function copy(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise(function (resolve, reject) {
      var ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy') ? resolve() : reject(); } catch (e) { reject(e); }
      ta.remove();
    });
  }
  function kb(n) { return n < 1024 ? n + ' B' : Math.round(n / 1024) + ' KB'; }

  // Por que não dá para gerar (ou '' se dá)
  function blockReason(l) {
    if (l.qualification !== 'qualificado') return 'Marque o lead como qualificado para gerar o site modelo.';
    if (!FORMATS[l.format]) return 'Escolha o formato (landing, institucional ou catálogo).';
    if (!l.company || l.company.trim().length < 2) return 'Preencha o nome da empresa.';
    return '';
  }

  // Troca {link} pelo endereço da prévia (usado pelo CRM ao copiar e abrir o WhatsApp)
  function resolveLink(text, previewId) {
    if (!text) return '';
    if (!previewId || !/^[A-Za-z0-9]{1,40}$/.test(previewId)) return text.replace(/\s*\{link\}/g, '');
    return text.replace(/\{link\}/g, absUrl(previewId));
  }

  // ---------- Pedaços de HTML ----------
  function segQual(l) {
    var q = l.qualification || '';
    return '<div class="seg seg--sm mp-seg" role="group" aria-label="Qualificação">' +
      ['qualificado', 'desqualificado', ''].map(function (k) {
        return '<button type="button" class="mp-q mp-q--' + (k || 'none') + (q === k ? ' is-active' : '') + '" aria-pressed="' + (q === k) + '" data-mp="qual" data-lead="' + esc(l.id) + '" data-val="' + k + '">' + QUAL[k] + '</button>';
      }).join('') + '</div>';
  }
  function segFormat(l) {
    return '<div class="seg seg--sm mp-seg" role="group" aria-label="Formato do site modelo">' +
      Object.keys(FORMATS).map(function (k) {
        return '<button type="button"' + (l.format === k ? ' class="is-active"' : '') + ' aria-pressed="' + (l.format === k) + '" data-mp="format" data-lead="' + esc(l.id) + '" data-val="' + k + '">' + FORMATS[k] + '</button>';
      }).join('') + '</div>';
  }
  function qualBadge(l) {
    if (l.qualification === 'qualificado') return '<span class="mp-badge mp-badge--ok">Qualificado</span>';
    if (l.qualification === 'desqualificado') return '<span class="mp-badge mp-badge--no">Desqualificado</span>';
    return '';
  }
  function dots(b) {
    b = b || {};
    var a = HEX.test(b.primaryColor || '') ? b.primaryColor : '', c = HEX.test(b.secondaryColor || '') ? b.secondaryColor : '';
    if (!a && !c) return '';
    return '<span class="mp-dots" aria-label="Cores da marca">' + [a, c].filter(Boolean).map(function (x) {
      return '<i data-color="' + x + '" title="' + x + '"></i>';
    }).join('') + '</span>';
  }
  // Pinta as bolinhas de cor sem style="" no HTML (CSSOM)
  function paintDots(root) {
    $$('.mp-dots i[data-color]', root).forEach(function (i) {
      var c = i.getAttribute('data-color');
      if (HEX.test(c)) i.style.background = c;
    });
  }

  // Controles da prévia (botões). ctx: 'card' (compacto) ou 'panel'
  function controlsHtml(l, ctx) {
    var why = blockReason(l), id = 'mpwhy-' + esc(l.id) + '-' + ctx;
    var has = l.previewId && /^[A-Za-z0-9]{1,40}$/.test(l.previewId);
    var html = '<div class="mp-controls">';
    if (has) {
      html += '<a class="btn btn--ghost" href="' + esc(previewUrl(l.previewId)) + '" target="_blank" rel="noopener">Abrir prévia</a>' +
        '<button class="btn btn--ghost" type="button" data-mp="copy" data-lead="' + esc(l.id) + '">Copiar link</button>' +
        '<button class="btn btn--ghost" type="button" data-mp="edit" data-lead="' + esc(l.id) + '">Editar prévia</button>' +
        '<button class="btn-text" type="button" data-mp="generate" data-lead="' + esc(l.id) + '"' + (why ? ' disabled aria-describedby="' + id + '"' : '') + '>Gerar de novo</button>';
    } else {
      html += '<button class="btn btn--lime" type="button" data-mp="generate" data-lead="' + esc(l.id) + '"' + (why ? ' disabled aria-describedby="' + id + '"' : '') + '>Gerar site modelo</button>';
    }
    if (ctx === 'card') html += '<button class="btn-text" type="button" data-mp="open" data-lead="' + esc(l.id) + '">Marca e kit</button>';
    html += '</div>';
    if (why) html += '<p class="mp-why" id="' + id + '">' + esc(why) + '</p>';
    return html;
  }

  // Bloco para os cartões da Prospecção e da fila: qualificação, formato e prévia
  function cardHtml(l) {
    var b = l.brand || {};
    return '<div class="mp-card">' +
      '<div class="mp-row"><span class="mp-label">Qualificação</span>' + segQual(l) + '</div>' +
      (l.qualification === 'desqualificado' && l.disqualifyReason ? '<p class="mp-reason"><strong>Motivo:</strong> ' + esc(l.disqualifyReason) + '</p>' : '') +
      (l.qualification !== 'desqualificado'
        ? '<div class="mp-row"><span class="mp-label">Formato</span>' + segFormat(l) + '</div>' +
          '<label class="f mp-freason"><span class="sr-only">Motivo do formato</span><input data-mp-input="formatReason" data-lead="' + esc(l.id) + '" maxlength="300" value="' + esc(l.formatReason || '') + '" placeholder="Por que esse formato"></label>' +
          '<div class="mp-site"><div class="mp-site__head"><strong>Site modelo</strong>' +
            (l.format ? '<span class="chip">' + FORMATS[l.format] + '</span>' : '') + dots(b) + '</div>' +
            controlsHtml(l, 'card') + '</div>'
        : '') +
    '</div>';
  }

  // ---------- Painel completo (gaveta do lead e gaveta própria) ----------
  function mount(el, leadId) {
    var m = mounts.find(function (x) { return x.el === el; });
    if (!m) { m = { el: el, leadId: leadId, dirty: false }; mounts.push(m); bindPanel(m); }
    if (m.leadId !== leadId) { m.leadId = leadId; m.dirty = false; }
    renderPanel(m, true);
  }

  function ensureKit(id) {
    if (kits[id] && kits[id].loaded) return Promise.resolve(kits[id]);
    kits[id] = kits[id] || { loaded: false };
    if (kits[id].loading) return kits[id].loading;
    kits[id].loading = api.getKit(id).then(function (d) {
      var data = d || {};
      kits[id] = { loaded: true, data: data, draft: { logo: data.logo || '', products: (data.products || []).map(function (p) { return Object.assign({}, p); }), categories: (data.categories || []).slice() }, dirty: false };
      return kits[id];
    }).catch(function (err) { console.error(err); kits[id] = { loaded: true, data: {}, draft: { logo: '', products: [], categories: [] }, dirty: false, error: true }; return kits[id]; });
    return kits[id].loading;
  }
  function loadPreviews(id, force) {
    if (plists[id] && !force) return Promise.resolve(plists[id]);
    return api.listPreviews(id).then(function (list) { plists[id] = list; return list; }).catch(function (err) { console.error(err); plists[id] = []; return []; });
  }

  function typingIn(el) {
    var a = document.activeElement;
    return a && el.contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && a.type !== 'file';
  }

  function renderPanel(m, force) {
    var l = lead(m.leadId);
    if (!l) { m.el.innerHTML = ''; return; }
    if (!force && (m.dirty || typingIn(m.el))) return;
    var b = l.brand || {};
    var html = '<div class="mp-panel">';
    html += '<div class="mp-row"><span class="mp-label">Qualificação</span>' + segQual(l) + '</div>';
    if (l.qualification === 'desqualificado') {
      html += '<p class="mp-reason"><strong>Motivo:</strong> ' + esc(l.disqualifyReason || 'sem motivo') + ' <button class="btn-text" type="button" data-mp="reason" data-lead="' + esc(l.id) + '">Editar motivo</button></p>';
    }
    html += '<div class="mp-row"><span class="mp-label">Formato</span>' + segFormat(l) + '</div>' +
      '<label class="f"><span>Por que esse formato</span><input data-mp-field="formatReason" maxlength="300" value="' + esc(l.formatReason || '') + '"></label>';

    // Marca
    html += '<fieldset class="ld-group mp-brand"><legend>Marca</legend><div class="ld-grid">' +
      colorField('primaryColor', 'Cor principal', b.primaryColor) + colorField('secondaryColor', 'Cor secundária', b.secondaryColor) +
      '<label class="f f--full"><span>Slogan</span><input data-mp-field="tagline" maxlength="120" value="' + esc(b.tagline || '') + '"></label>' +
      '<label class="f f--full"><span>Serviço principal</span><input data-mp-field="mainService" maxlength="80" value="' + esc(b.mainService || '') + '" placeholder="Usado na landing e no texto padrão"></label>' +
      '<label class="f f--full"><span>Serviços (um por linha, até 8)</span><textarea data-mp-field="services" rows="4">' + esc((b.services || []).join('\n')) + '</textarea></label>' +
      '</div><div class="row-end"><button class="btn btn--dark" type="button" data-mp="saveBrand" data-lead="' + esc(l.id) + '">Salvar marca</button></div></fieldset>';

    // Kit
    var k = kits[l.id];
    html += '<fieldset class="ld-group mp-kit"><legend>Kit (logo e produtos)</legend>';
    if (!k || !k.loaded) {
      html += '<p class="muted">Carregando o kit…</p>';
      ensureKit(l.id).then(function () { renderPanel(m, true); });
    } else {
      var size = JSON.stringify(k.draft).length;
      html += '<div class="mp-logo">' +
        (k.draft.logo ? '<img src="' + k.draft.logo + '" alt="Logo atual">' : '<span class="mp-logo__empty">Sem logo</span>') +
        '<div class="mp-logo__actions"><label class="btn btn--ghost mp-file">Enviar logo<input type="file" accept="image/png,image/jpeg,image/webp" data-mp-file="logo" data-lead="' + esc(l.id) + '"></label>' +
        (k.draft.logo ? '<button class="btn-text" type="button" data-mp="logoRemove" data-lead="' + esc(l.id) + '">Remover</button>' : '') + '</div></div>';
      if (l.format === 'catalogo') {
        html += '<label class="f"><span>Categorias (uma por linha, até 12)</span><textarea data-mp-kit="categories" rows="3">' + esc(k.draft.categories.join('\n')) + '</textarea></label>';
        html += '<div class="mp-products">' + k.draft.products.map(function (p, i) {
          return '<div class="mp-product">' +
            '<div class="mp-product__img">' + (p.image ? '<img src="' + p.image + '" alt="">' : '<span>Sem foto</span>') +
              '<label class="mini mp-file" aria-label="Foto do produto ' + (i + 1) + '"><svg viewBox="0 0 24 24"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg><input type="file" accept="image/png,image/jpeg,image/webp" data-mp-file="product" data-idx="' + i + '" data-lead="' + esc(l.id) + '"></label></div>' +
            '<div class="mp-product__fields">' +
              '<input data-mp-prod="name" data-idx="' + i + '" maxlength="60" value="' + esc(p.name || '') + '" placeholder="Nome do produto" aria-label="Nome do produto ' + (i + 1) + '">' +
              '<input data-mp-prod="category" data-idx="' + i + '" maxlength="40" value="' + esc(p.category || '') + '" placeholder="Categoria" aria-label="Categoria do produto ' + (i + 1) + '">' +
              '<textarea data-mp-prod="description" data-idx="' + i + '" maxlength="160" rows="2" placeholder="Descrição curta" aria-label="Descrição do produto ' + (i + 1) + '">' + esc(p.description || '') + '</textarea>' +
            '</div>' +
            '<button class="mini" type="button" data-mp="prodRemove" data-idx="' + i + '" data-lead="' + esc(l.id) + '" aria-label="Remover produto ' + (i + 1) + '"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button>' +
          '</div>';
        }).join('') + '</div>' +
        (k.draft.products.length < 24 ? '<button class="btn btn--ghost" type="button" data-mp="prodAdd" data-lead="' + esc(l.id) + '">Adicionar produto</button>' : '<p class="muted">Limite de 24 produtos.</p>');
      } else {
        html += '<p class="muted mp-hint">Os produtos aparecem aqui quando o formato for Catálogo.</p>';
      }
      html += '<p class="mp-size' + (size > KIT_WARN ? ' is-warn' : '') + '" aria-live="polite">Peso do kit: ' + kb(size) + ' de 1 MB' +
        (size > KIT_WARN ? '. Está perto do limite: reduza fotos de produto ou a logo.' : '') + '</p>' +
        '<div class="row-end">' + (k.dirty ? '<span class="saved">Alterações não salvas</span>' : '') +
        '<button class="btn btn--dark" type="button" data-mp="saveKit" data-lead="' + esc(l.id) + '">Salvar kit</button></div>';
    }
    html += '</fieldset>';

    // Prévia
    html += '<fieldset class="ld-group mp-previews"><legend>Site modelo</legend>' + controlsHtml(l, 'panel');
    var pl = plists[l.id];
    if (!pl) {
      loadPreviews(l.id).then(function () { renderPanel(m, true); });
    } else if (pl.length) {
      html += '<ul class="mp-plist">' + pl.map(function (p) {
        var cur = p.id === l.previewId;
        return '<li class="' + (cur ? 'is-current' : '') + '"><div><strong>' + (FORMATS[p.format] || p.format) + (cur ? ' · atual' : '') + '</strong>' +
          '<span>' + esc(fmtDate(toDate(p.createdAt), true)) + ' · ' + (p.active ? 'ativa' : 'desativada') + '</span></div>' +
          '<div class="mp-plist__actions">' +
            '<a class="btn-text" href="' + esc(previewUrl(p.id)) + '" target="_blank" rel="noopener">Abrir</a>' +
            '<button class="btn-text" type="button" data-mp="toggle" data-pid="' + esc(p.id) + '" data-lead="' + esc(l.id) + '" data-on="' + (p.active ? '0' : '1') + '">' + (p.active ? 'Desativar' : 'Ativar') + '</button>' +
          '</div></li>';
      }).join('') + '</ul>';
    }
    html += '</fieldset></div>';
    m.el.innerHTML = html;
    paintDots(m.el);
  }

  function colorField(key, label, val) {
    var v = HEX.test(val || '') ? val : '';
    return '<label class="f mp-color"><span>' + label + '</span><span class="fld">' +
      '<input type="color" data-mp-color="' + key + '" value="' + (v || '#1e293b') + '" aria-label="' + label + ' (seletor)">' +
      '<input data-mp-field="' + key + '" maxlength="7" value="' + esc(v) + '" placeholder="#rrggbb" aria-label="' + label + ' (código)">' +
    '</span></label>';
  }

  function bindPanel(m) {
    m.el.addEventListener('input', function (e) {
      var t = e.target, k = kits[m.leadId];
      if (t.matches('[data-mp-color]')) {
        var txt = $('[data-mp-field="' + t.getAttribute('data-mp-color') + '"]', m.el);
        if (txt) txt.value = t.value;
        m.dirty = true;
        return;
      }
      if (t.matches('[data-mp-field]')) { m.dirty = true; return; }
      if (k && t.matches('[data-mp-prod]')) {
        var p = k.draft.products[Number(t.getAttribute('data-idx'))];
        if (p) { p[t.getAttribute('data-mp-prod')] = t.value; k.dirty = true; m.dirty = true; }
        return;
      }
      if (k && t.matches('[data-mp-kit="categories"]')) {
        k.draft.categories = t.value.split('\n').map(function (x) { return x.trim().slice(0, 40); }).filter(Boolean).slice(0, 12);
        k.dirty = true; m.dirty = true;
      }
    });
    m.el.addEventListener('change', function (e) {
      var t = e.target;
      if (!t.matches('[data-mp-file]') || !t.files || !t.files[0]) return;
      var k = kits[m.leadId];
      if (!k) return;
      var isLogo = t.getAttribute('data-mp-file') === 'logo';
      var idx = Number(t.getAttribute('data-idx'));
      toast('Otimizando a imagem…');
      A.toWebP(t.files[0], isLogo ? 512 : 480, isLogo ? 200000 : 30000).then(function (data) {
        if (isLogo) k.draft.logo = data; else if (k.draft.products[idx]) k.draft.products[idx].image = data;
        k.dirty = true;
        m.dirty = false;
        renderPanel(m, true);
        m.dirty = true;
        var size = JSON.stringify(k.draft).length;
        if (size > KIT_WARN) toast('O kit passou de 800 KB. Reduza fotos de produto ou a logo.', true);
      }).catch(function () { toast('Não foi possível usar essa imagem. Tente PNG ou JPG menor.', true); });
    });
    m.el.addEventListener('focusout', function () {
      setTimeout(function () { if (!m.dirty && !typingIn(m.el)) renderPanel(m); }, 150);
    });
  }

  function readBrand(m) {
    var get = function (k) { var el = $('[data-mp-field="' + k + '"]', m.el); return el ? el.value.trim() : ''; };
    var b = {
      primaryColor: get('primaryColor'), secondaryColor: get('secondaryColor'),
      tagline: get('tagline').slice(0, 120), mainService: get('mainService').slice(0, 80),
      services: get('services').split('\n').map(function (x) { return x.trim().slice(0, 60); }).filter(Boolean).slice(0, 8)
    };
    if (b.primaryColor && !HEX.test(b.primaryColor)) return { error: 'A cor principal precisa ser no formato #rrggbb.' };
    if (b.secondaryColor && !HEX.test(b.secondaryColor)) return { error: 'A cor secundária precisa ser no formato #rrggbb.' };
    return { brand: b, formatReason: get('formatReason').slice(0, 300) };
  }

  // ---------- Ações (delegação única no documento) ----------
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-mp]');
    if (!b || b.disabled) return;
    var id = b.getAttribute('data-lead'), l = lead(id);
    var act = b.getAttribute('data-mp');
    var m = mounts.find(function (x) { return x.el.contains(b); });
    if (!l) return;
    if (act === 'qual') return setQual(l, b.getAttribute('data-val'));
    if (act === 'reason') return setQual(l, 'desqualificado', true);
    if (act === 'format') return api.updateLead(l.id, { format: b.getAttribute('data-val') }).then(function () { toast('Formato: ' + FORMATS[b.getAttribute('data-val')]); }).catch(saveErr);
    if (act === 'copy') return copyLink(l);
    if (act === 'edit') return openEditor(l);
    if (act === 'generate') return generate(l, b);
    if (act === 'open') return openDrawerFor(l);
    if (act === 'toggle') {
      var on = b.getAttribute('data-on') === '1';
      return api.setPreviewActive(b.getAttribute('data-pid'), on).then(function () {
        toast(on ? 'Prévia ativada' : 'Prévia desativada');
        return loadPreviews(l.id, true);
      }).then(function () { if (m) renderPanel(m, true); }).catch(saveErr);
    }
    if (act === 'saveBrand' && m) {
      var r = readBrand(m);
      if (r.error) { toast(r.error, true); return; }
      b.disabled = true;
      return api.updateLead(l.id, { brand: r.brand, formatReason: r.formatReason }).then(function () {
        m.dirty = false;
        toast('Marca salva');
        renderPanel(m, true);
      }).catch(saveErr).then(function () { b.disabled = false; });
    }
    var k = kits[l.id];
    if (!k) return;
    if (act === 'logoRemove') { k.draft.logo = ''; k.dirty = true; if (m) { renderPanel(m, true); m.dirty = true; } return; }
    if (act === 'prodAdd') { k.draft.products.push({ name: '', description: '', category: '', image: '' }); k.dirty = true; if (m) { renderPanel(m, true); m.dirty = true; } return; }
    if (act === 'prodRemove') { k.draft.products.splice(Number(b.getAttribute('data-idx')), 1); k.dirty = true; if (m) { renderPanel(m, true); m.dirty = true; } return; }
    if (act === 'saveKit') return saveKit(l, m, b);
  });

  // Motivo do formato direto no cartão: grava ao sair do campo
  document.addEventListener('change', function (e) {
    var t = e.target;
    if (!t.matches('[data-mp-input="formatReason"]')) return;
    var l = lead(t.getAttribute('data-lead'));
    if (!l || (l.formatReason || '') === t.value.trim()) return;
    api.updateLead(l.id, { formatReason: t.value.trim().slice(0, 300) }).then(function () { toast('Motivo do formato salvo'); }).catch(saveErr);
  });

  function setQual(l, val, editOnly) {
    if (val === 'desqualificado') {
      return promptBox('Por que não qualifica?', 'O motivo fica no lead. Desqualificado não ganha site modelo.', {
        required: true, requiredMsg: 'Escreva o motivo.', placeholder: 'Ex.: já tem site novo, fora do perfil', value: l.disqualifyReason || ''
      }).then(function (reason) {
        if (reason === null) return;
        return api.updateLead(l.id, { qualification: 'desqualificado', disqualifyReason: reason.slice(0, 300) }, editOnly ? [] : [{ type: 'nota', text: 'Desqualificado: ' + reason.slice(0, 300) }])
          .then(function () { toast(editOnly ? 'Motivo salvo' : 'Marcado como desqualificado'); });
      }).catch(saveErr);
    }
    var data = { qualification: val };
    if (l.disqualifyReason) data.disqualifyReason = api.del();
    return api.updateLead(l.id, data, val === 'qualificado' ? [{ type: 'nota', text: 'Qualificado.' }] : [])
      .then(function () { toast(val ? 'Marcado como qualificado' : 'Sem avaliação'); }).catch(saveErr);
  }

  function copyLink(l) {
    if (!l.previewId) return;
    copy(absUrl(l.previewId)).then(function () { toast('Link copiado'); }, function () { toast('Não foi possível copiar.', true); });
  }

  function saveKit(l, m, btn) {
    var k = kits[l.id];
    var products = k.draft.products.map(function (p) {
      return { name: String(p.name || '').trim().slice(0, 60), description: String(p.description || '').trim().slice(0, 160), category: String(p.category || '').trim().slice(0, 40), image: IMG.test(p.image || '') ? p.image : '' };
    });
    if (products.some(function (p) { return !p.name; })) { toast('Todo produto precisa de nome.', true); return; }
    var data = { logo: IMG.test(k.draft.logo || '') ? k.draft.logo : '', products: products.slice(0, 24), categories: k.draft.categories.slice(0, 12) };
    var size = JSON.stringify(data).length;
    if (size > 1000000) { toast('O kit passou do limite de 1 MB. Remova fotos de produto ou use uma logo menor.', true); return; }
    btn.disabled = true;
    api.saveKit(l.id, data).then(function () {
      k.data = JSON.parse(JSON.stringify(data));
      k.dirty = false;
      if (m) m.dirty = false;
      toast(size > KIT_WARN ? 'Kit salvo. Atenção: está perto do limite de tamanho.' : 'Kit salvo');
      if (m) renderPanel(m, true);
    }).catch(saveErr).then(function () { btn.disabled = false; });
  }

  // ---------- Gerar a prévia ----------
  function buildPreview(l, kit) {
    var b = l.brand || {};
    var cat = l.format === 'catalogo';
    var d = {
      leadId: l.id,
      niche: slugOk(l.niche) ? l.niche : '',
      template: ALLOWED.indexOf(l.niche) !== -1 ? l.niche : '_base',
      format: l.format,
      formatReason: String(l.formatReason || '').slice(0, 300),
      companyName: String(l.company || '').trim().slice(0, 120),
      tagline: String(b.tagline || '').slice(0, 120),
      mainService: String(b.mainService || '').slice(0, 80),
      services: (b.services || []).slice(0, 8).map(function (x) { return String(x).slice(0, 60); }),
      logo: IMG.test(kit.logo || '') ? kit.logo : '',
      products: cat ? (kit.products || []).filter(function (p) { return p && p.name; }).slice(0, 24).map(function (p) {
        return { name: String(p.name).slice(0, 60), description: String(p.description || '').slice(0, 160), category: String(p.category || '').slice(0, 40), image: IMG.test(p.image || '') ? p.image : '' };
      }) : [],
      categories: cat ? (kit.categories || []).slice(0, 12) : [],
      texts: {}
    };
    if (HEX.test(b.primaryColor || '')) d.primaryColor = b.primaryColor;
    if (HEX.test(b.secondaryColor || '')) d.secondaryColor = b.secondaryColor;
    return d;
  }

  function generate(l, btn) {
    var why = blockReason(l);
    if (why) { toast(why, true); return; }
    var k0 = kits[l.id];
    if (k0 && k0.dirty) { toast('Salve o kit antes de gerar, para a prévia usar a versão nova.', true); return; }
    var ask = l.previewId
      ? confirmBox('Gerar o site modelo de novo?', 'A prévia atual é desativada (o link antigo para de abrir) e uma nova é criada com os dados de agora.', 'Gerar de novo')
      : Promise.resolve(true);
    ask.then(function (ok) {
      if (!ok) return;
      // abre a aba já no clique, para o navegador não bloquear
      var win = window.open('about:blank', '_blank');
      btn.disabled = true;
      ensureKit(l.id).then(function (k) {
        var data = buildPreview(l, k.data || {});
        if (JSON.stringify(data).length > PREVIEW_MAX) {
          throw { friendly: 'A prévia ficou grande demais. Reduza as fotos dos produtos ou use uma logo menor no kit.' };
        }
        return api.createPreview(data, l.previewId || null);
      }).then(function (pid) {
        toast('Site modelo gerado');
        plists[l.id] = null;
        if (win) { win.opener = null; win.location.href = previewUrl(pid); }
        mounts.forEach(function (m) { if (m.leadId === l.id) loadPreviews(l.id, true).then(function () { renderPanel(m, true); }); });
      }).catch(function (err) {
        if (win) win.close();
        if (err && err.friendly) toast(err.friendly, true); else saveErr(err);
      }).then(function () { btn.disabled = false; });
    });
  }

  // ---------- Gaveta própria (aberta pela Prospecção) ----------
  var mdDrawer = $('#modeloDrawer');
  function openDrawerFor(l) {
    $('#mdTitle').textContent = l.company || l.name || 'Lead';
    mount($('#mdBody'), l.id);
    A.openDrawer(mdDrawer);
  }

  // ---------- Editor da prévia ----------
  var pvDrawer = $('#previewDrawer'), pvForm = $('#previewForm'), pvCurrent = null;

  function defaultsFor(fmt) {
    var base = (DEFS._base && DEFS._base.defaults && DEFS._base.defaults[fmt]) || {};
    return base;
  }
  function fillMarkers(text, p) {
    var services = p.services || [];
    var joined = services.length > 1 ? services.slice(0, -1).join(', ') + ' e ' + services[services.length - 1] : (services[0] || '');
    return String(text || '').replace(/\{empresa\}/g, p.companyName || '').replace(/\{servicoPrincipal\}/g, p.mainService || services[0] || 'serviços sob medida')
      .replace(/\{servicos\}/g, joined || p.mainService || '').replace(/\s{2,}/g, ' ');
  }

  function openEditor(l) {
    if (!l.previewId) return;
    api.getPreview(l.previewId).then(function (p) {
      if (!p) { toast('Prévia não encontrada.', true); return; }
      pvCurrent = p;
      pvForm.reset();
      $('#pvMsg').textContent = '';
      $('#pvTitle').textContent = 'Editar prévia · ' + (p.companyName || '');
      pvForm.format.value = p.format;
      pvForm.formatReason.value = p.formatReason || '';
      pvForm.companyName.value = p.companyName || '';
      pvForm.tagline.value = p.tagline || '';
      pvForm.mainService.value = p.mainService || '';
      pvForm.services.value = (p.services || []).join('\n');
      pvForm.primaryColor.value = p.primaryColor || '';
      pvForm.secondaryColor.value = p.secondaryColor || '';
      pvForm.primaryPick.value = HEX.test(p.primaryColor || '') ? p.primaryColor : '#1e293b';
      pvForm.secondaryPick.value = HEX.test(p.secondaryColor || '') ? p.secondaryColor : '#94a3b8';
      var tx = p.texts || {};
      TEXT_FIELDS.forEach(function (f) { pvForm['t_' + f[0]].value = tx[f[0]] || ''; });
      pvForm.t_diferenciais.value = (tx.diferenciais || []).join('\n');
      pvForm.t_benefits.value = (tx.benefits || []).join('\n');
      $('#pvKitInfo').textContent = (p.logo ? 'Com logo' : 'Sem logo') + (p.format === 'catalogo' ? ' · ' + (p.products || []).length + ' produtos' : '');
      refreshPlaceholders();
      A.openDrawer(pvDrawer);
    }).catch(saveErr);
  }

  function formSnapshot() {
    return {
      companyName: pvForm.companyName.value.trim(), mainService: pvForm.mainService.value.trim(),
      services: pvForm.services.value.split('\n').map(function (x) { return x.trim(); }).filter(Boolean)
    };
  }
  function refreshPlaceholders() {
    var d = defaultsFor(pvForm.format.value || 'institucional'), snap = formSnapshot();
    TEXT_FIELDS.forEach(function (f) { pvForm['t_' + f[0]].placeholder = fillMarkers(d[f[0]] || '', snap); });
    pvForm.t_diferenciais.placeholder = (d.diferenciais || []).map(function (x) { return fillMarkers(x, snap); }).join('\n');
    pvForm.t_benefits.placeholder = (d.benefits || []).map(function (x) { return fillMarkers(x, snap); }).join('\n');
    $$('.pv-cat', pvForm).forEach(function (el) { el.hidden = pvForm.format.value !== 'catalogo'; });
  }
  if (pvForm) {
    pvForm.addEventListener('input', function (e) {
      if (e.target.name === 'primaryPick') pvForm.primaryColor.value = e.target.value;
      if (e.target.name === 'secondaryPick') pvForm.secondaryColor.value = e.target.value;
      if (/^(companyName|mainService|services)$/.test(e.target.name)) refreshPlaceholders();
    });
    pvForm.format.addEventListener('change', refreshPlaceholders);
    pvForm.addEventListener('click', function (e) {
      var r = e.target.closest('[data-restore]');
      if (r) { e.preventDefault(); var f = pvForm[r.getAttribute('data-restore')]; if (f) { f.value = ''; f.focus(); } return; }
      if (e.target.closest('#pvFromKit')) {
        e.preventDefault();
        if (!pvCurrent) return;
        ensureKit(pvCurrent.leadId).then(function (k) {
          pvCurrent._kit = k.data || {};
          $('#pvKitInfo').textContent = 'Logo e produtos do kit serão copiados ao salvar.';
        });
      }
    });
    pvForm.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!pvCurrent) return;
      var msg = $('#pvMsg');
      var services = pvForm.services.value.split('\n').map(function (x) { return x.trim().slice(0, 60); }).filter(Boolean);
      var lines = function (v) { return v.split('\n').map(function (x) { return x.trim().slice(0, 120); }).filter(Boolean).slice(0, 6); };
      var name = pvForm.companyName.value.trim();
      var pc = pvForm.primaryColor.value.trim(), sc = pvForm.secondaryColor.value.trim();
      if (name.length < 2) { msg.textContent = 'Preencha o nome da empresa.'; return; }
      if (services.length > 8) { msg.textContent = 'Use no máximo 8 serviços.'; return; }
      if ((pc && !HEX.test(pc)) || (sc && !HEX.test(sc))) { msg.textContent = 'As cores precisam estar no formato #rrggbb.'; return; }
      var texts = {};
      TEXT_FIELDS.forEach(function (f) { var v = pvForm['t_' + f[0]].value.trim().slice(0, f[2]); if (v) texts[f[0]] = v; });
      var dif = lines(pvForm.t_diferenciais.value), ben = lines(pvForm.t_benefits.value);
      if (dif.length) texts.diferenciais = dif;
      if (ben.length) texts.benefits = ben;
      var fmt = pvForm.format.value;
      var data = {
        format: fmt, formatReason: pvForm.formatReason.value.trim().slice(0, 300), companyName: name.slice(0, 120),
        tagline: pvForm.tagline.value.trim().slice(0, 120), mainService: pvForm.mainService.value.trim().slice(0, 80),
        services: services, texts: texts,
        primaryColor: pc || api.del(), secondaryColor: sc || api.del()
      };
      var kit = pvCurrent._kit;
      if (kit) {
        data.logo = IMG.test(kit.logo || '') ? kit.logo : '';
        data.products = fmt === 'catalogo' ? (kit.products || []).slice(0, 24) : [];
        data.categories = fmt === 'catalogo' ? (kit.categories || []).slice(0, 12) : [];
      } else if (fmt !== 'catalogo') {
        data.products = [];
        data.categories = [];
      }
      var probe = Object.assign({}, pvCurrent, data);
      delete probe._kit;
      if (JSON.stringify(probe).length > PREVIEW_MAX) { msg.textContent = 'A prévia ficou grande demais. Reduza as fotos dos produtos ou a logo no kit.'; return; }
      var btn = $('#pvSave');
      btn.disabled = true;
      var leadId = pvCurrent.leadId;
      api.updatePreview(pvCurrent.id, data).then(function () {
        toast('Prévia salva');
        A.closeDrawer(pvDrawer);
        plists[leadId] = null;
        mounts.forEach(function (m) { if (m.leadId === leadId) loadPreviews(leadId, true).then(function () { renderPanel(m, true); }); });
      }).catch(saveErr).then(function () { btn.disabled = false; });
    });
  }

  // ---------- Para o CRM e a Prospecção ----------
  A.previews = {
    cardHtml: cardHtml,
    qualBadge: qualBadge,
    mount: mount,
    resolveLink: resolveLink,
    previewUrl: previewUrl,
    absUrl: absUrl,
    paint: paintDots,
    // Garante que a prévia aprovada junto com a mensagem está ativa
    activate: function (ids) {
      return Promise.all(ids.filter(function (id) { return /^[A-Za-z0-9]{1,40}$/.test(id || ''); }).map(function (id) { return api.setPreviewActive(id, true); }));
    }
  };
})();
