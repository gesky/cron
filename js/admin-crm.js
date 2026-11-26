// Cron Web Studio · CRM (aba "CRM" do painel)
// Quadro por etapa, lista, origens, gaveta do lead com histórico, mensagem de abordagem,
// próximo passo, cadastro manual e CSV. Usa o núcleo exposto pelo admin.js (window.CRON_ADMIN).
// Nada é enviado automaticamente: o painel só prepara links e textos; quem envia é o Pedro.

(function () {
  'use strict';

  var A = window.CRON_ADMIN;
  if (!A || !A.api) return;

  var api = A.api, $ = A.$, $$ = A.$$, esc = A.esc, toDate = A.toDate, fmtDate = A.fmtDate,
    ago = A.ago, fmtPhone = A.fmtPhone, initials = A.initials, firstName = A.firstName,
    toast = A.toast, confirmBox = A.confirmBox, promptBox = A.promptBox;

  // =================================================================
  // Dicionários
  // =================================================================
  var STAGES = [
    { id: 'novo', label: 'Novo', c: 'var(--st-novo)' },
    { id: 'mensagem_pronta', label: 'Mensagem pronta', c: 'var(--st-pronta)' },
    { id: 'abordado', label: 'Abordado', c: 'var(--st-abordado)' },
    { id: 'respondeu', label: 'Respondeu', c: 'var(--st-respondeu)' },
    { id: 'em_conversa', label: 'Em conversa', c: 'var(--st-contato)' },
    { id: 'reuniao', label: 'Reunião marcada', c: 'var(--st-reuniao)' },
    { id: 'proposta', label: 'Proposta enviada', c: 'var(--st-proposta)' },
    { id: 'fechado', label: 'Fechado', c: 'var(--st-fechado)' },
    { id: 'perdido', label: 'Perdido', c: 'var(--st-perdido)' }
  ];
  var BY = {};
  STAGES.forEach(function (s) { BY[s.id] = s; });
  var LEGACY = { contato: 'em_conversa' };
  var CLOSED = { fechado: 1, perdido: 1 };

  var ORIGINS = { site: 'Site', cronus: 'CronUS', indicacao: 'Indicação', manual: 'Manual' };
  var CHANNELS = { whatsapp: 'WhatsApp', instagram: 'Instagram', email: 'E-mail' };
  var SITE_ST = { sem_site: 'Sem site', site_fraco: 'Site fraco', ok: 'Site ok' };
  var NEED = { institucional: 'Site institucional', sistema: 'Sistema ou painel', 'nao-sei': 'Ainda não sei' };
  var INTER = {
    mensagem_enviada: 'Mensagem enviada', resposta: 'Resposta do lead', nota: 'Nota',
    mudanca_etapa: 'Mudança de etapa', reuniao: 'Reunião', proposta: 'Proposta'
  };
  var DATA_SRC = { google_maps: 'Google Maps', site: 'site da empresa', receita: 'Receita Federal', instagram: 'Instagram', linkedin: 'LinkedIn', busca: 'busca', manual: 'manual' };

  var SOURCES = {
    'hero-primary': 'Hero · botão principal', 'hero-secondary': 'Hero · botão secundário',
    'header': 'Header', 'nav-mobile': 'Menu mobile', 'manifesto': 'Manifesto', 'painel': 'Seção painel',
    'plano-institucional': 'Plano institucional', 'plano-sistema': 'Plano sistema', 'processo': 'Processo',
    'final-whatsapp': 'CTA final', 'final-projetos': 'CTA final · projetos', 'float-whatsapp': 'Botão flutuante',
    'footer-whatsapp': 'Rodapé', 'direto': 'Direto'
  };
  function humanize(s) { s = String(s).replace(/[-_]/g, ' '); return s.charAt(0).toUpperCase() + s.slice(1); }
  function sourceName(s) {
    if (!s) return 'Direto';
    if (SOURCES[s]) return SOURCES[s];
    if (s.indexOf('case-') === 0) return 'Projeto · ' + humanize(s.slice(5));
    return humanize(s);
  }

  // Campos editáveis da gaveta. type define limpeza e validação (espelham as regras do Firestore).
  var FIELDS = [
    { g: 'Empresa', k: 'company', label: 'Empresa', type: 'text', max: 120, ph: 'Nome fantasia' },
    { g: 'Empresa', k: 'legalName', label: 'Razão social', type: 'text', max: 160 },
    { g: 'Empresa', k: 'niche', label: 'Nicho', type: 'slug', max: 60, ph: 'industria-moveis' },
    { g: 'Empresa', k: 'cnpj', label: 'CNPJ', type: 'digits', len: [14, 14], ph: 'Só números' },
    { g: 'Empresa', k: 'companyYears', label: 'Anos de empresa', type: 'int', min: 0, max: 200 },
    { g: 'Empresa', k: 'city', label: 'Cidade (interno)', type: 'text', max: 80 },
    { g: 'Empresa', k: 'state', label: 'UF (interno)', type: 'uf', ph: 'SP' },
    { g: 'Empresa', k: 'address', label: 'Endereço (interno)', type: 'text', max: 300, full: 1 },

    { g: 'Contato', k: 'name', label: 'Nome do contato', type: 'text', max: 120 },
    { g: 'Contato', k: 'role', label: 'Cargo', type: 'text', max: 80 },
    { g: 'Contato', k: 'whatsapp', label: 'WhatsApp', type: 'digits', len: [10, 13], ph: 'DDD + número', link: 'wa' },
    { g: 'Contato', k: 'phone', label: 'Telefone', type: 'digits', len: [8, 13], ph: 'Fixo ou comercial', link: 'tel' },
    { g: 'Contato', k: 'email', label: 'E-mail do contato', type: 'email', link: 'mail' },
    { g: 'Contato', k: 'companyEmail', label: 'E-mail da empresa', type: 'email', link: 'mail' },
    { g: 'Contato', k: 'instagram', label: 'Instagram', type: 'insta', ph: 'usuario', link: 'insta' },
    { g: 'Contato', k: 'linkedin', label: 'LinkedIn do contato', type: 'url', link: 'url' },
    { g: 'Contato', k: 'companyLinkedin', label: 'LinkedIn da empresa', type: 'url', link: 'url' },
    { g: 'Contato', k: 'facebook', label: 'Facebook', type: 'url', link: 'url' },
    { g: 'Contato', k: 'googleMapsUrl', label: 'Ficha no Google', type: 'url', link: 'url' },
    { g: 'Contato', k: 'cnpjEmail', label: 'E-mail do CNPJ', type: 'email', link: 'mail' },
    { g: 'Contato', k: 'cnpjPhone', label: 'Telefone do CNPJ', type: 'digits', len: [8, 13], link: 'tel' },
    { g: 'Contato', k: 'otherLinks', label: 'Outros links (um por linha)', type: 'lines', full: 1 },

    { g: 'Site atual', k: 'currentSite', label: 'Endereço do site', type: 'url', link: 'url', full: 1 },
    { g: 'Site atual', k: 'siteStatus', label: 'Situação', type: 'select', opts: [['', 'Não avaliado'], ['sem_site', 'Sem site'], ['site_fraco', 'Site fraco'], ['ok', 'Site ok']] },
    { g: 'Site atual', k: 'siteScore', label: 'Nota do site (0 a 10)', type: 'int', min: 0, max: 10 },
    { g: 'Site atual', k: 'siteReason', label: 'Por que o site é fraco', type: 'textarea', max: 300, full: 1 },

    { g: 'Qualificação', k: 'need', label: 'Precisa de', type: 'select', opts: [['', 'Não informado'], ['institucional', 'Site institucional'], ['sistema', 'Sistema ou painel'], ['nao-sei', 'Ainda não sei']] },
    { g: 'Qualificação', k: 'channel', label: 'Canal recomendado', type: 'select', opts: [['', 'Não definido'], ['whatsapp', 'WhatsApp'], ['instagram', 'Instagram'], ['email', 'E-mail']] },
    { g: 'Qualificação', k: 'googleRating', label: 'Nota no Google (0 a 5)', type: 'num', min: 0, max: 5 },
    { g: 'Qualificação', k: 'googleReviews', label: 'Avaliações no Google', type: 'int', min: 0, max: 1000000 },
    { g: 'Qualificação', k: 'fitReason', label: 'Por que encaixa no perfil da Cron', type: 'textarea', max: 600, full: 1 },
    { g: 'Qualificação', k: 'lostReason', label: 'Motivo de perda', type: 'text', max: 300, full: 1 },

    { g: 'Prospecção', k: 'origin', label: 'Origem', type: 'select', opts: [['site', 'Site'], ['cronus', 'CronUS'], ['indicacao', 'Indicação'], ['manual', 'Manual']], noCreate: 1 },
    { g: 'Prospecção', k: 'owner', label: 'Responsável', type: 'text', max: 40, ph: 'pedro' },
    { g: 'Prospecção', k: 'previewId', label: 'Site modelo (id)', type: 'id' },
    { g: 'Prospecção', k: 'batchId', label: 'Rodada de prospecção', type: 'ro' },
    { g: 'Prospecção', k: 'createdBy', label: 'Criado por', type: 'ro' }
  ];
  var GROUPS = ['Empresa', 'Contato', 'Site atual', 'Qualificação', 'Prospecção'];

  // =================================================================
  // Estado
  // =================================================================
  var leads = [];
  var view = 'board';
  var F = { etapa: '', niche: '', origin: '', channel: '', site: '', quick: '', q: '' };
  var openId = null, mode = 'view', interList = [], unsubInter = null, unsubLeads = null;
  var dirty = { next: false, draft: false, form: false, notes: false };
  var draftChannel = 'whatsapp';
  var canDrag = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var STORE_VIEW = 'cron_crm_view';

  // =================================================================
  // Utilidades de dados
  // =================================================================
  function stageOf(l) { return LEGACY[l.status] || (BY[l.status] ? l.status : 'novo'); }
  function originOf(l) { return ORIGINS[l.origin] ? l.origin : 'site'; }
  function title(l) { return l.company || l.name || 'Sem nome'; }
  function hidden(l) { return l.prospectState === 'pendente' || l.prospectState === 'descartado'; }
  function sameDay(a, b) { return a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
  function due(l) { return l.nextStep ? toDate(l.nextStep.dueAt) : null; }
  function isLate(l) { var d = due(l); return !!d && !CLOSED[stageOf(l)] && d < new Date() && !sameDay(d, new Date()); }
  function isToday(l) {
    var now = new Date(), d = due(l), m = toDate(l.meetingAt);
    if (CLOSED[stageOf(l)]) return false;
    return (d && sameDay(d, now)) || (m && sameDay(m, now));
  }
  function needsApproval(l) { return stageOf(l) === 'mensagem_pronta' && !(l.draft && l.draft.approved); }
  function sentToday(l) { return l.draft && sameDay(toDate(l.draft.sentAt), new Date()); }
  function httpUrl(v) { v = String(v || '').trim(); return /^https?:\/\/[^\s]+$/i.test(v) ? v : ''; }
  function digits(v) { return String(v || '').replace(/\D/g, ''); }
  // Número com DDI: 12 ou 13 dígitos começando com 55 ficam como estão; 10 ou 11 ganham o 55.
  function intl(num) {
    var n = digits(num);
    if ((n.length === 12 || n.length === 13) && n.indexOf('55') === 0) return n;
    if (n.length === 10 || n.length === 11) return '55' + n;
    return '';
  }
  function waLink(num, text) {
    var n = intl(num);
    if (!n) return '';
    return 'https://wa.me/' + n + (text ? '?text=' + encodeURIComponent(text) : '');
  }
  // Telefone: com DDD vira +55...; sem DDD (8 ou 9 dígitos) disca como está.
  function telLink(num) {
    var n = intl(num);
    if (n) return 'tel:+' + n;
    n = digits(num);
    return (n.length === 8 || n.length === 9) ? 'tel:' + n : '';
  }
  function instaLink(u) { return /^[A-Za-z0-9._]{1,30}$/.test(u || '') ? 'https://instagram.com/' + u : ''; }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function toLocalInput(d) { return d ? d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()) : ''; }
  function fromLocalInput(v) { if (!v) return null; var d = new Date(v); return isNaN(d) ? null : d; }
  function dueLabel(d) {
    var now = new Date();
    if (sameDay(d, now)) return 'hoje às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    var tm = new Date(now); tm.setDate(tm.getDate() + 1);
    if (sameDay(d, tm)) return 'amanhã';
    return fmtDate(d);
  }
  function slugify(v) {
    return String(v || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
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
  function saveErr(err) {
    console.error(err);
    toast(err && err.code === 'permission-denied'
      ? 'O banco recusou a gravação. Confira se as regras novas foram publicadas.'
      : 'Não foi possível salvar. Tente de novo.', true);
  }

  // =================================================================
  // Filtros na URL (#crm?etapa=...&nicho=...)
  // =================================================================
  var HASH_KEYS = { etapa: 'etapa', niche: 'nicho', origin: 'origem', channel: 'canal', site: 'site', quick: 'ver', q: 'busca' };
  function readHash() {
    var h = location.hash;
    if (h.indexOf('#crm') !== 0) return;
    var qs = h.split('?')[1] || '';
    qs.split('&').forEach(function (pair) {
      var kv = pair.split('='); if (!kv[0]) return;
      Object.keys(HASH_KEYS).forEach(function (k) {
        if (HASH_KEYS[k] === kv[0]) F[k] = decodeURIComponent((kv[1] || '').replace(/\+/g, ' ')).slice(0, 80);
      });
    });
  }
  function writeHash() {
    var parts = [];
    Object.keys(HASH_KEYS).forEach(function (k) { if (F[k]) parts.push(HASH_KEYS[k] + '=' + encodeURIComponent(F[k])); });
    var h = '#crm' + (parts.length ? '?' + parts.join('&') : '');
    if (location.hash !== h) {
      try { history.replaceState(null, '', location.pathname + location.search + (parts.length ? h : '')); } catch (e) {}
    }
  }

  // =================================================================
  // Início
  // =================================================================
  A.register({
    start: function () {
      try { view = localStorage.getItem(STORE_VIEW) || 'board'; } catch (e) {}
      if (['board', 'list', 'sources'].indexOf(view) === -1) view = 'board';
      readHash();
      $('#leadSearch').value = F.q;
      unsubLeads = api.watchLeads(function (list) {
        leads = list.filter(function (l) { return !hidden(l); });
        render();
        if (openId && mode === 'view') {
          var l = find(openId);
          if (l) fill(l); else A.closeDrawer($('#leadDrawer'));
        }
      }, function (err) {
        console.error(err);
        toast('Não foi possível carregar os leads.', true);
      });
    },
    stop: function () {
      if (unsubLeads) unsubLeads();
      unsubLeads = null;
      if (unsubInter) unsubInter();
      unsubInter = null;
    }
  });

  function find(id) { return leads.find(function (x) { return x.id === id; }); }

  // =================================================================
  // Renderização geral
  // =================================================================
  function render() {
    var counts = {};
    STAGES.forEach(function (s) { counts[s.id] = 0; });
    var late = 0, today = 0, sent = 0, approve = 0, novos = 0;
    leads.forEach(function (l) {
      var st = stageOf(l);
      counts[st]++;
      if (isLate(l)) late++;
      if (isToday(l)) today++;
      if (sentToday(l)) sent++;
      if (needsApproval(l)) approve++;
      if (st === 'novo') novos++;
    });

    $('#kLate').textContent = late;
    $('#kToday').textContent = today;
    $('#kSent').textContent = sent;
    $('#kApprove').textContent = approve;
    $$('#crmAlerts [data-quick]').forEach(function (b) {
      var on = F.quick === b.dataset.quick;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    var badge = $('#newBadge');
    badge.hidden = !approve;
    badge.textContent = approve;
    document.title = (novos ? '(' + novos + ') ' : '') + 'Painel | Cron Web Studio';

    // Etapas (contagem e filtro)
    var sHtml = '<button class="stage-chip' + (!F.etapa ? ' is-active' : '') + '" data-etapa="" aria-pressed="' + (!F.etapa) + '">Todas <b>' + leads.length + '</b></button>';
    STAGES.forEach(function (s) {
      var on = F.etapa === s.id;
      sHtml += '<button class="stage-chip' + (on ? ' is-active' : '') + '" data-etapa="' + s.id + '" style="--c:' + s.c + '" aria-pressed="' + on + '">' + s.label + ' <b>' + counts[s.id] + '</b></button>';
    });
    $('#crmStages').innerHTML = sHtml;

    renderFilterOptions();

    $$('.viewsw button').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.view === view ? 'true' : 'false'); });
    $('#crmBoard').hidden = view !== 'board';
    $('#crmList').hidden = view !== 'list';
    $('#crmSources').hidden = view !== 'sources';
    $('#crmStages').hidden = view === 'sources';

    var rows = filtered();
    if (view === 'board') renderBoard(rows);
    if (view === 'list') renderList(rows);
    if (view === 'sources') renderSources(rows);

    var empty = $('#leadsEmpty');
    empty.hidden = view === 'sources' || rows.length > 0;
    $('p', empty).textContent = leads.length ? 'Nenhum lead com esses filtros.'
      : 'Nenhum lead por aqui ainda. Quando alguém preencher o formulário do site, ou você cadastrar um lead, ele aparece aqui na hora.';
    if (view === 'board' && !rows.length) $('#crmBoard').hidden = true;
    writeHash();
  }

  function filtered() {
    var q = F.q.toLowerCase().replace(/[()\-\s@]/g, '');
    return leads.filter(function (l) {
      if (F.etapa && stageOf(l) !== F.etapa) return false;
      if (F.niche && (l.niche || '') !== F.niche) return false;
      if (F.origin && originOf(l) !== F.origin) return false;
      if (F.channel && (l.channel || '') !== F.channel) return false;
      if (F.site && (l.siteStatus || '') !== F.site) return false;
      if (F.quick === 'vencidos' && !isLate(l)) return false;
      if (F.quick === 'hoje' && !isToday(l)) return false;
      if (F.quick === 'aprovar' && !needsApproval(l)) return false;
      if (!q) return true;
      var hay = [l.company, l.name, l.legalName, l.whatsapp, l.phone, l.instagram, l.email, l.companyEmail, l.niche, l.message,
        l.cnpjEmail, l.cnpjPhone, l.linkedin, l.companyLinkedin, l.facebook, l.address, l.currentSite]
        .join(' ').toLowerCase().replace(/[()\-\s@]/g, '');
      return hay.indexOf(q) !== -1;
    }).sort(function (a, b) {
      var da = due(a), db = due(b);
      if (da && db) return da - db;
      if (da) return -1;
      if (db) return 1;
      return (toDate(b.createdAt) || 0) - (toDate(a.createdAt) || 0);
    });
  }

  function renderFilterOptions() {
    var niches = {};
    leads.forEach(function (l) { if (l.niche) niches[l.niche] = 1; });
    var opt = function (list, cur, all) {
      return '<option value="">' + all + '</option>' + list.map(function (o) {
        return '<option value="' + esc(o[0]) + '"' + (o[0] === cur ? ' selected' : '') + '>' + esc(o[1]) + '</option>';
      }).join('');
    };
    $('#fNiche').innerHTML = opt(Object.keys(niches).sort().map(function (n) { return [n, humanize(n)]; }), F.niche, 'Todos os nichos');
    $('#fOrigin').innerHTML = opt(Object.keys(ORIGINS).map(function (k) { return [k, ORIGINS[k]]; }), F.origin, 'Todas as origens');
    $('#fChannel').innerHTML = opt(Object.keys(CHANNELS).map(function (k) { return [k, CHANNELS[k]]; }), F.channel, 'Todos os canais');
    $('#fSite').innerHTML = opt(Object.keys(SITE_ST).map(function (k) { return [k, SITE_ST[k]]; }), F.site, 'Qualquer situação');
    var n = ['niche', 'origin', 'channel', 'site'].filter(function (k) { return F[k]; }).length;
    $('#filtersCount').hidden = !n;
    $('#filtersCount').textContent = n;
  }

  // ---------- Quadro ----------
  function stageSelect(l) {
    var st = stageOf(l);
    return '<select class="stage-sel" data-stage-for="' + esc(l.id) + '" aria-label="Mover ' + esc(title(l)) + ' para outra etapa">' +
      STAGES.map(function (s) { return '<option value="' + s.id + '"' + (s.id === st ? ' selected' : '') + '>' + s.label + '</option>'; }).join('') +
      '</select>';
  }

  function cardHtml(l) {
    var o = originOf(l), d = due(l);
    var chips = [];
    if (l.niche) chips.push('<span class="chip">' + esc(humanize(l.niche)) + '</span>');
    if (l.channel && CHANNELS[l.channel]) chips.push('<span class="chip">' + CHANNELS[l.channel] + '</span>');
    if (l.siteStatus && SITE_ST[l.siteStatus]) chips.push('<span class="chip chip--site-' + l.siteStatus + '">' + SITE_ST[l.siteStatus] + '</span>');
    if (needsApproval(l)) chips.push('<span class="chip chip--lime">Aprovar mensagem</span>');
    var next = '';
    if (l.nextStep && (l.nextStep.text || d)) {
      next = '<p class="card__next' + (isLate(l) ? ' is-late' : (d && sameDay(d, new Date()) ? ' is-today' : '')) + '">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>' +
        '<span>' + esc(l.nextStep.text || 'Próximo passo') + (d ? ' · ' + esc(dueLabel(d)) : '') + '</span></p>';
    }
    var meet = toDate(l.meetingAt);
    if (meet && meet > new Date()) next += '<p class="card__next is-meet"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/></svg><span>Reunião ' + esc(dueLabel(meet)) + '</span></p>';
    var sub = l.company && l.name ? l.name + (l.role ? ' · ' + l.role : '') : (l.role || '');
    return '<article class="card" data-id="' + esc(l.id) + '"' + (canDrag ? ' draggable="true"' : '') + '>' +
      '<button class="card__open" data-open="' + esc(l.id) + '" aria-label="Abrir ' + esc(title(l)) + '"></button>' +
      '<div class="card__top"><strong>' + esc(title(l)) + '</strong><span class="ob ob--' + o + '">' + ORIGINS[o] + '</span></div>' +
      (sub ? '<p class="card__sub">' + esc(sub) + '</p>' : '') +
      (chips.length ? '<div class="card__chips">' + chips.join('') + '</div>' : '') +
      next +
      '<div class="card__foot"><span class="card__age">' + esc(ago(toDate(l.stageAt || l.updatedAt || l.createdAt))) + ' na etapa</span>' + stageSelect(l) + '</div>' +
    '</article>';
  }

  function renderBoard(rows) {
    var cols = F.etapa ? [BY[F.etapa]] : STAGES;
    $('#crmBoard').innerHTML = cols.map(function (s) {
      var items = rows.filter(function (l) { return stageOf(l) === s.id; });
      return '<section class="col" data-col="' + s.id + '" aria-label="' + s.label + '">' +
        '<header class="col__head" style="--c:' + s.c + '"><span>' + s.label + '</span><b>' + items.length + '</b></header>' +
        '<div class="col__list">' + (items.length ? items.map(cardHtml).join('') : '<p class="col__empty">Nada aqui.</p>') + '</div>' +
      '</section>';
    }).join('');
  }

  // ---------- Lista ----------
  function renderList(rows) {
    $('#leadRows').innerHTML = rows.map(function (l) {
      var st = BY[stageOf(l)], d = due(l);
      var sub = [l.company && l.name ? l.name : '', l.niche ? humanize(l.niche) : '', fmtPhone(l.whatsapp)].filter(Boolean).join(' · ');
      return '<tr data-id="' + esc(l.id) + '" class="' + (st.id === 'novo' ? 'is-new' : '') + '" tabindex="0">' +
        '<td><div class="lead-cell"><span class="avatar">' + esc(initials(title(l))) + '</span><div><strong>' + esc(title(l)) + '</strong><small>' + esc(sub) + '</small></div></div></td>' +
        '<td><span class="pill" style="--c:' + st.c + '">' + st.label + '</span></td>' +
        '<td><span class="src">' + ORIGINS[originOf(l)] + (originOf(l) === 'site' && l.source ? ' · ' + esc(sourceName(l.source)) : '') + '</span></td>' +
        '<td class="' + (isLate(l) ? 'td-late' : 'td-muted') + '">' + (l.nextStep && (l.nextStep.text || d) ? esc((l.nextStep.text || '') + (d ? ' · ' + dueLabel(d) : '')) : 'Sem prazo') + '</td>' +
        '<td class="td-muted">' + (SITE_ST[l.siteStatus] || 'Não avaliado') + '</td>' +
        '<td class="td-muted">' + esc(ago(toDate(l.stageAt || l.updatedAt || l.createdAt))) + '</td>' +
      '</tr>';
    }).join('');
  }

  // ---------- Origens ----------
  function rank(map, nameFn) {
    var list = Object.keys(map).map(function (k) { return { k: k, n: map[k] }; }).sort(function (a, b) { return b.n - a.n; }).slice(0, 7);
    var top = list.length ? list[0].n : 1;
    return list.length ? list.map(function (s) {
      return '<li><div class="row"><span>' + esc(nameFn(s.k)) + '</span><b>' + s.n + '</b></div><div class="bar"><i style="width:' + Math.round(s.n / top * 100) + '%"></i></div></li>';
    }).join('') : '<li class="none">Sem dados ainda.</li>';
  }
  function renderSources(rows) {
    var bySrc = {}, byOrigin = {}, byLost = {}, counts = {};
    STAGES.forEach(function (s) { counts[s.id] = 0; });
    rows.forEach(function (l) {
      var o = originOf(l);
      byOrigin[o] = (byOrigin[o] || 0) + 1;
      if (o === 'site') { var k = l.source || 'direto'; bySrc[k] = (bySrc[k] || 0) + 1; }
      counts[stageOf(l)]++;
      if (stageOf(l) === 'perdido' && l.lostReason) byLost[l.lostReason] = (byLost[l.lostReason] || 0) + 1;
    });
    $('#sourceList').innerHTML = rank(bySrc, sourceName);
    $('#originList').innerHTML = rank(byOrigin, function (k) { return ORIGINS[k]; });
    $('#lostList').innerHTML = rank(byLost, function (k) { return k; });
    $('#funnel').innerHTML = STAGES.map(function (s) {
      return '<div><span style="--c:' + s.c + '">' + s.label + '</span><b>' + counts[s.id] + '</b></div>';
    }).join('');
  }

  // =================================================================
  // Eventos da aba
  // =================================================================
  $('#crmStages').addEventListener('click', function (e) {
    var b = e.target.closest('[data-etapa]');
    if (!b) return;
    F.etapa = F.etapa === b.dataset.etapa ? '' : b.dataset.etapa;
    render();
  });
  $('#crmAlerts').addEventListener('click', function (e) {
    var b = e.target.closest('[data-quick]');
    if (!b) return;
    F.quick = F.quick === b.dataset.quick ? '' : b.dataset.quick;
    render();
  });
  $$('.viewsw button').forEach(function (b) {
    b.addEventListener('click', function () {
      view = b.dataset.view;
      try { localStorage.setItem(STORE_VIEW, view); } catch (e) {}
      render();
    });
  });
  $('#leadSearch').addEventListener('input', function () { F.q = this.value.trim().slice(0, 80); render(); });
  $('#filtersToggle').addEventListener('click', function () {
    var box = $('#crmFilters'), open = box.hidden;
    box.hidden = !open;
    this.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  [['#fNiche', 'niche'], ['#fOrigin', 'origin'], ['#fChannel', 'channel'], ['#fSite', 'site']].forEach(function (p) {
    $(p[0]).addEventListener('change', function () { F[p[1]] = this.value; render(); });
  });
  $('#filtersClear').addEventListener('click', function () {
    F.niche = F.origin = F.channel = F.site = F.quick = F.etapa = F.q = '';
    $('#leadSearch').value = '';
    render();
  });
  $('#crmSettingsBtn').addEventListener('click', function () {
    var box = $('#crmSettings'), open = box.hidden;
    box.hidden = !open;
    this.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  $('#migrateBtn').addEventListener('click', function () {
    var btn = this;
    confirmBox('Atualizar etapas antigas?', 'Os leads com a etapa "contato" passam a gravar "Em conversa". Nada é apagado e dá para rodar de novo sem problema.', 'Atualizar')
      .then(function (ok) {
        if (!ok) return;
        btn.disabled = true;
        $('#migrateInfo').textContent = 'Atualizando…';
        api.migrateLegacyStatus().then(function (n) {
          $('#migrateInfo').textContent = n ? n + (n === 1 ? ' lead atualizado.' : ' leads atualizados.') : 'Nenhum lead com etapa antiga.';
        }).catch(function (err) { $('#migrateInfo').textContent = ''; saveErr(err); })
          .then(function () { btn.disabled = false; });
      });
  });

  // Quadro: abrir card, trocar etapa pelo seletor, arrastar no computador
  var board = $('#crmBoard');
  board.addEventListener('click', function (e) {
    var b = e.target.closest('[data-open]');
    if (b) openLead(b.dataset.open);
  });
  board.addEventListener('change', function (e) {
    var sel = e.target.closest('[data-stage-for]');
    if (!sel) return;
    var l = find(sel.dataset.stageFor);
    if (l) changeStage(l, sel.value).then(function (ok) { if (!ok) sel.value = stageOf(l); });
  });
  if (canDrag) {
    var dragId = null;
    board.addEventListener('dragstart', function (e) {
      var card = e.target.closest('.card');
      if (!card) return;
      dragId = card.dataset.id;
      card.classList.add('is-drag');
      e.dataTransfer.effectAllowed = 'move';
      try { e.dataTransfer.setData('text/plain', dragId); } catch (err) {}
    });
    board.addEventListener('dragend', function (e) {
      var card = e.target.closest('.card');
      if (card) card.classList.remove('is-drag');
      $$('.col.is-over', board).forEach(function (c) { c.classList.remove('is-over'); });
    });
    board.addEventListener('dragover', function (e) {
      var col = e.target.closest('.col');
      if (!col || !dragId) return;
      e.preventDefault();
      $$('.col.is-over', board).forEach(function (c) { if (c !== col) c.classList.remove('is-over'); });
      col.classList.add('is-over');
    });
    board.addEventListener('drop', function (e) {
      var col = e.target.closest('.col');
      if (!col || !dragId) return;
      e.preventDefault();
      col.classList.remove('is-over');
      var l = find(dragId);
      dragId = null;
      if (l) changeStage(l, col.dataset.col);
    });
  }

  $('#leadRows').addEventListener('click', function (e) {
    var tr = e.target.closest('tr[data-id]');
    if (tr) openLead(tr.dataset.id);
  });
  $('#leadRows').addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') return;
    var tr = e.target.closest('tr[data-id]');
    if (tr) openLead(tr.dataset.id);
  });

  // =================================================================
  // Etapas
  // =================================================================
  // Resolve true se mudou. Mover para Perdido pede o motivo.
  function changeStage(l, to) {
    var from = stageOf(l);
    if (!BY[to] || to === from && l.status === to) return Promise.resolve(false);
    var ask = to === 'perdido'
      ? promptBox('Por que foi perdido?', 'O motivo ajuda a entender o que ajustar na abordagem.', { required: true, requiredMsg: 'Escreva o motivo da perda.', placeholder: 'Ex.: achou caro, fechou com outro, sem retorno', value: l.lostReason || '' })
      : Promise.resolve('');
    return ask.then(function (reason) {
      if (reason === null) return false;
      var data = { status: to, stageAt: api.now() };
      if (to === 'perdido') data.lostReason = reason.slice(0, 300);
      return api.updateLead(l.id, data, [{ type: 'mudanca_etapa', from: from, to: to }])
        .then(function () { toast('Etapa: ' + BY[to].label); return true; })
        .catch(function (err) { saveErr(err); return false; });
    });
  }

  // =================================================================
  // Gaveta do lead
  // =================================================================
  var drawer = $('#leadDrawer');
  drawer.addEventListener('drawer:closed', function () {
    openId = null;
    if (unsubInter) unsubInter();
    unsubInter = null;
    interList = [];
  });

  // Depois de salvar, redesenha com o que está no banco (a escuta pode ter chegado antes)
  function refill(key) {
    dirty[key] = false;
    var l = find(openId);
    if (l && mode === 'view') fill(l);
  }

  function resetDirty() { dirty = { next: false, draft: false, form: false, notes: false }; }

  function openLead(id) {
    var l = find(id);
    if (!l) return;
    if (unsubInter) unsubInter();
    openId = id;
    mode = 'view';
    resetDirty();
    interList = [];
    setMode('view');
    fill(l);
    A.openDrawer(drawer);
    unsubInter = api.watchInteractions(id, function (list) {
      interList = list;
      renderTimeline();
    }, function (err) { console.error(err); });
  }

  function setMode(m) {
    mode = m;
    $('#ldView').hidden = m !== 'view';
    $('#ldView2').hidden = m !== 'view';
    $('#ldCreate').hidden = m !== 'create';
    $('#ldSave').textContent = m === 'create' ? 'Cadastrar lead' : 'Salvar dados';
    $('#ldFormMsg').textContent = '';
    $('#ldSaved').textContent = '';
  }

  $('#newLead').addEventListener('click', function () {
    if (unsubInter) unsubInter();
    unsubInter = null;
    openId = null;
    resetDirty();
    setMode('create');
    $('#ldDate').textContent = 'Cadastro manual';
    $('#ldName').textContent = 'Novo lead';
    $('#ldSub').textContent = 'Indicação ou contato que chegou fora do site.';
    $('#ldCreateStage').innerHTML = STAGES.filter(function (s) { return !CLOSED[s.id]; }).map(function (s) {
      return '<option value="' + s.id + '">' + s.label + '</option>';
    }).join('');
    $('#ldCreateOrigin').value = 'manual';
    renderFields({}, true);
    A.openDrawer(drawer);
    setTimeout(function () { var c = $('#ldForm [name="company"]'); if (c) c.focus(); }, 300);
  });

  function fill(l) {
    var created = toDate(l.createdAt);
    var o = originOf(l);
    $('#ldDate').textContent = (o === 'site' ? 'Recebido ' : 'Cadastrado ') + fmtDate(created, true);
    $('#ldName').textContent = title(l);
    var sub = [l.company && l.name ? l.name : '', l.role, ORIGINS[o] + (o === 'site' && l.source ? ' · ' + sourceName(l.source) : '')].filter(Boolean).join(' · ');
    $('#ldSub').textContent = sub;

    renderActions(l);

    // Etapa
    var st = stageOf(l);
    $('#ldStage').innerHTML = STAGES.map(function (s) {
      return '<option value="' + s.id + '"' + (s.id === st ? ' selected' : '') + '>' + s.label + '</option>';
    }).join('');
    var lost = $('#ldLost');
    lost.hidden = !(st === 'perdido' && l.lostReason);
    lost.textContent = l.lostReason ? 'Motivo: ' + l.lostReason : '';

    // Próximo passo
    if (!dirty.next) {
      $('#ldNextText').value = l.nextStep && l.nextStep.text || '';
      $('#ldNextDue').value = toLocalInput(due(l));
      $('#ldMeeting').value = toLocalInput(toDate(l.meetingAt));
    }
    $('#ldNextDone').hidden = !l.nextStep;

    // Mensagem
    if (!dirty.draft) {
      var dr = l.draft || {};
      draftChannel = dr.channel || l.channel || (l.whatsapp ? 'whatsapp' : (l.instagram ? 'instagram' : 'email'));
      $('#ldDraftText').value = dr.text || (o === 'site' ? suggest(l) : '');
    }
    renderDraftState(l);

    // Campos
    if (!dirty.form) renderFields(l, false);

    // Dados do site
    $('#ldMsgWrap').hidden = !l.message;
    $('#ldMsg').textContent = l.message || '';
    var utm = l.utm || {};
    var utmTxt = Object.keys(utm).map(function (k) { return k + ': ' + utm[k]; }).join(' · ');
    var facts = [
      o === 'site' ? ['Botão do site', sourceName(l.source) + (l.sourceLabel ? ' (“' + l.sourceLabel + '”)' : ''), true] : null,
      l.project ? ['Projeto de referência', l.project, true] : null,
      utmTxt ? ['Campanha (UTM)', utmTxt, true] : null,
      l.referrer ? ['Veio de', l.referrer, true] : null,
      l.sources ? ['De onde veio cada dado', Object.keys(l.sources).map(function (k) { return k + ': ' + (DATA_SRC[l.sources[k]] || l.sources[k]); }).join(' · '), true] : null,
      l.updatedAt ? ['Última atualização', fmtDate(toDate(l.updatedAt), true)] : null
    ].filter(Boolean);
    $('#ldFacts').hidden = !facts.length;
    $('#ldFacts').innerHTML = facts.map(function (f) {
      return '<div class="' + (f[2] ? 'full' : '') + '"><dt>' + esc(f[0]) + '</dt><dd>' + esc(f[1]) + '</dd></div>';
    }).join('');

    if (!dirty.notes) {
      $('#ldNotes').value = l.notes || '';
      $('#ldNotesSaved').textContent = '';
    }

    var cAt = toDate(l.consentAt);
    $('#ldConsentBox').hidden = !('consent' in l);
    $('#ldConsent').textContent = (l.consent ? 'Aceito' : 'Não registrado') +
      (cAt ? ' em ' + fmtDate(cAt, true) : '') + (l.consentText ? '. Texto: “' + l.consentText + '”' : '') +
      (l.page ? ' Página: ' + l.page : '');
    renderTimeline();
  }

  function suggest(l) {
    return 'Oi, ' + (firstName(l.name) || 'tudo bem') + '! Aqui é o Pedro, da Cron. Recebi seu contato pelo site' +
      (l.project ? ' sobre um projeto como o da ' + l.project : '') + '. Me conta um pouco de como funciona a ' + (l.company || 'empresa') + ' hoje?';
  }

  var ICONS = {
    wa: '<svg viewBox="0 0 24 24"><path d="M4 20l1.3-3.9A8 8 0 1 1 8 18.8L4 20Z"/></svg>',
    insta: '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="4.5"/><circle cx="12" cy="12" r="3.6"/><circle cx="16.8" cy="7.2" r=".6"/></svg>',
    copy: '<svg viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>',
    mail: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m4 7 8 6 8-6"/></svg>',
    tel: '<svg viewBox="0 0 24 24"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z"/></svg>',
    url: '<svg viewBox="0 0 24 24"><path d="M14 4h6v6M20 4l-9 9M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4"/></svg>',
    preview: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="14" rx="2.5"/><path d="M3 9h18M8 21h8"/></svg>'
  };

  function renderActions(l) {
    var dr = l.draft || {};
    var text = dr.approved ? dr.text : '';
    var html = '';
    var wa = waLink(l.whatsapp, text);
    if (wa) html += '<a class="btn btn--lime" href="' + esc(wa) + '" target="_blank" rel="noopener noreferrer">' + ICONS.wa + 'Abrir WhatsApp</a>';
    var ig = instaLink(l.instagram);
    if (ig) html += '<a class="btn btn--ghost" href="' + esc(ig) + '" target="_blank" rel="noopener noreferrer">' + ICONS.insta + 'Abrir Instagram</a>';
    if (dr.text) html += '<button class="btn btn--ghost" type="button" data-copy-draft>' + ICONS.copy + 'Copiar mensagem</button>';
    var em = l.email || l.companyEmail;
    if (em) html += '<a class="btn btn--ghost" href="mailto:' + esc(em) + '?subject=' + encodeURIComponent('Cron Web Studio') + (text && dr.channel === 'email' ? '&body=' + encodeURIComponent(text) : '') + '">' + ICONS.mail + 'E-mail</a>';
    var tel = telLink(l.phone) || telLink(l.whatsapp);
    if (tel) html += '<a class="btn btn--ghost" href="' + esc(tel) + '">' + ICONS.tel + 'Ligar</a>';
    if (l.previewId && /^[A-Za-z0-9]{1,40}$/.test(l.previewId)) html += '<a class="btn btn--ghost" href="modelo/?id=' + esc(l.previewId) + '" target="_blank" rel="noopener">' + ICONS.preview + 'Site modelo</a>';
    $('#ldActions').innerHTML = html || '<p class="muted">Sem contato cadastrado. Preencha WhatsApp, Instagram ou e-mail abaixo.</p>';
  }

  $('#ldActions').addEventListener('click', function (e) {
    if (!e.target.closest('[data-copy-draft]')) return;
    var l = find(openId);
    var t = $('#ldDraftText').value.trim() || (l && l.draft && l.draft.text) || '';
    copy(t).then(function () { toast('Mensagem copiada'); }, function () { toast('Não foi possível copiar.', true); });
  });

  // ---------- Etapa pela gaveta ----------
  $('#ldStage').addEventListener('change', function () {
    var l = find(openId), sel = this;
    if (!l) return;
    changeStage(l, sel.value).then(function (ok) { if (!ok) sel.value = stageOf(l); });
  });

  // ---------- Próximo passo e reunião ----------
  ['#ldNextText', '#ldNextDue', '#ldMeeting'].forEach(function (s) {
    $(s).addEventListener('input', function () { dirty.next = true; });
  });
  $('#ldNextSave').addEventListener('click', function () {
    var l = find(openId);
    if (!l) return;
    var text = $('#ldNextText').value.trim().slice(0, 300);
    var dueAt = fromLocalInput($('#ldNextDue').value);
    var meet = fromLocalInput($('#ldMeeting').value);
    var data = {}, inters = [];
    data.nextStep = (text || dueAt) ? { text: text, dueAt: dueAt } : api.del();
    var oldMeet = toDate(l.meetingAt);
    if (meet) {
      data.meetingAt = meet;
      if (!oldMeet || oldMeet.getTime() !== meet.getTime()) inters.push({ type: 'reuniao', text: 'Reunião marcada para ' + fmtDate(meet, true) + '.' });
    } else if (oldMeet) {
      data.meetingAt = api.del();
    }
    var btn = this;
    btn.disabled = true;
    api.updateLead(l.id, data, inters).then(function () {
      refill('next');
      toast('Próximo passo salvo');
    }).catch(saveErr).then(function () { btn.disabled = false; });
  });
  $('#ldNextDone').addEventListener('click', function () {
    var l = find(openId);
    if (!l || !l.nextStep) return;
    api.updateLead(l.id, { nextStep: api.del() }, [{ type: 'nota', text: 'Concluído: ' + (l.nextStep.text || 'próximo passo') }])
      .then(function () { refill('next'); toast('Próximo passo concluído'); })
      .catch(saveErr);
  });

  // ---------- Mensagem de abordagem ----------
  function renderDraftState(l) {
    var dr = l.draft || {};
    $('#ldDraftChannel').innerHTML = Object.keys(CHANNELS).map(function (k) {
      return '<button type="button" data-ch="' + k + '" class="' + (k === draftChannel ? 'is-active' : '') + '" aria-pressed="' + (k === draftChannel) + '">' + CHANNELS[k] + '</button>';
    }).join('');
    var state = '', cls = '';
    if (dr.sentAt) { state = 'Enviada ' + fmtDate(toDate(dr.sentAt), true); cls = 'is-sent'; }
    else if (dr.approved && !dirty.draft) { state = 'Aprovada'; cls = 'is-ok'; }
    else if (dr.text) { state = 'Aguardando aprovação'; cls = 'is-wait'; }
    else state = 'Sem mensagem salva';
    var el = $('#ldDraftState');
    el.textContent = state;
    el.className = 'draft-state ' + cls;
    $('#ldDraftApprove').disabled = !!(dr.approved && !dirty.draft);
    $('#ldDraftSent').disabled = !(dr.approved && !dirty.draft) || !!dr.sentAt;
    $('#ldDraftSent').textContent = dr.sentAt ? 'Já enviada' : 'Marcar como enviada';
  }
  $('#ldDraftText').addEventListener('input', function () {
    dirty.draft = true;
    var l = find(openId);
    if (l) renderDraftState(l);
  });
  $('#ldDraftChannel').addEventListener('click', function (e) {
    var b = e.target.closest('[data-ch]');
    if (!b) return;
    draftChannel = b.dataset.ch;
    dirty.draft = true;
    var l = find(openId);
    if (l) renderDraftState(l);
  });
  function draftText() {
    var t = $('#ldDraftText').value.trim();
    if (t.length < 2) { toast('Escreva a mensagem antes.', true); $('#ldDraftText').focus(); return null; }
    return t.slice(0, 2000);
  }
  // Editar o texto sempre volta para "aguardando aprovação"
  $('#ldDraftSave').addEventListener('click', function () {
    var l = find(openId), t = draftText();
    if (!l || !t) return;
    api.updateLead(l.id, { 'draft.text': t, 'draft.channel': draftChannel, 'draft.approved': false, 'draft.approvedAt': api.del() })
      .then(function () { refill('draft'); toast('Texto salvo, aguardando aprovação'); })
      .catch(saveErr);
  });
  $('#ldDraftApprove').addEventListener('click', function () {
    var l = find(openId), t = draftText();
    if (!l || !t) return;
    api.updateLead(l.id, { 'draft.text': t, 'draft.channel': draftChannel, 'draft.approved': true, 'draft.approvedAt': api.now() })
      .then(function () { refill('draft'); toast('Mensagem aprovada'); })
      .catch(saveErr);
  });
  $('#ldDraftSent').addEventListener('click', function () {
    var l = find(openId);
    if (!l || !l.draft || !l.draft.approved || l.draft.sentAt) return;
    var from = stageOf(l);
    var data = { 'draft.sentAt': api.now() };
    var inters = [{ type: 'mensagem_enviada', text: l.draft.text || '', channel: l.draft.channel || '' }];
    if (from !== 'abordado' && !CLOSED[from]) {
      data.status = 'abordado';
      data.stageAt = api.now();
      inters.push({ type: 'mudanca_etapa', from: from, to: 'abordado' });
    }
    api.updateLead(l.id, data, inters).then(function () { toast('Marcada como enviada'); }).catch(saveErr);
  });

  // ---------- Histórico ----------
  function renderTimeline() {
    var ol = $('#ldTimeline');
    if (!interList.length) { ol.innerHTML = '<li class="tl-empty">Nenhum registro ainda.</li>'; return; }
    ol.innerHTML = interList.map(function (it) {
      var d = toDate(it.createdAt);
      var body = '';
      if (it.type === 'mudanca_etapa') {
        var f = BY[LEGACY[it.from] || it.from], t = BY[LEGACY[it.to] || it.to];
        body = '<p>' + esc((f ? f.label : it.from || '?') + ' para ' + (t ? t.label : it.to || '?')) + '</p>';
      } else if (it.text) {
        body = '<p>' + esc(it.text) + '</p>';
      }
      var who = it.createdBy === 'cronus' ? ' · CronUS' : '';
      var ch = it.channel && CHANNELS[it.channel] ? ' · ' + CHANNELS[it.channel] : '';
      return '<li class="tl tl--' + esc(it.type) + '"><div class="tl__head"><strong>' + esc(INTER[it.type] || it.type) + '</strong><span>' + esc((d ? fmtDate(d, true) : 'agora') + ch + who) + '</span></div>' + body + '</li>';
    }).join('');
  }
  $('#ldNoteAdd').addEventListener('click', function () {
    var t = $('#ldNoteNew').value.trim();
    if (!openId || t.length < 2) { toast('Escreva o registro antes.', true); return; }
    var btn = this;
    btn.disabled = true;
    api.addInteraction(openId, { type: $('#ldNoteType').value, text: t.slice(0, 2000) }).then(function () {
      $('#ldNoteNew').value = '';
      toast('Registro adicionado');
    }).catch(saveErr).then(function () { btn.disabled = false; });
  });

  // ---------- Campos ----------
  function fieldValue(l, f) {
    var v = l[f.k];
    if (v == null) return '';
    if (f.type === 'lines') return (Array.isArray(v) ? v : []).join('\n');
    return String(v);
  }
  function linkFor(f, v) {
    if (!v) return '';
    if (f.link === 'url') return httpUrl(v);
    if (f.link === 'mail') return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v) ? 'mailto:' + v : '';
    if (f.link === 'tel') return telLink(v);
    if (f.link === 'wa') return waLink(v, '');
    if (f.link === 'insta') return instaLink(v);
    return '';
  }
  function renderFields(l, creating) {
    var html = GROUPS.map(function (g) {
      var items = FIELDS.filter(function (f) { return f.g === g && !(creating && (f.noCreate || f.type === 'ro')); });
      if (!items.length) return '';
      return '<fieldset class="ld-group"><legend>' + g + '</legend><div class="ld-grid">' + items.map(function (f) {
        var v = fieldValue(l, f), id = 'fld-' + f.k, input;
        var attrs = ' id="' + id + '" name="' + f.k + '"' + (f.ph ? ' placeholder="' + esc(f.ph) + '"' : '');
        if (f.type === 'select') {
          input = '<select' + attrs + '>' + f.opts.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === v ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>';
        } else if (f.type === 'textarea' || f.type === 'lines') {
          input = '<textarea' + attrs + ' rows="2"' + (f.max ? ' maxlength="' + f.max + '"' : '') + '>' + esc(v) + '</textarea>';
        } else if (f.type === 'ro') {
          input = '<input' + attrs + ' value="' + esc(v) + '" placeholder="Vazio" readonly tabindex="-1">';
        } else {
          var t = f.type === 'email' ? 'email' : (f.type === 'url' ? 'url' : (f.type === 'digits' ? 'tel' : 'text'));
          var im = (f.type === 'int' || f.type === 'digits') ? ' inputmode="numeric"' : (f.type === 'num' ? ' inputmode="decimal"' : '');
          input = '<input type="' + t + '"' + attrs + im + ' value="' + esc(v) + '"' + (f.max && f.type === 'text' ? ' maxlength="' + f.max + '"' : '') + ' autocomplete="off">';
        }
        var tools = '';
        if (!creating && v && f.type !== 'ro' && f.type !== 'select') {
          var href = f.type === 'lines' ? '' : linkFor(f, v);
          tools = '<span class="fld-tools">' +
            '<button type="button" class="mini" data-copy="' + f.k + '" aria-label="Copiar ' + esc(f.label) + '">' + ICONS.copy + '</button>' +
            (href ? '<a class="mini" href="' + esc(href) + '"' + (/^https?:/.test(href) ? ' target="_blank" rel="noopener noreferrer"' : '') + ' aria-label="Abrir ' + esc(f.label) + '">' + ICONS[f.link === 'wa' ? 'wa' : (f.link === 'insta' ? 'insta' : (f.link || 'url'))] + '</a>' : '') +
          '</span>';
        }
        var src = l.sources && l.sources[f.k] ? '<em>' + esc(DATA_SRC[l.sources[f.k]] || l.sources[f.k]) + '</em>' : '';
        return '<label class="f' + (f.full ? ' f--full' : '') + '" for="' + id + '"><span>' + esc(f.label) + src + '</span><span class="fld">' + input + tools + '</span></label>';
      }).join('') + '</div></fieldset>';
    }).join('');
    $('#ldFields').innerHTML = html;
  }

  $('#ldFields').addEventListener('input', function (e) {
    dirty.form = true;
    var f = e.target.closest('.f');
    if (f) f.classList.remove('is-invalid');
    $('#ldFormMsg').textContent = '';
  });
  $('#ldFields').addEventListener('click', function (e) {
    var b = e.target.closest('[data-copy]');
    if (!b) return;
    e.preventDefault();
    var input = $('#fld-' + b.dataset.copy);
    copy(input ? input.value : '').then(function () { toast('Copiado'); }, function () { toast('Não foi possível copiar.', true); });
  });

  // Limpa e valida um campo. Retorna { ok, v } onde v === undefined quer dizer "vazio".
  function clean(f, raw) {
    raw = String(raw == null ? '' : raw).trim();
    var v = raw;
    switch (f.type) {
      case 'text': case 'textarea': v = raw.slice(0, f.max); return { ok: true, v: v };
      case 'email': v = raw.toLowerCase(); return { ok: !v || (v.length <= 160 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)), v: v };
      case 'url':
        if (!v) return { ok: true, v: '' };
        if (!/^https?:\/\//i.test(v)) v = 'https://' + v;
        return { ok: v.length <= 300 && /^https?:\/\/[^\s]+$/i.test(v), v: v };
      case 'digits':
        v = digits(raw);
        return { ok: !v || (v.length >= f.len[0] && v.length <= f.len[1]), v: v };
      case 'insta':
        v = raw.replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/^@/, '').replace(/\/.*$/, '').replace(/\?.*$/, '');
        return { ok: /^[A-Za-z0-9._]{0,30}$/.test(v), v: v };
      case 'slug': v = slugify(raw); return { ok: true, v: v };
      case 'uf': v = raw.toUpperCase(); return { ok: /^([A-Z]{2})?$/.test(v), v: v };
      case 'id': return { ok: /^[A-Za-z0-9]{0,40}$/.test(v), v: v };
      case 'int':
        if (!raw) return { ok: true, v: undefined };
        v = Number(raw);
        return { ok: Number.isInteger(v) && v >= f.min && v <= f.max, v: v };
      case 'num':
        if (!raw) return { ok: true, v: undefined };
        v = Number(raw.replace(',', '.'));
        return { ok: !isNaN(v) && v >= f.min && v <= f.max, v: Math.round(v * 10) / 10 };
      case 'select': return { ok: !f.opts || f.opts.some(function (o) { return o[0] === raw; }), v: raw };
      case 'lines':
        var list = raw.split(/\n+/).map(function (x) { x = x.trim(); if (x && !/^https?:\/\//i.test(x)) x = 'https://' + x; return x; })
          .filter(function (x) { return /^https?:\/\/[^\s]+$/i.test(x) && x.length <= 300; });
        return { ok: list.length <= 10, v: list.slice(0, 10) };
    }
    return { ok: true, v: v };
  }

  $('#ldForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var form = this;
    var l = mode === 'create' ? {} : find(openId);
    if (!l) return;
    var data = {}, bad = [];
    FIELDS.forEach(function (f) {
      if (f.type === 'ro') return;
      var el = form.elements[f.k];
      if (!el) return;
      var r = clean(f, el.value);
      if (!r.ok) { bad.push(f); el.closest('.f').classList.add('is-invalid'); return; }
      var has = Object.prototype.hasOwnProperty.call(l, f.k);
      if (mode === 'create') {
        if (r.v === undefined || r.v === '' || (Array.isArray(r.v) && !r.v.length)) return;
        data[f.k] = r.v;
        return;
      }
      var old = l[f.k];
      if (r.v === undefined) { if (has) data[f.k] = api.del(); return; }
      if (JSON.stringify(old === undefined ? (Array.isArray(r.v) ? [] : '') : old) === JSON.stringify(r.v)) return;
      if (!has && (r.v === '' || (Array.isArray(r.v) && !r.v.length))) return;
      data[f.k] = r.v;
    });
    var msg = $('#ldFormMsg');
    if (bad.length) {
      msg.textContent = 'Confira: ' + bad.map(function (f) { return f.label; }).join(', ') + '.';
      return;
    }
    var btn = $('#ldSave');
    if (mode === 'create') {
      if (!((data.name || '').length >= 2 || (data.company || '').length >= 2)) {
        msg.textContent = 'Preencha a empresa ou o nome do contato.';
        return;
      }
      data.origin = $('#ldCreateOrigin').value === 'indicacao' ? 'indicacao' : 'manual';
      data.status = BY[$('#ldCreateStage').value] ? $('#ldCreateStage').value : 'novo';
      if (!data.owner) data.owner = 'pedro';
      data.notes = '';
      btn.disabled = true;
      api.createLead(data, []).then(function (id) {
        toast('Lead cadastrado');
        dirty.form = false;
        // abre o lead recém-criado assim que ele chegar pela escuta
        var tries = 0;
        (function waitOpen() {
          if (find(id)) { openLead(id); return; }
          if (++tries < 20) setTimeout(waitOpen, 150);
          else A.closeDrawer(drawer);
        })();
      }).catch(saveErr).then(function () { btn.disabled = false; });
      return;
    }
    if (!Object.keys(data).length) { msg.textContent = ''; $('#ldSaved').textContent = 'Nada mudou.'; dirty.form = false; return; }
    var nameAfter = 'name' in data ? data.name : l.name, compAfter = 'company' in data ? data.company : l.company;
    if (!((nameAfter || '').length >= 2 || (compAfter || '').length >= 2)) { msg.textContent = 'O lead precisa de empresa ou nome do contato.'; return; }
    btn.disabled = true;
    api.updateLead(l.id, data).then(function () {
      refill('form');
      $('#ldSaved').textContent = 'Salvo ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      toast('Dados salvos');
    }).catch(saveErr).then(function () { btn.disabled = false; });
  });

  // ---------- Anotações e exclusão ----------
  $('#ldNotes').addEventListener('input', function () { dirty.notes = true; });
  $('#ldSaveNotes').addEventListener('click', function () {
    if (!openId) return;
    var btn = this;
    btn.disabled = true;
    api.updateLead(openId, { notes: $('#ldNotes').value.slice(0, 5000) }).then(function () {
      refill('notes');
      $('#ldNotesSaved').textContent = 'Salvo ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      toast('Anotações salvas');
    }).catch(saveErr).then(function () { btn.disabled = false; });
  });
  $('#ldDelete').addEventListener('click', function () {
    var l = find(openId);
    if (!l) return;
    confirmBox('Excluir este lead?', 'Os dados de ' + title(l) + ' serão apagados de vez. Use também quando a pessoa pedir exclusão pela LGPD.')
      .then(function (ok) {
        if (!ok) return;
        var id = openId;
        A.closeDrawer(drawer);
        api.deleteLead(id).then(function () { toast('Lead excluído'); })
          .catch(function () { toast('Não foi possível excluir.', true); });
      });
  });

  // =================================================================
  // CSV (todos os campos, respeitando os filtros)
  // =================================================================
  $('#exportCsv').addEventListener('click', function () {
    var rows = filtered();
    if (!rows.length) { toast('Nada para exportar.', true); return; }
    var dt = function (v) { var d = toDate(v); return d ? fmtDate(d, true) : ''; };
    var cols = [
      ['Data', function (l) { return dt(l.createdAt); }],
      ['Empresa', 'company'], ['Razão social', 'legalName'], ['Contato', 'name'], ['Cargo', 'role'],
      ['WhatsApp', function (l) { return fmtPhone(l.whatsapp); }], ['Telefone', function (l) { return fmtPhone(l.phone); }],
      ['E-mail', 'email'], ['E-mail da empresa', 'companyEmail'], ['Instagram', 'instagram'],
      ['LinkedIn', 'linkedin'], ['LinkedIn da empresa', 'companyLinkedin'], ['Facebook', 'facebook'], ['Google', 'googleMapsUrl'],
      ['CNPJ', 'cnpj'], ['E-mail do CNPJ', 'cnpjEmail'], ['Telefone do CNPJ', function (l) { return fmtPhone(l.cnpjPhone); }],
      ['Anos de empresa', 'companyYears'], ['Cidade', 'city'], ['UF', 'state'], ['Endereço', 'address'],
      ['Nicho', 'niche'], ['Origem', function (l) { return ORIGINS[originOf(l)]; }],
      ['Botão do site', function (l) { return originOf(l) === 'site' ? sourceName(l.source) : ''; }],
      ['Etapa', function (l) { return BY[stageOf(l)].label; }],
      ['Canal', function (l) { return CHANNELS[l.channel] || ''; }],
      ['Site atual', 'currentSite'], ['Situação do site', function (l) { return SITE_ST[l.siteStatus] || ''; }],
      ['Nota do site', 'siteScore'], ['Motivo do site', 'siteReason'],
      ['Nota Google', 'googleRating'], ['Avaliações Google', 'googleReviews'],
      ['Precisa de', function (l) { return NEED[l.need] || ''; }], ['Encaixe', 'fitReason'],
      ['Mensagem do site', 'message'],
      ['Mensagem de abordagem', function (l) { return l.draft ? l.draft.text : ''; }],
      ['Aprovada', function (l) { return l.draft && l.draft.approved ? 'sim' : ''; }],
      ['Enviada em', function (l) { return l.draft ? dt(l.draft.sentAt) : ''; }],
      ['Próximo passo', function (l) { return l.nextStep ? l.nextStep.text : ''; }],
      ['Prazo', function (l) { return l.nextStep ? dt(l.nextStep.dueAt) : ''; }],
      ['Reunião', function (l) { return dt(l.meetingAt); }], ['Motivo de perda', 'lostReason'],
      ['Responsável', 'owner'], ['Rodada', 'batchId'], ['Site modelo', 'previewId'],
      ['Outros links', function (l) { return (l.otherLinks || []).join(' '); }],
      ['Anotações', 'notes'],
      ['UTM', function (l) { var u = l.utm || {}; return Object.keys(u).map(function (k) { return k + '=' + u[k]; }).join(' '); }],
      ['Consentimento', function (l) { return 'consent' in l ? (l.consent ? 'sim' : 'não') : ''; }]
    ];
    var lines = [cols.map(function (c) { return c[0]; })].concat(rows.map(function (l) {
      return cols.map(function (c) { return typeof c[1] === 'function' ? c[1](l) : l[c[1]]; });
    })).map(function (r) {
      return r.map(function (v) {
        var s = String(v == null ? '' : v).replace(/"/g, '""').replace(/\r?\n/g, ' ');
        if (/^[=+\-@]/.test(s)) s = "'" + s; // evita fórmula ao abrir no Excel
        return '"' + s + '"';
      }).join(';');
    });
    var blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'crm-cron-' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  });
})();
