// Cron Web Studio · Prospecção (aba "Prospecção" do painel)
// Rodadas de pesquisa por nicho, candidatos encontrados pelo CronUS e fila de aprovação.
// Candidatos são documentos em `leads` com origin 'cronus', batchId da rodada e prospectState.
// Pendentes e descartados não aparecem no CRM. Aprovar é sempre uma ação do Pedro.

(function () {
  'use strict';

  var A = window.CRON_ADMIN;
  if (!A || !A.api) return;

  var api = A.api, $ = A.$, $$ = A.$$, esc = A.esc, toDate = A.toDate, fmtDate = A.fmtDate,
    toast = A.toast, confirmBox = A.confirmBox, promptBox = A.promptBox;

  var CHANNELS = { whatsapp: 'WhatsApp', instagram: 'Instagram', email: 'E-mail' };
  var SITE_ST = { sem_site: 'Sem site', site_fraco: 'Site fraco', ok: 'Site ok' };
  var STATUS = { em_andamento: 'Em andamento', concluida: 'Concluída', arquivada: 'Arquivada' };
  var STAGE_LABEL = {
    novo: 'Novo', mensagem_pronta: 'Mensagem pronta', abordado: 'Abordado', respondeu: 'Respondeu',
    em_conversa: 'Em conversa', contato: 'Em conversa', reuniao: 'Reunião marcada', proposta: 'Proposta enviada',
    fechado: 'Fechado', perdido: 'Perdido'
  };
  var FUNNEL = [
    ['encontradas', 'Encontradas'], ['notaMinima', 'Nota acima do mínimo'], ['avaliacoes', 'Avaliações suficientes'],
    ['siteSemOuFraco', 'Sem site ou site fraco'], ['comContato', 'Com contato'], ['qualificadas', 'Qualificadas']
  ];

  // ---------- Estado ----------
  var rodadas = [], leads = [];
  var pview = 'rodadas', current = null, pstate = 'pendente', showArchived = false, qfilter = '';
  var selected = {};       // id -> true
  var edits = {};          // id -> { ch, texts: { whatsapp: '...' } }
  var pendingRender = false;
  var unsubRod = null, unsubLeads = null;

  // ---------- Utilidades ----------
  function digits(v) { return String(v || '').replace(/\D/g, ''); }
  function httpUrl(v) { v = String(v || '').trim(); return /^https?:\/\/[^\s]+$/i.test(v) ? v : ''; }
  function host(u) { return u.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/.*$/, ''); }
  function title(l) { return l.company || l.name || 'Sem nome'; }
  function stateOf(l) { return l.prospectState || (l.batchId ? 'aprovado' : ''); }
  function stageOf(l) { return l.status === 'contato' ? 'em_conversa' : (STAGE_LABEL[l.status] ? l.status : 'novo'); }
  function isPending(l) { return l.prospectState === 'pendente'; }
  function crmNeedsApproval(l) {
    return !l.prospectState || l.prospectState === 'aprovado'
      ? stageOf(l) === 'mensagem_pronta' && !(l.draft && l.draft.approved)
      : false;
  }
  function hasAnyDraft(l) {
    var d = l.drafts || {};
    return !!(d.whatsapp || d.instagram || d.email || (l.draft && l.draft.text));
  }
  function inQueue(l) { return (isPending(l) && hasAnyDraft(l)) || crmNeedsApproval(l); }
  function rodadaOf(l) { return rodadas.find(function (r) { return r.id === l.batchId; }); }
  function fmtNum(n) { return Number(n).toLocaleString('pt-BR'); }
  function slugify(v) {
    return String(v || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  }
  function saveErr(err) {
    console.error(err);
    toast(err && err.code === 'permission-denied'
      ? 'O banco recusou a gravação. Confira se as regras novas foram publicadas.'
      : 'Não foi possível salvar. Tente de novo.', true);
  }
  function channelsOf(l) {
    var list = [];
    if (digits(l.whatsapp).length >= 10) list.push(['whatsapp', 'WhatsApp']);
    if (l.instagram) list.push(['instagram', 'Instagram']);
    if (l.email || l.companyEmail || l.cnpjEmail) list.push(['email', 'E-mail']);
    if (digits(l.phone || l.cnpjPhone).length >= 8) list.push(['phone', 'Telefone']);
    return list;
  }
  function textFor(l, ch) {
    var e = edits[l.id];
    if (e && e.texts && typeof e.texts[ch] === 'string') return e.texts[ch];
    var d = l.drafts || {};
    if (d[ch]) return d[ch];
    if (l.draft && l.draft.channel === ch && l.draft.text) return l.draft.text;
    return '';
  }
  function channelFor(l) {
    if (edits[l.id] && edits[l.id].ch) return edits[l.id].ch;
    var d = l.drafts || {};
    if (l.draft && l.draft.channel && CHANNELS[l.draft.channel]) return l.draft.channel;
    if (l.channel && CHANNELS[l.channel]) return l.channel;
    var withText = Object.keys(CHANNELS).filter(function (k) { return d[k]; })[0];
    return withText || 'whatsapp';
  }
  function isDirty(l) {
    var e = edits[l.id];
    if (!e || !e.texts) return false;
    return Object.keys(e.texts).some(function (ch) {
      var orig = (l.drafts || {})[ch] || (l.draft && l.draft.channel === ch ? l.draft.text : '') || '';
      return e.texts[ch] !== orig;
    });
  }

  // =================================================================
  // Início
  // =================================================================
  A.register({
    start: function () {
      unsubRod = api.watchRodadas(function (list) { rodadas = list; scheduleRender(); }, function (err) {
        console.error(err);
        toast('Não foi possível carregar as rodadas.', true);
      });
      unsubLeads = A.onLeads(function (list) { leads = list; scheduleRender(); });
    },
    stop: function () {
      if (unsubRod) unsubRod();
      if (unsubLeads) unsubLeads();
      unsubRod = unsubLeads = null;
    }
  });

  // A barra de lote fica fixa na tela: sai de dentro da aba (que tem animação com transform)
  document.body.appendChild($('#bulkbar'));

  // Não redesenha enquanto você digita numa mensagem; redesenha ao sair do campo
  var tab = $('#tab-prospect');
  function typing() {
    var el = document.activeElement;
    return el && tab.contains(el) && (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && el.type === 'text') || (el.tagName === 'INPUT' && !el.type));
  }
  function scheduleRender() {
    if (typing()) { pendingRender = true; updateBadges(); return; }
    render();
  }
  tab.addEventListener('focusout', function () {
    setTimeout(function () { if (pendingRender && !typing()) { pendingRender = false; render(); } }, 120);
  });

  function updateBadges() {
    var pend = leads.filter(isPending).length;
    var q = leads.filter(inQueue).length;
    var b = $('#prospectBadge');
    b.hidden = !pend;
    b.textContent = pend;
    var qc = $('#queueCount');
    qc.hidden = !q;
    qc.textContent = q;
  }

  // =================================================================
  // Renderização
  // =================================================================
  function render() {
    updateBadges();
    $$('[data-pview]').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.pview === pview ? 'true' : 'false'); });
    var inDetail = pview === 'rodadas' && current;
    $('#prRodadas').hidden = pview !== 'rodadas' || !!current;
    $('#prDetail').hidden = !inDetail;
    $('#prQueue').hidden = pview !== 'fila';
    $('.pr-switch').hidden = !!inDetail;
    if (pview === 'rodadas' && !current) renderList();
    if (inDetail) {
      var r = rodadas.find(function (x) { return x.id === current; });
      if (!r) { current = null; renderList(); $('#prRodadas').hidden = false; $('#prDetail').hidden = true; $('.pr-switch').hidden = false; }
      else renderDetail(r);
    }
    if (pview === 'fila') renderQueue();
    renderBulk();
    if (A.previews) A.previews.paint(tab);
  }

  // ---------- Lista de rodadas ----------
  function renderList() {
    var list = rodadas.filter(function (r) { return showArchived || r.status !== 'arquivada'; });
    $('#prEmpty').hidden = list.length > 0;
    $('#prRodadaList').innerHTML = list.map(function (r) {
      var cands = leads.filter(function (l) { return l.batchId === r.id; });
      var pend = cands.filter(isPending).length;
      var f = r.funnel || {};
      var created = toDate(r.createdAt);
      return '<button class="rc" data-rodada="' + esc(r.id) + '" type="button">' +
        '<span class="rc__top"><strong>' + esc(r.nicheLabel || r.niche) + '</strong><span class="rc__st rc__st--' + esc(r.status) + '">' + (STATUS[r.status] || '') + '</span></span>' +
        '<span class="rc__meta">' + esc([r.region, created ? fmtDate(created) : '', r.createdBy === 'cronus' ? 'CronUS' : 'Criada por você'].filter(Boolean).join(' · ')) + '</span>' +
        '<span class="rc__funnel">' + (f.encontradas != null ? '<b>' + fmtNum(f.encontradas) + '</b> encontradas' : 'Funil ainda vazio') +
          (f.qualificadas != null ? ' <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg> <b>' + fmtNum(f.qualificadas) + '</b> qualificadas' : '') + '</span>' +
        '<span class="rc__foot">' + (pend ? '<span class="rc__pend">' + pend + (pend === 1 ? ' pendente' : ' pendentes') + '</span>' : '<span class="muted">Nada pendente</span>') +
          '<span class="muted">' + cands.length + (cands.length === 1 ? ' candidato' : ' candidatos') + '</span></span>' +
      '</button>';
    }).join('');
  }

  // ---------- Uma rodada ----------
  function criteriaText(c) {
    c = c || {};
    var parts = [];
    if (c.minRating != null) parts.push('Nota mínima ' + String(c.minRating).replace('.', ','));
    if (c.minReviews != null) parts.push(fmtNum(c.minReviews) + ' avaliações ou mais');
    if (c.siteStatusAccepted && c.siteStatusAccepted.length) parts.push(c.siteStatusAccepted.map(function (s) { return SITE_ST[s] || s; }).join(' ou '));
    if (c.requireContact) parts.push('Com contato');
    return parts.join(' · ') || 'Sem critérios definidos';
  }

  function renderDetail(r) {
    var created = toDate(r.createdAt);
    var actions = '<button class="btn btn--ghost" data-redit type="button">Editar</button>';
    if (r.status === 'em_andamento') actions += '<button class="btn btn--ghost" data-rstatus="concluida" type="button">Concluir</button>';
    if (r.status === 'concluida') actions += '<button class="btn btn--ghost" data-rstatus="em_andamento" type="button">Reabrir</button>';
    actions += r.status === 'arquivada'
      ? '<button class="btn btn--ghost" data-rstatus="em_andamento" type="button">Desarquivar</button>'
      : '<button class="btn btn--ghost" data-rstatus="arquivada" type="button">Arquivar</button>';
    $('#prHead').innerHTML =
      '<div class="pr-head__top"><div><p class="top__eyebrow">' + esc((STATUS[r.status] || '') + (created ? ' · ' + fmtDate(created) : '')) + '</p>' +
      '<h2>' + esc(r.nicheLabel || r.niche) + '</h2>' +
      '<p class="muted">' + esc([r.region, r.createdBy === 'cronus' ? 'Pesquisa do CronUS' : 'Criada por você'].filter(Boolean).join(' · ')) + '</p></div>' +
      '<div class="pr-head__actions">' + actions + '</div></div>' +
      '<p class="pr-criteria">' + esc(criteriaText(r.criteria)) + '</p>' +
      (r.notes ? '<p class="pr-notes">' + esc(r.notes) + '</p>' : '');

    var f = r.funnel || {};
    var top = Math.max(1, f.encontradas || 0);
    $('#prFunnel').innerHTML = '<h3>Funil</h3>' + (Object.keys(f).length
      ? '<ol class="pf">' + FUNNEL.map(function (s) {
          var v = f[s[0]];
          return '<li><span>' + s[1] + '</span><span class="pf__bar"><i style="width:' + (v != null ? Math.max(2, Math.round(v / top * 100)) : 0) + '%"></i></span><b>' + (v != null ? fmtNum(v) : '-') + '</b></li>';
        }).join('') + '</ol>'
      : '<p class="muted">O CronUS preenche o funil quando termina a pesquisa.</p>');

    var cands = leads.filter(function (l) { return l.batchId === r.id; });
    var n = { pendente: 0, aprovado: 0, descartado: 0 };
    cands.forEach(function (l) { var s = stateOf(l); if (n[s] != null) n[s]++; });
    $('#cPend').textContent = n.pendente;
    $('#cApr').textContent = n.aprovado;
    $('#cDesc').textContent = n.descartado;
    $$('#prStateSw [data-pstate]').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.pstate === pstate ? 'true' : 'false'); });
    var inState = cands.filter(function (l) { return stateOf(l) === pstate; });
    var qn = { '': inState.length, qualificado: 0, desqualificado: 0, sem: 0 };
    inState.forEach(function (l) { qn[l.qualification === 'qualificado' ? 'qualificado' : l.qualification === 'desqualificado' ? 'desqualificado' : 'sem']++; });
    $('#prQual').innerHTML = [['', 'Todos'], ['qualificado', 'Qualificados'], ['desqualificado', 'Desqualificados'], ['sem', 'Sem avaliação']].map(function (q) {
      return '<button type="button" class="stage-chip' + (qfilter === q[0] ? ' is-active' : '') + '" data-qf="' + q[0] + '" aria-pressed="' + (qfilter === q[0]) + '">' + q[1] + ' <b>' + qn[q[0]] + '</b></button>';
    }).join('');
    var rows = inState.filter(function (l) {
      if (!qfilter) return true;
      if (qfilter === 'sem') return l.qualification !== 'qualificado' && l.qualification !== 'desqualificado';
      return l.qualification === qfilter;
    });
    $('#prSelAllWrap').hidden = pstate !== 'pendente' || !rows.length;
    $('#prSelAll').checked = rows.length > 0 && rows.every(function (l) { return selected[l.id]; });
    $('#prCards').innerHTML = rows.length ? rows.map(function (l) { return cardHtml(l, 'rodada'); }).join('')
      : '<p class="empty-line">' + (pstate === 'pendente' ? 'Nenhum candidato pendente nesta rodada.' : pstate === 'aprovado' ? 'Nenhum candidato aprovado ainda.' : 'Nenhum candidato descartado.') + '</p>';
  }

  // ---------- Cartão do candidato ----------
  function cardHtml(l, ctx) {
    var st = stateOf(l), ch = channelFor(l), text = textFor(l, ch);
    var crm = ctx === 'fila' && !isPending(l);
    var facts = [];
    if (l.googleRating != null) facts.push('<span class="pc__fact"><b>' + String(l.googleRating).replace('.', ',') + '</b> no Google' + (l.googleReviews != null ? ' (' + fmtNum(l.googleReviews) + ' avaliações)' : '') + '</span>');
    if (l.siteStatus && SITE_ST[l.siteStatus]) facts.push('<span class="chip chip--site-' + l.siteStatus + '">' + SITE_ST[l.siteStatus] + (l.siteScore != null ? ' · nota ' + l.siteScore + '/10' : '') + '</span>');
    if (l.niche) facts.push('<span class="chip">' + esc(l.niche.replace(/-/g, ' ')) + '</span>');
    var site = httpUrl(l.currentSite);
    var chans = channelsOf(l);
    var sub = [l.company && l.name ? l.name : '', l.role].filter(Boolean).join(' · ');
    var origin = '';
    if (ctx === 'fila') {
      var r = rodadaOf(l);
      origin = crm ? 'CRM · ' + (STAGE_LABEL[stageOf(l)] || '') : 'Rodada · ' + (r ? (r.nicheLabel || r.niche) : 'sem rodada');
    }

    var seg = Object.keys(CHANNELS).map(function (k) {
      var has = !!textFor(l, k);
      return '<button type="button" data-ch="' + k + '" data-for="' + esc(l.id) + '" class="' + (k === ch ? 'is-active' : '') + (has ? ' has-text' : '') + '" aria-pressed="' + (k === ch) + '">' + CHANNELS[k] + '</button>';
    }).join('');

    var editable = st === 'pendente' || crm;
    var msg = '<div class="pc__msg">' +
      '<div class="seg seg--sm" role="group" aria-label="Canal da mensagem">' + seg + '</div>' +
      (editable
        ? '<label class="f"><span class="sr-only">Mensagem para ' + esc(title(l)) + '</span><textarea rows="5" maxlength="2000" data-text="' + esc(l.id) + '" placeholder="Sem mensagem para este canal. Escreva aqui se quiser.">' + esc(text) + '</textarea></label>'
        : '<p class="pc__readonly">' + (text ? esc(text) : '<span class="muted">Sem mensagem para este canal.</span>') + '</p>') +
    '</div>';

    var actions = '';
    if (st === 'pendente') {
      actions = '<button class="btn btn--lime" type="button" data-approve="' + esc(l.id) + '">Aprovar e mandar para o CRM</button>' +
        '<button class="btn btn--ghost" type="button" data-discard="' + esc(l.id) + '">Descartar</button>' +
        (isDirty(l) ? '<button class="btn-text" type="button" data-savetext="' + esc(l.id) + '">Salvar texto</button>' : '');
    } else if (crm) {
      actions = '<button class="btn btn--lime" type="button" data-approve="' + esc(l.id) + '">Aprovar mensagem</button>' +
        '<button class="btn btn--ghost" type="button" data-opencrm="' + esc(l.id) + '">Abrir no CRM</button>';
    } else if (st === 'aprovado') {
      actions = '<button class="btn btn--ghost" type="button" data-opencrm="' + esc(l.id) + '">Ver no CRM</button>';
    } else if (st === 'descartado') {
      actions = '<button class="btn btn--ghost" type="button" data-restore="' + esc(l.id) + '">Voltar para pendentes</button>';
    }

    var selectable = st === 'pendente' || crm;
    return '<article class="pc' + (selected[l.id] ? ' is-selected' : '') + '" data-id="' + esc(l.id) + '">' +
      (selectable ? '<label class="pc__sel"><input type="checkbox" data-sel="' + esc(l.id) + '"' + (selected[l.id] ? ' checked' : '') + '><span class="sr-only">Selecionar ' + esc(title(l)) + '</span></label>' : '') +
      '<div class="pc__body">' +
        (origin ? '<p class="top__eyebrow pc__origin">' + esc(origin) + '</p>' : '') +
        '<div class="pc__head"><div><h3>' + esc(title(l)) + (A.previews ? ' ' + A.previews.qualBadge(l) : '') + '</h3>' + (sub ? '<p class="muted">' + esc(sub) + '</p>' : '') + '</div>' +
          (l.channel && CHANNELS[l.channel] ? '<span class="pc__rec">Recomendado: ' + CHANNELS[l.channel] + '</span>' : '') + '</div>' +
        (facts.length ? '<div class="pc__facts">' + facts.join('') + '</div>' : '') +
        (l.siteReason || site ? '<p class="pc__site">' + (site ? '<a href="' + esc(site) + '" target="_blank" rel="noopener noreferrer">' + esc(host(site)) + '</a>' : '') + (l.siteReason ? (site ? ' · ' : '') + esc(l.siteReason) : '') + '</p>' : '') +
        (chans.length ? '<p class="pc__chans"><span class="muted">Contatos:</span> ' + chans.map(function (c) { return '<span class="chip">' + c[1] + '</span>'; }).join(' ') + '</p>'
          : '<p class="pc__chans muted">Nenhum contato encontrado.</p>') +
        (l.fitReason ? '<p class="pc__fit"><strong>Por que encaixa:</strong> ' + esc(l.fitReason) + '</p>' : '') +
        (st === 'descartado' && l.discardReason ? '<p class="pc__fit"><strong>Motivo do descarte:</strong> ' + esc(l.discardReason) + '</p>' : '') +
        (A.previews && (st === 'pendente' || crm || st === 'aprovado') ? A.previews.cardHtml(l) : '') +
        msg +
        '<div class="pc__actions">' + actions + '</div>' +
      '</div>' +
    '</article>';
  }

  // ---------- Fila ----------
  function queueRows() {
    return leads.filter(inQueue).sort(function (a, b) { return (toDate(b.createdAt) || 0) - (toDate(a.createdAt) || 0); });
  }
  function renderQueue() {
    var rows = queueRows();
    $('#qSelAllWrap').hidden = !rows.length;
    $('#qSelAll').checked = rows.length > 0 && rows.every(function (l) { return selected[l.id]; });
    $('#qCards').innerHTML = rows.length ? rows.map(function (l) { return cardHtml(l, 'fila'); }).join('')
      : '<p class="empty-line">Nenhuma mensagem esperando aprovação.</p>';
  }

  // ---------- Barra de lote ----------
  function selectedLeads() {
    return Object.keys(selected).map(function (id) { return leads.find(function (l) { return l.id === id; }); })
      .filter(function (l) { return l && (isPending(l) || crmNeedsApproval(l)); });
  }
  function renderBulk() {
    var list = selectedLeads();
    var bar = $('#bulkbar');
    bar.hidden = !list.length || $('#tab-prospect').hidden;
    $('#bulkCount').textContent = list.length + (list.length === 1 ? ' selecionado' : ' selecionados');
    $('#bulkDiscard').hidden = !list.some(isPending);
  }

  // =================================================================
  // Ações
  // =================================================================
  // Aprovar candidato: vai para o CRM com a mensagem da tela já aprovada (nada é enviado).
  // Aprovar lead do CRM: só aprova a mensagem.
  function approve(list) {
    var dq = list.filter(function (l) { return l.qualification === 'desqualificado'; });
    if (dq.length) {
      var txt = dq.length === 1
        ? 'Este lead foi marcado como desqualificado: ' + (dq[0].disqualifyReason || 'sem motivo') + '. Aprovar mesmo assim?'
        : dq.length + ' itens foram marcados como desqualificados (' + dq.map(function (l) { return title(l) + ': ' + (l.disqualifyReason || 'sem motivo'); }).join('; ') + '). Aprovar mesmo assim?';
      return confirmBox('Aprovar lead desqualificado?', txt, 'Aprovar mesmo assim').then(function (ok) { if (ok) return doApprove(list); render(); });
    }
    return doApprove(list);
  }
  function doApprove(list) {
    var items = [], skipped = 0, pids = [];
    list.forEach(function (l) {
      var ch = channelFor(l), text = (textFor(l, ch) || '').trim().slice(0, 2000);
      if (isPending(l)) {
        var to = text ? 'mensagem_pronta' : 'novo';
        var data = { prospectState: 'aprovado', status: to, stageAt: api.now() };
        var inters = [{ type: 'nota', text: 'Aprovado na prospecção' + (rodadaOf(l) ? ' (' + (rodadaOf(l).nicheLabel || rodadaOf(l).niche) + ')' : '') + '.' }];
        if (text) {
          data.draft = { channel: ch, text: text, approved: true, approvedAt: api.now() };
          data['drafts.' + ch] = text;
          if (validPid(l.previewId)) { data.draft.previewId = l.previewId; pids.push(l.previewId); }
        }
        if (stageOf(l) !== to) inters.push({ type: 'mudanca_etapa', from: stageOf(l), to: to });
        items.push({ id: l.id, data: data, inters: inters });
      } else if (crmNeedsApproval(l)) {
        if (!text) { skipped++; return; }
        var d2 = { 'draft.text': text, 'draft.channel': ch, 'draft.approved': true, 'draft.approvedAt': api.now() };
        if (validPid(l.previewId)) { d2['draft.previewId'] = l.previewId; pids.push(l.previewId); }
        items.push({ id: l.id, data: d2, inters: [] });
      }
    });
    if (!items.length) { toast(skipped ? 'Escreva a mensagem antes de aprovar.' : 'Nada para aprovar.', true); return Promise.resolve(); }
    var act = pids.length && A.previews ? A.previews.activate(pids) : Promise.resolve();
    return act.then(function () { return api.updateLeads(items); }).then(function () {
      items.forEach(function (it) { delete selected[it.id]; delete edits[it.id]; });
      var what = pids.length ? (items.length === 1 ? 'Mensagem e site modelo aprovados' : items.length + ' aprovados, com mensagem e site modelo') : (items.length === 1 ? 'Aprovado' : items.length + ' aprovados');
      toast(what + (skipped ? '. ' + skipped + ' sem mensagem ficaram de fora.' : '') + '. Nada foi enviado.');
      render();
    }).catch(saveErr);
  }

  function discard(list) {
    list = list.filter(isPending);
    if (!list.length) return Promise.resolve();
    return promptBox(list.length === 1 ? 'Descartar ' + title(list[0]) + '?' : 'Descartar ' + list.length + ' candidatos?',
      'O motivo é opcional e ajuda a calibrar as próximas rodadas.', { yes: 'Descartar', placeholder: 'Ex.: site já é bom, sem contato, fora do perfil' })
      .then(function (reason) {
        if (reason === null) return;
        var items = list.map(function (l) {
          var data = { prospectState: 'descartado' };
          if (reason) data.discardReason = reason.slice(0, 300);
          return { id: l.id, data: data, inters: [{ type: 'nota', text: 'Descartado na prospecção' + (reason ? ': ' + reason.slice(0, 300) : '.') }] };
        });
        return api.updateLeads(items).then(function () {
          items.forEach(function (it) { delete selected[it.id]; delete edits[it.id]; });
          toast(items.length === 1 ? 'Descartado' : items.length + ' descartados');
          render();
        }).catch(saveErr);
      });
  }

  function validPid(id) { return /^[A-Za-z0-9]{1,40}$/.test(id || ''); }

  function findLead(id) { return leads.find(function (l) { return l.id === id; }); }

  tab.addEventListener('click', function (e) {
    var t = e.target;
    var b;
    if ((b = t.closest('[data-pview]'))) { pview = b.dataset.pview; current = null; selected = {}; render(); return; }
    if ((b = t.closest('[data-rodada]'))) { current = b.dataset.rodada; pstate = 'pendente'; qfilter = ''; selected = {}; render(); window.scrollTo(0, 0); return; }
    if ((b = t.closest('[data-pstate]'))) { pstate = b.dataset.pstate; selected = {}; render(); return; }
    if ((b = t.closest('[data-qf]'))) { qfilter = b.dataset.qf; selected = {}; render(); return; }
    if ((b = t.closest('[data-ch]'))) {
      var l0 = findLead(b.dataset.for);
      if (!l0) return;
      edits[l0.id] = edits[l0.id] || { texts: {} };
      edits[l0.id].ch = b.dataset.ch;
      render();
      return;
    }
    if ((b = t.closest('[data-approve]'))) { var l1 = findLead(b.dataset.approve); if (l1) { b.disabled = true; approve([l1]); } return; }
    if ((b = t.closest('[data-discard]'))) { var l2 = findLead(b.dataset.discard); if (l2) discard([l2]); return; }
    if ((b = t.closest('[data-opencrm]'))) { if (A.crm) A.crm.open(b.dataset.opencrm); return; }
    if ((b = t.closest('[data-restore]'))) {
      api.updateLeads([{ id: b.dataset.restore, data: { prospectState: 'pendente', discardReason: api.del() }, inters: [{ type: 'nota', text: 'Voltou para pendentes na prospecção.' }] }])
        .then(function () { toast('De volta aos pendentes'); }).catch(saveErr);
      return;
    }
    if ((b = t.closest('[data-savetext]'))) {
      var l3 = findLead(b.dataset.savetext);
      var e3 = l3 && edits[l3.id];
      if (!e3) return;
      var data = {};
      Object.keys(e3.texts).forEach(function (ch) { data['drafts.' + ch] = e3.texts[ch].slice(0, 2000); });
      api.updateLeads([{ id: l3.id, data: data, inters: [] }]).then(function () {
        e3.texts = {};
        toast('Texto salvo');
        render();
      }).catch(saveErr);
      return;
    }
    if ((b = t.closest('[data-rstatus]'))) {
      var r = rodadas.find(function (x) { return x.id === current; });
      if (!r) return;
      var to = b.dataset.rstatus;
      api.updateRodada(r.id, { status: to }).then(function () {
        toast(to === 'arquivada' ? 'Rodada arquivada' : to === 'concluida' ? 'Rodada concluída' : 'Rodada reaberta');
      }).catch(saveErr);
      return;
    }
    if (t.closest('[data-redit]')) { openRodada(rodadas.find(function (x) { return x.id === current; })); return; }
  });

  tab.addEventListener('input', function (e) {
    var ta = e.target.closest('[data-text]');
    if (!ta) return;
    var l = findLead(ta.dataset.text);
    if (!l) return;
    var ch = channelFor(l);
    edits[l.id] = edits[l.id] || { texts: {} };
    edits[l.id].ch = ch;
    edits[l.id].texts[ch] = ta.value;
    // mostra o "Salvar texto" sem redesenhar o cartão inteiro
    var card = ta.closest('.pc');
    var acts = card && $('.pc__actions', card);
    if (acts && isPending(l) && !$('[data-savetext]', acts)) {
      var btn = document.createElement('button');
      btn.className = 'btn-text'; btn.type = 'button'; btn.dataset.savetext = l.id; btn.textContent = 'Salvar texto';
      acts.appendChild(btn);
    }
  });

  tab.addEventListener('change', function (e) {
    var cb = e.target.closest('[data-sel]');
    if (cb) {
      if (cb.checked) selected[cb.dataset.sel] = true; else delete selected[cb.dataset.sel];
      cb.closest('.pc').classList.toggle('is-selected', cb.checked);
      renderBulk();
      return;
    }
    if (e.target.id === 'prSelAll' || e.target.id === 'qSelAll') {
      var on = e.target.checked;
      $$(e.target.id === 'prSelAll' ? '#prCards [data-sel]' : '#qCards [data-sel]').forEach(function (c) {
        c.checked = on;
        if (on) selected[c.dataset.sel] = true; else delete selected[c.dataset.sel];
        c.closest('.pc').classList.toggle('is-selected', on);
      });
      renderBulk();
      return;
    }
    if (e.target.id === 'prShowArchived') { showArchived = e.target.checked; render(); }
  });

  $('#prBack').addEventListener('click', function () { current = null; selected = {}; render(); });
  $('#bulkApprove').addEventListener('click', function () {
    var list = selectedLeads();
    if (!list.length) return;
    confirmBox('Aprovar ' + list.length + (list.length === 1 ? ' item?' : ' itens?'),
      'Candidatos vão para o CRM com a mensagem que está na tela já aprovada. Leads do CRM têm só a mensagem aprovada. Nada é enviado.', 'Aprovar')
      .then(function (ok) { if (ok) approve(list); });
  });
  $('#bulkDiscard').addEventListener('click', function () { discard(selectedLeads()); });

  // =================================================================
  // Gaveta da rodada (criar e editar)
  // =================================================================
  var rdDrawer = $('#rodadaDrawer'), rdForm = $('#rodadaForm'), editingRodada = null, nicheTouched = false;
  $('#newRodada').addEventListener('click', function () { openRodada(null); });
  rdForm.nicheLabel.addEventListener('input', function () { if (!nicheTouched) rdForm.niche.value = slugify(this.value); });
  rdForm.niche.addEventListener('input', function () { nicheTouched = true; });

  function openRodada(r) {
    editingRodada = r ? r.id : null;
    nicheTouched = !!r;
    rdForm.reset();
    $('#rdMsg').textContent = '';
    $('#rdTitle').textContent = r ? 'Editar rodada' : 'Nova rodada';
    $('#rdSave').textContent = r ? 'Salvar' : 'Criar rodada';
    if (r) {
      var c = r.criteria || {}, f = r.funnel || {};
      rdForm.nicheLabel.value = r.nicheLabel || '';
      rdForm.niche.value = r.niche || '';
      rdForm.region.value = r.region || '';
      rdForm.minRating.value = c.minRating != null ? String(c.minRating).replace('.', ',') : '';
      rdForm.minReviews.value = c.minReviews != null ? c.minReviews : '';
      var acc = c.siteStatusAccepted || [];
      rdForm.st_sem_site.checked = acc.indexOf('sem_site') !== -1;
      rdForm.st_site_fraco.checked = acc.indexOf('site_fraco') !== -1;
      rdForm.st_ok.checked = acc.indexOf('ok') !== -1;
      rdForm.requireContact.checked = !!c.requireContact;
      FUNNEL.forEach(function (s) { rdForm['f_' + s[0]].value = f[s[0]] != null ? f[s[0]] : ''; });
      rdForm.notes.value = r.notes || '';
      $('.rd-funnel', rdForm).open = Object.keys(f).length > 0;
    }
    A.openDrawer(rdDrawer);
    setTimeout(function () { rdForm.nicheLabel.focus(); }, 250);
  }

  rdForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var msg = $('#rdMsg');
    var label = rdForm.nicheLabel.value.trim().slice(0, 80);
    var niche = slugify(rdForm.niche.value || label);
    if (label.length < 2 || niche.length < 2) { msg.textContent = 'Dê um nome ao nicho.'; return; }
    var criteria = {};
    var mr = rdForm.minRating.value.trim();
    if (mr) {
      var mrv = Number(mr.replace(',', '.'));
      if (isNaN(mrv) || mrv < 0 || mrv > 5) { msg.textContent = 'A nota mínima vai de 0 a 5.'; return; }
      criteria.minRating = Math.round(mrv * 10) / 10;
    }
    var mv = rdForm.minReviews.value.trim();
    if (mv) {
      var mvv = Number(mv);
      if (!Number.isInteger(mvv) || mvv < 0 || mvv > 100000) { msg.textContent = 'O mínimo de avaliações precisa ser um número inteiro.'; return; }
      criteria.minReviews = mvv;
    }
    criteria.siteStatusAccepted = ['sem_site', 'site_fraco', 'ok'].filter(function (k) { return rdForm['st_' + k].checked; });
    criteria.requireContact = rdForm.requireContact.checked;
    var funnel = {}, badF = false;
    FUNNEL.forEach(function (s) {
      var v = rdForm['f_' + s[0]].value.trim();
      if (!v) return;
      var n = Number(v);
      if (!Number.isInteger(n) || n < 0 || n > 100000) badF = true; else funnel[s[0]] = n;
    });
    if (badF) { msg.textContent = 'Os números do funil precisam ser inteiros.'; return; }
    var data = { niche: niche, nicheLabel: label, region: rdForm.region.value.trim().slice(0, 120), criteria: criteria, notes: rdForm.notes.value.trim().slice(0, 2000) };
    if (Object.keys(funnel).length) data.funnel = funnel;
    else if (editingRodada) {
      var old = rodadas.find(function (x) { return x.id === editingRodada; });
      if (old && old.funnel) data.funnel = api.del();
    }
    var btn = $('#rdSave');
    btn.disabled = true;
    var done = editingRodada
      ? api.updateRodada(editingRodada, data).then(function () { toast('Rodada salva'); })
      : api.createRodada(Object.assign(data, { status: 'em_andamento' })).then(function (id) { toast('Rodada criada'); current = id; pview = 'rodadas'; });
    done.then(function () { A.closeDrawer(rdDrawer); render(); }).catch(saveErr).then(function () { btn.disabled = false; });
  });

  // a barra de lote só aparece na aba Prospecção
  A.register({ onTab: function () { renderBulk(); } });
})();
