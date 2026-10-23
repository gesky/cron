// Cron Web Studio · Painel administrativo
// Projetos (1 a 4, imagens em WebP dentro do Firestore) + gerenciamento de leads.
//
// Modo demonstração: abra admin.html?demo no computador (file:// ou localhost)
// para ver o painel com dados de exemplo, sem Firebase.

(function () {
  'use strict';

  var C = window.CRON || {};
  var MIN = C.MIN_PROJECTS || 1;
  var MAX = C.MAX_PROJECTS || 4;
  var IMG_MAX_CHARS = 700000;   // ~510 KB de WebP; documento do Firestore aceita até 1 MiB
  var IMG_MAX_DIM = 1600;

  var STATUS = [
    { id: 'novo', label: 'Novo', c: 'var(--st-novo)' },
    { id: 'contato', label: 'Em contato', c: 'var(--st-contato)' },
    { id: 'proposta', label: 'Proposta', c: 'var(--st-proposta)' },
    { id: 'fechado', label: 'Fechado', c: 'var(--st-fechado)' },
    { id: 'perdido', label: 'Perdido', c: 'var(--st-perdido)' }
  ];
  var STATUS_BY = {};
  STATUS.forEach(function (s) { STATUS_BY[s.id] = s; });

  var NEED = { institucional: 'Site institucional', sistema: 'Sistema ou painel', 'nao-sei': 'Ainda não sei' };

  var SOURCES = {
    'hero-primary': 'Hero · botão principal',
    'hero-secondary': 'Hero · botão secundário',
    'header': 'Header',
    'nav-mobile': 'Menu mobile',
    'manifesto': 'Manifesto',
    'painel': 'Seção painel',
    'plano-institucional': 'Plano institucional',
    'plano-sistema': 'Plano sistema',
    'processo': 'Processo',
    'final-whatsapp': 'CTA final',
    'final-projetos': 'CTA final · projetos',
    'float-whatsapp': 'Botão flutuante',
    'footer-whatsapp': 'Rodapé',
    'direto': 'Direto'
  };
  function sourceName(s) {
    if (!s) return 'Direto';
    if (SOURCES[s]) return SOURCES[s];
    if (s.indexOf('case-') === 0) return 'Projeto · ' + humanize(s.slice(5));
    return humanize(s);
  }
  function humanize(s) { s = String(s).replace(/-/g, ' '); return s.charAt(0).toUpperCase() + s.slice(1); }

  // ---------- Utilidades ----------
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  function esc(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function toDate(ts) {
    if (!ts) return null;
    if (ts.toDate) return ts.toDate();
    if (ts instanceof Date) return ts;
    return new Date(ts);
  }
  function fmtDate(d, withTime) {
    if (!d) return 'agora';
    var opts = { day: '2-digit', month: 'short' };
    if (d.getFullYear() !== new Date().getFullYear()) opts.year = 'numeric';
    var s = d.toLocaleDateString('pt-BR', opts).replace('.', '');
    if (withTime) s += ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return s;
  }
  function ago(d) {
    if (!d) return 'agora';
    var m = Math.round((Date.now() - d.getTime()) / 60000);
    if (m < 1) return 'agora';
    if (m < 60) return 'há ' + m + ' min';
    var h = Math.round(m / 60);
    if (h < 24) return 'há ' + h + ' h';
    var dd = Math.round(h / 24);
    if (dd < 7) return 'há ' + dd + (dd === 1 ? ' dia' : ' dias');
    return fmtDate(d);
  }
  function fmtPhone(d) {
    d = String(d || '').replace(/\D/g, '');
    if (d.length === 11) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 7) + '-' + d.slice(7);
    if (d.length === 10) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 6) + '-' + d.slice(6);
    return d;
  }
  function initials(name) {
    var p = String(name || '?').trim().split(/\s+/);
    return ((p[0] || '')[0] + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
  }
  function firstName(name) { return String(name || '').trim().split(/\s+/)[0]; }
  function safeUrl(url) {
    url = String(url || '').trim();
    if (!url) return '';
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    return url;
  }

  var toastTimer;
  function toast(msg, isError) {
    var t = $('#toast');
    t.textContent = msg;
    t.classList.toggle('is-error', !!isError);
    t.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('is-on'); }, 2800);
  }

  function confirmBox(title, text, yesLabel) {
    return new Promise(function (resolve) {
      var box = $('#confirm');
      $('#confirmTitle').textContent = title;
      $('#confirmText').textContent = text;
      $('#confirmYes').textContent = yesLabel || 'Excluir';
      box.hidden = false;
      $('#confirmNo').focus();
      function done(v) {
        box.hidden = true;
        $('#confirmYes').onclick = $('#confirmNo').onclick = null;
        resolve(v);
      }
      $('#confirmYes').onclick = function () { done(true); };
      $('#confirmNo').onclick = function () { done(false); };
    });
  }

  function showView(id) {
    ['view-loading', 'view-setup', 'view-login', 'view-denied', 'view-app'].forEach(function (v) {
      document.getElementById(v).hidden = v !== id;
    });
  }

  // =================================================================
  // Camada de dados: Firestore de verdade ou memória (modo demo)
  // =================================================================
  var isLocal = location.protocol === 'file:' || /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  var demo = !C.configured && isLocal && /[?&]demo\b/.test(location.search);
  var api;

  if (C.configured && C.db) {
    var db = C.db;
    var FV = firebase.firestore.FieldValue;
    api = {
      watchLeads: function (cb, onErr) {
        return db.collection('leads').orderBy('createdAt', 'desc').onSnapshot(function (snap) {
          var list = [];
          snap.forEach(function (d) { list.push(Object.assign({ id: d.id }, d.data())); });
          cb(list);
        }, onErr);
      },
      updateLead: function (id, data) {
        data.updatedAt = FV.serverTimestamp();
        return db.collection('leads').doc(id).update(data);
      },
      deleteLead: function (id) { return db.collection('leads').doc(id).delete(); },
      listProjects: function () {
        return db.collection('projects').get().then(function (snap) {
          var list = [];
          snap.forEach(function (d) { list.push(Object.assign({ id: d.id }, d.data())); });
          return list;
        });
      },
      saveProject: function (id, data) {
        data.updatedAt = FV.serverTimestamp();
        if (id) return db.collection('projects').doc(id).set(data, { merge: false }).then(function () { return id; });
        data.createdAt = FV.serverTimestamp();
        return db.collection('projects').add(data).then(function (ref) { return ref.id; });
      },
      deleteProject: function (id) { return db.collection('projects').doc(id).delete(); },
      setOrder: function (list) {
        var batch = db.batch();
        list.forEach(function (p, i) { batch.update(db.collection('projects').doc(p.id), { order: i }); });
        return batch.commit();
      }
    };
  } else if (demo) {
    api = demoApi();
  }

  // =================================================================
  // Inicialização e login
  // =================================================================
  if (!api) { showView('view-setup'); return; }

  if (demo) {
    $('#userEmail').textContent = 'modo demonstração';
    startApp();
  } else {
    C.auth.onAuthStateChanged(function (user) {
      if (!user) { stopApp(); showView('view-login'); return; }
      C.db.collection('admins').doc(user.uid).get().then(function (doc) {
        if (!doc.exists) { $('#deniedUid').textContent = user.uid; showView('view-denied'); return; }
        $('#userEmail').textContent = user.email;
        startApp();
      }).catch(function () {
        $('#deniedUid').textContent = user.uid;
        showView('view-denied');
      });
    });
  }

  var loginForm = $('#loginForm');
  var loginMsg = $('#loginMsg');
  loginForm.addEventListener('submit', function (e) {
    e.preventDefault();
    loginMsg.className = 'form-msg';
    loginMsg.textContent = '';
    var email = loginForm.email.value.trim();
    var pass = loginForm.password.value;
    if (!email || !pass) { loginMsg.textContent = 'Preencha e-mail e senha.'; return; }
    $('#loginBtn').disabled = true;
    C.auth.signInWithEmailAndPassword(email, pass).catch(function (err) {
      var code = err && err.code || '';
      loginMsg.textContent = /too-many/.test(code) ? 'Muitas tentativas. Aguarde alguns minutos.'
        : 'E-mail ou senha incorretos.';
    }).then(function () { $('#loginBtn').disabled = false; });
  });

  $('#forgotBtn').addEventListener('click', function () {
    var email = loginForm.email.value.trim();
    loginMsg.className = 'form-msg';
    if (!email) { loginMsg.textContent = 'Digite seu e-mail acima e clique de novo.'; loginForm.email.focus(); return; }
    C.auth.sendPasswordResetEmail(email).then(function () {
      loginMsg.className = 'form-msg is-ok';
      loginMsg.textContent = 'Se o e-mail estiver cadastrado, o link de redefinição chega em instantes.';
    }).catch(function () {
      loginMsg.textContent = 'Não foi possível enviar agora. Confira o e-mail.';
    });
  });

  $$('[data-logout]').forEach(function (b) {
    b.addEventListener('click', function () {
      if (demo) { location.href = 'index.html'; return; }
      C.auth.signOut();
    });
  });

  // =================================================================
  // App
  // =================================================================
  var started = false;
  var unsubLeads = null;

  function startApp() {
    showView('view-app');
    if (started) return;
    started = true;
    var saved = '';
    try { saved = localStorage.getItem('cron_admin_tab') || ''; } catch (e) {}
    setTab(saved === 'projects' ? 'projects' : 'leads');
    unsubLeads = api.watchLeads(onLeads, function (err) {
      console.error(err);
      toast('Não foi possível carregar os leads.', true);
    });
    loadProjects();
  }
  function stopApp() {
    if (unsubLeads) unsubLeads();
    unsubLeads = null;
    started = false;
  }

  // ---------- Abas ----------
  function setTab(tab) {
    $$('.side__link').forEach(function (b) { b.classList.toggle('is-active', b.dataset.tab === tab); });
    $('#tab-leads').hidden = tab !== 'leads';
    $('#tab-projects').hidden = tab !== 'projects';
    try { localStorage.setItem('cron_admin_tab', tab); } catch (e) {}
    window.scrollTo(0, 0);
  }
  $$('.side__link').forEach(function (b) {
    b.addEventListener('click', function () { setTab(b.dataset.tab); });
  });

  // =================================================================
  // LEADS
  // =================================================================
  var leads = [];
  var filter = 'todos';
  var query = '';
  var openLeadId = null;

  function onLeads(list) {
    leads = list;
    renderLeads();
    if (openLeadId) {
      var l = leads.find(function (x) { return x.id === openLeadId; });
      if (l) fillLead(l, true); else closeDrawer($('#leadDrawer'));
    }
  }

  function renderLeads() {
    var now = new Date();
    var monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    var counts = { todos: leads.length };
    STATUS.forEach(function (s) { counts[s.id] = 0; });
    var month = 0;
    leads.forEach(function (l) {
      var st = STATUS_BY[l.status] ? l.status : 'novo';
      counts[st]++;
      var d = toDate(l.createdAt);
      if (!d || d >= monthStart) month++;
    });

    // KPIs
    $('#kTotal').textContent = leads.length;
    $('#kNew').textContent = counts.novo;
    $('#kMonth').textContent = month;
    $('#kWon').textContent = counts.fechado;
    var rate = leads.length ? Math.round(counts.fechado / leads.length * 100) : 0;
    $('#kRate').textContent = rate + '% de conversão';

    var badge = $('#newBadge');
    badge.hidden = !counts.novo;
    badge.textContent = counts.novo;
    document.title = (counts.novo ? '(' + counts.novo + ') ' : '') + 'Painel | Cron Web Studio';

    // Filtros
    var fHtml = '<button class="filter' + (filter === 'todos' ? ' is-active' : '') + '" data-f="todos">Todos <b>' + counts.todos + '</b></button>';
    STATUS.forEach(function (s) {
      fHtml += '<button class="filter' + (filter === s.id ? ' is-active' : '') + '" data-f="' + s.id + '">' + s.label + ' <b>' + counts[s.id] + '</b></button>';
    });
    $('#statusFilters').innerHTML = fHtml;

    // Tabela
    var rows = filtered();
    $('#leadRows').innerHTML = rows.map(function (l) {
      var st = STATUS_BY[l.status] || STATUS_BY.novo;
      var d = toDate(l.createdAt);
      var sub = [l.company, NEED[l.need]].filter(Boolean).join(' · ') || (l.email || '');
      return '<tr data-id="' + esc(l.id) + '" class="' + (st.id === 'novo' ? 'is-new' : '') + '">' +
        '<td><div class="lead-cell"><span class="avatar">' + esc(initials(l.name)) + '</span><div><strong>' + esc(l.name) + '</strong><small>' + esc(sub) + '</small></div></div></td>' +
        '<td>' + esc(fmtPhone(l.whatsapp)) + '</td>' +
        '<td><span class="src">' + esc(sourceName(l.source)) + '</span></td>' +
        '<td><span class="pill" style="--c:' + st.c + '">' + st.label + '</span></td>' +
        '<td class="td-muted" title="' + esc(fmtDate(d, true)) + '">' + ago(d) + '</td>' +
      '</tr>';
    }).join('');
    $('#leadsEmpty').hidden = rows.length > 0;
    $('#leadsEmpty p').textContent = leads.length ? 'Nenhum lead com esse filtro.' : 'Nenhum lead por aqui ainda. Quando alguém preencher o formulário do site, ele aparece aqui na hora.';

    // Origens
    var bySrc = {};
    leads.forEach(function (l) { var k = l.source || 'direto'; bySrc[k] = (bySrc[k] || 0) + 1; });
    var srcList = Object.keys(bySrc).map(function (k) { return { k: k, n: bySrc[k] }; })
      .sort(function (a, b) { return b.n - a.n; }).slice(0, 7);
    var top = srcList.length ? srcList[0].n : 1;
    $('#sourceList').innerHTML = srcList.length ? srcList.map(function (s) {
      return '<li><div class="row"><span>' + esc(sourceName(s.k)) + '</span><b>' + s.n + '</b></div><div class="bar"><i style="width:' + Math.round(s.n / top * 100) + '%"></i></div></li>';
    }).join('') : '<li class="none">Sem dados ainda.</li>';

    // Funil
    $('#funnel').innerHTML = STATUS.map(function (s) {
      return '<div><span style="--c:' + s.c + '">' + s.label + '</span><b>' + counts[s.id] + '</b></div>';
    }).join('');
  }

  function filtered() {
    var q = query.toLowerCase().replace(/[()\-\s]/g, '');
    return leads.filter(function (l) {
      var st = STATUS_BY[l.status] ? l.status : 'novo';
      if (filter !== 'todos' && st !== filter) return false;
      if (!q) return true;
      var hay = [l.name, l.whatsapp, l.company, l.email, l.message].join(' ').toLowerCase().replace(/[()\-\s]/g, '');
      return hay.indexOf(q) !== -1;
    });
  }

  $('#statusFilters').addEventListener('click', function (e) {
    var b = e.target.closest('[data-f]');
    if (!b) return;
    filter = b.dataset.f;
    renderLeads();
  });
  $('#leadSearch').addEventListener('input', function () { query = this.value.trim(); renderLeads(); });
  $('#leadRows').addEventListener('click', function (e) {
    var tr = e.target.closest('tr[data-id]');
    if (tr) openLead(tr.dataset.id);
  });

  // ---------- Gaveta do lead ----------
  var leadDrawer = $('#leadDrawer');

  function openLead(id) {
    var l = leads.find(function (x) { return x.id === id; });
    if (!l) return;
    openLeadId = id;
    fillLead(l, false);
    openDrawer(leadDrawer);
  }

  function fillLead(l, keepNotes) {
    var d = toDate(l.createdAt);
    $('#ldDate').textContent = 'Recebido ' + fmtDate(d, true);
    $('#ldName').textContent = l.name;

    var msg = 'Oi, ' + firstName(l.name) + '! Aqui é o Pedro, da Cron. Recebi seu contato pelo site' +
      (l.project ? ' sobre um projeto como o da ' + l.project : '') + '. Podemos conversar?';
    $('#ldWhats').href = 'https://wa.me/55' + String(l.whatsapp || '').replace(/\D/g, '') + '?text=' + encodeURIComponent(msg);
    var em = $('#ldEmail');
    em.hidden = !l.email;
    if (l.email) em.href = 'mailto:' + l.email + '?subject=' + encodeURIComponent('Cron Web Studio | Seu projeto');

    var st = STATUS_BY[l.status] ? l.status : 'novo';
    $('#ldStatus').innerHTML = STATUS.map(function (s) {
      return '<button type="button" data-st="' + s.id + '" style="--c:' + s.c + '" class="' + (s.id === st ? 'is-active' : '') + '">' + s.label + '</button>';
    }).join('');

    var utm = l.utm || {};
    var utmTxt = Object.keys(utm).map(function (k) { return k + ': ' + utm[k]; }).join(' · ');
    var facts = [
      ['WhatsApp', fmtPhone(l.whatsapp)],
      ['E-mail', l.email || '–'],
      ['Empresa', l.company || '–'],
      ['Precisa de', NEED[l.need] || '–'],
      ['Origem', sourceName(l.source) + (l.sourceLabel ? ' (“' + l.sourceLabel + '”)' : ''), true],
      l.project ? ['Projeto de referência', l.project, true] : null,
      utmTxt ? ['Campanha (UTM)', utmTxt, true] : null,
      l.referrer ? ['Veio de', l.referrer, true] : null,
      l.updatedAt ? ['Última atualização', fmtDate(toDate(l.updatedAt), true), true] : null
    ].filter(Boolean);
    $('#ldFacts').innerHTML = facts.map(function (f) {
      return '<div class="' + (f[2] ? 'full' : '') + '"><dt>' + esc(f[0]) + '</dt><dd>' + esc(f[1]) + '</dd></div>';
    }).join('');

    $('#ldMsgWrap').hidden = !l.message;
    $('#ldMsg').textContent = l.message || '';

    if (!keepNotes) {
      $('#ldNotes').value = l.notes || '';
      $('#ldSaved').textContent = '';
    }

    var cAt = toDate(l.consentAt);
    $('#ldConsent').textContent = (l.consent ? 'Aceito' : 'Não registrado') +
      (cAt ? ' em ' + fmtDate(cAt, true) : '') + (l.consentText ? '. Texto: “' + l.consentText + '”' : '') +
      (l.page ? ' Página: ' + l.page : '');
  }

  $('#ldStatus').addEventListener('click', function (e) {
    var b = e.target.closest('[data-st]');
    if (!b || !openLeadId || b.classList.contains('is-active')) return;
    $$('#ldStatus button').forEach(function (x) { x.classList.toggle('is-active', x === b); });
    api.updateLead(openLeadId, { status: b.dataset.st })
      .then(function () { toast('Status: ' + STATUS_BY[b.dataset.st].label); })
      .catch(function () { toast('Não foi possível salvar o status.', true); });
  });

  $('#ldSaveNotes').addEventListener('click', function () {
    if (!openLeadId) return;
    var btn = this;
    btn.disabled = true;
    api.updateLead(openLeadId, { notes: $('#ldNotes').value.slice(0, 5000) })
      .then(function () {
        $('#ldSaved').textContent = 'Salvo ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        toast('Anotações salvas');
      })
      .catch(function () { toast('Não foi possível salvar.', true); })
      .then(function () { btn.disabled = false; });
  });

  $('#ldDelete').addEventListener('click', function () {
    var l = leads.find(function (x) { return x.id === openLeadId; });
    if (!l) return;
    confirmBox('Excluir este lead?', 'Os dados de ' + l.name + ' serão apagados de vez. Use também quando a pessoa pedir exclusão pela LGPD.')
      .then(function (ok) {
        if (!ok) return;
        var id = openLeadId;
        closeDrawer(leadDrawer);
        api.deleteLead(id).then(function () { toast('Lead excluído'); })
          .catch(function () { toast('Não foi possível excluir.', true); });
      });
  });

  // ---------- CSV ----------
  $('#exportCsv').addEventListener('click', function () {
    var rows = filtered();
    if (!rows.length) { toast('Nada para exportar.', true); return; }
    var head = ['Data', 'Nome', 'WhatsApp', 'E-mail', 'Empresa', 'Precisa de', 'Mensagem', 'Origem', 'Projeto', 'Status', 'Anotações', 'UTM', 'Consentimento'];
    var lines = [head].concat(rows.map(function (l) {
      var utm = l.utm || {};
      return [
        fmtDate(toDate(l.createdAt), true), l.name, fmtPhone(l.whatsapp), l.email, l.company,
        NEED[l.need] || '', l.message, sourceName(l.source), l.project,
        (STATUS_BY[l.status] || STATUS_BY.novo).label, l.notes,
        Object.keys(utm).map(function (k) { return k + '=' + utm[k]; }).join(' '),
        l.consent ? 'sim' : 'não'
      ];
    })).map(function (r) {
      return r.map(function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""').replace(/\r?\n/g, ' ') + '"'; }).join(';');
    });
    var blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'leads-cron-' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  });

  // =================================================================
  // GAVETAS (abrir/fechar)
  // =================================================================
  function openDrawer(dr) {
    dr.hidden = false;
    requestAnimationFrame(function () { requestAnimationFrame(function () { dr.classList.add('is-open'); }); });
    document.body.style.overflow = 'hidden';
  }
  function closeDrawer(dr) {
    dr.classList.remove('is-open');
    document.body.style.overflow = '';
    if (dr === leadDrawer) openLeadId = null;
    setTimeout(function () { if (!dr.classList.contains('is-open')) dr.hidden = true; }, 380);
  }
  $$('.drawer').forEach(function (dr) {
    dr.addEventListener('click', function (e) {
      if (e.target.closest('[data-close]')) closeDrawer(dr);
    });
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape' || !$('#confirm').hidden) return;
    $$('.drawer.is-open').forEach(closeDrawer);
  });

  // =================================================================
  // PROJETOS
  // =================================================================
  var projects = [];
  var editing = null;      // id do projeto em edição (null = novo)
  var formImage = '';      // dataURL WebP
  var formTags = [];

  function loadProjects() {
    return api.listProjects().then(function (list) {
      projects = list.sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
      renderProjects();
    }).catch(function (err) {
      console.error(err);
      toast('Não foi possível carregar os projetos.', true);
    });
  }

  function renderProjects() {
    var wrap = $('#projectList');
    $('#projectsEmpty').hidden = projects.length > 0;
    var atMax = projects.length >= MAX;
    var btn = $('#newProject');
    btn.disabled = atMax;
    btn.title = atMax ? 'Limite de ' + MAX + ' projetos. Exclua um para adicionar outro.' : '';

    var up = '<svg viewBox="0 0 24 24"><path d="m6 15 6-6 6 6"/></svg>';
    var down = '<svg viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg>';
    var edit = '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/></svg>';

    wrap.innerHTML = projects.map(function (p, i) {
      var meta = [p.client, p.segment].filter(Boolean).map(esc).join(' · ');
      return '<article class="proj" data-id="' + esc(p.id) + '">' +
        '<div class="proj__order">' +
          '<button class="icon-btn" data-move="-1" aria-label="Subir"' + (i === 0 ? ' disabled' : '') + '>' + up + '</button>' +
          '<button class="icon-btn" data-move="1" aria-label="Descer"' + (i === projects.length - 1 ? ' disabled' : '') + '>' + down + '</button>' +
        '</div>' +
        '<div class="proj__thumb">' + (p.image ? '<img src="' + esc(p.image) + '" alt="">' : 'Sem imagem') + '</div>' +
        '<div style="min-width:0">' +
          '<p class="proj__meta">' + (meta || '&nbsp;') + '</p>' +
          '<p class="proj__title">' + esc(p.title || 'Sem título') + '</p>' +
          '<div class="proj__status"><span class="tag-st' + (p.published ? '' : ' tag-st--off') + '">' + (p.published ? 'No ar' : 'Rascunho') + '</span><span class="proj__num">Posição ' + (i + 1) + ' de ' + projects.length + '</span></div>' +
        '</div>' +
        '<div class="proj__actions"><button class="btn btn--ghost" data-edit>' + edit + 'Editar</button></div>' +
      '</article>';
    }).join('') + (projects.length ? '<p class="limit-note">' + projects.length + ' de ' + MAX + ' projetos' + (atMax ? '. Limite atingido.' : '.') + '</p>' : '');
  }

  $('#projectList').addEventListener('click', function (e) {
    var card = e.target.closest('.proj');
    if (!card) return;
    var id = card.dataset.id;
    if (e.target.closest('[data-edit]')) { openProject(id); return; }
    var mv = e.target.closest('[data-move]');
    if (mv) move(id, +mv.dataset.move);
  });

  function move(id, dir) {
    var i = projects.findIndex(function (p) { return p.id === id; });
    var j = i + dir;
    if (i < 0 || j < 0 || j >= projects.length) return;
    var tmp = projects[i]; projects[i] = projects[j]; projects[j] = tmp;
    projects.forEach(function (p, k) { p.order = k; });
    renderProjects();
    api.setOrder(projects).then(function () { toast('Ordem atualizada'); })
      .catch(function () { toast('Não foi possível salvar a ordem.', true); loadProjects(); });
  }

  // ---------- Editor ----------
  var pDrawer = $('#projectDrawer');
  var pForm = $('#projectForm');
  var pMsg = $('#pdMsg');

  $('#newProject').addEventListener('click', function () {
    if (projects.length >= MAX) { toast('Limite de ' + MAX + ' projetos atingido.', true); return; }
    openProject(null);
  });

  function openProject(id) {
    var p = id ? projects.find(function (x) { return x.id === id; }) : null;
    editing = p ? p.id : null;
    pForm.reset();
    $$('.f.is-invalid', pForm).forEach(function (f) { f.classList.remove('is-invalid'); });
    pMsg.textContent = '';
    $('#pdTitle').textContent = p ? (p.client || 'Editar projeto') : 'Novo projeto';
    $('#pdDelete').hidden = !p;

    pForm.client.value = p ? p.client || '' : '';
    pForm.segment.value = p ? p.segment || '' : '';
    pForm.title.value = p ? p.title || '' : '';
    pForm.description.value = p ? p.description || '' : '';
    pForm.quoteText.value = p && p.quote ? p.quote.text || '' : '';
    pForm.quoteAuthor.value = p && p.quote ? p.quote.author || '' : '';
    pForm.ctaLabel.value = p ? p.ctaLabel || '' : '';
    pForm.siteLabel.value = p ? p.siteLabel || '' : '';
    pForm.siteUrl.value = p ? p.siteUrl || '' : '';
    pForm.imageAlt.value = p ? p.imageAlt || '' : '';
    pForm.published.checked = p ? !!p.published : true;
    formTags = p && p.tags ? p.tags.slice() : [];
    setImage(p ? p.image || '' : '');
    renderTags();
    updateCount();
    renderPreview();
    openDrawer(pDrawer);
    setTimeout(function () { pForm.client.focus(); }, 300);
  }

  // Tags
  var tagEntry = $('#tagEntry');
  function renderTags() {
    $$('.tag-chip', $('#tagsInput')).forEach(function (c) { c.remove(); });
    formTags.forEach(function (t, i) {
      var chip = document.createElement('span');
      chip.className = 'tag-chip';
      chip.innerHTML = esc(t) + '<button type="button" data-rm="' + i + '" aria-label="Remover ' + esc(t) + '"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button>';
      $('#tagsInput').insertBefore(chip, tagEntry);
    });
    tagEntry.placeholder = formTags.length >= 6 ? 'Máximo de 6 tags' : (formTags.length ? 'Mais uma…' : 'Painel administrativo');
    tagEntry.disabled = formTags.length >= 6;
  }
  function addTag() {
    var v = tagEntry.value.replace(/,/g, '').trim();
    if (v && formTags.length < 6 && formTags.indexOf(v) === -1) formTags.push(v.slice(0, 30));
    tagEntry.value = '';
    renderTags();
    renderPreview();
  }
  tagEntry.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(); }
    else if (e.key === 'Backspace' && !tagEntry.value && formTags.length) { formTags.pop(); renderTags(); renderPreview(); }
  });
  tagEntry.addEventListener('blur', function () { if (tagEntry.value.trim()) addTag(); });
  $('#tagsInput').addEventListener('click', function (e) {
    var b = e.target.closest('[data-rm]');
    if (b) { formTags.splice(+b.dataset.rm, 1); renderTags(); renderPreview(); }
    else tagEntry.focus();
  });

  function updateCount() {
    var c = $('.count[data-for="description"]');
    c.textContent = pForm.description.value.length + '/600';
  }
  pForm.addEventListener('input', function (e) {
    var f = e.target.closest('.f');
    if (f) f.classList.remove('is-invalid');
    pMsg.textContent = '';
    if (e.target.name === 'description') updateCount();
    renderPreview();
  });

  // ---------- Imagem → WebP ----------
  var fileInput = $('#imageFile');
  var drop = $('#drop');

  function setImage(dataUrl) {
    formImage = dataUrl || '';
    $('#dropEmpty').hidden = !!formImage;
    $('#dropImg').hidden = !formImage;
    if (formImage) {
      $('#dropPreview').src = formImage;
      var kb = Math.round(formImage.length * 0.75 / 1024);
      var img = new Image();
      img.onload = function () { $('#imgInfo').textContent = 'WebP · ' + img.naturalWidth + ' × ' + img.naturalHeight + ' · ' + kb + ' KB'; };
      img.src = formImage;
    }
    renderPreview();
  }

  $('#dropEmpty').addEventListener('click', function () { fileInput.click(); });
  $('#imgChange').addEventListener('click', function () { fileInput.click(); });
  $('#imgRemove').addEventListener('click', function () { setImage(''); });
  fileInput.addEventListener('change', function () {
    if (fileInput.files[0]) handleFile(fileInput.files[0]);
    fileInput.value = '';
  });
  ['dragenter', 'dragover'].forEach(function (ev) {
    drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('is-over'); });
  });
  ['dragleave', 'drop'].forEach(function (ev) {
    drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('is-over'); });
  });
  drop.addEventListener('drop', function (e) {
    var f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) handleFile(f);
  });

  function handleFile(file) {
    if (!/^image\//.test(file.type)) { toast('Envie um arquivo de imagem.', true); return; }
    $('#dropBusy').hidden = false;
    toWebP(file).then(function (res) {
      setImage(res);
      if (!pForm.imageAlt.value && pForm.client.value) pForm.imageAlt.value = 'Site da ' + pForm.client.value;
      toast('Imagem convertida para WebP');
    }).catch(function (err) {
      var m = err && err.message === 'no-webp'
        ? 'Este navegador não gera WebP (Safari). Use Chrome, Edge ou Firefox para enviar imagens.'
        : err && err.message === 'too-big'
          ? 'Mesmo comprimida, a imagem ficou grande demais. Tente uma imagem mais simples.'
          : 'Não foi possível ler essa imagem.';
      toast(m, true);
    }).then(function () { $('#dropBusy').hidden = true; });
  }

  function loadImage(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('read')); };
      img.src = url;
    });
  }

  // Redimensiona e comprime até caber no documento do Firestore
  function toWebP(file) {
    return loadImage(file).then(function (img) {
      var w = img.naturalWidth, h = img.naturalHeight;
      var scale = Math.min(1, IMG_MAX_DIM / Math.max(w, h));
      var q = 0.82;
      var canvas = document.createElement('canvas');
      var ctx = canvas.getContext('2d');
      for (var tries = 0; tries < 14; tries++) {
        canvas.width = Math.max(1, Math.round(w * scale));
        canvas.height = Math.max(1, Math.round(h * scale));
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        var data = canvas.toDataURL('image/webp', q);
        if (data.indexOf('data:image/webp') !== 0) throw new Error('no-webp');
        if (data.length <= IMG_MAX_CHARS) return data;
        if (q > 0.55) q -= 0.08; else scale *= 0.85;
      }
      throw new Error('too-big');
    });
  }

  // ---------- Pré-visualização ----------
  function renderPreview() {
    var v = function (n) { return pForm[n].value.trim(); };
    var meta = [v('client'), v('segment')].filter(Boolean).map(esc).join(' · ');
    var quote = v('quoteText')
      ? '<blockquote class="quote">“' + esc(v('quoteText')) + '”' + (v('quoteAuthor') ? '<cite>' + esc(v('quoteAuthor')) + '</cite>' : '') + '</blockquote>' : '';
    var tags = formTags.length ? '<ul class="tags">' + formTags.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>' : '';
    var site = v('siteUrl') ? '<span class="pv-link">' + esc(v('siteLabel') || 'Ver site no ar') + ' ↗</span>' : '';
    $('#preview').innerHTML =
      '<article class="case">' +
        '<div class="case__media">' + (formImage ? '<img src="' + formImage + '" alt="">' : '<div class="ph">Imagem do projeto</div>') + '</div>' +
        '<div class="case__body">' +
          '<p class="case__meta' + (meta ? '' : ' is-empty') + '">' + (meta || 'Cliente · Segmento') + '</p>' +
          '<h3 class="' + (v('title') ? '' : 'is-empty') + '">' + esc(v('title') || 'Título do projeto') + '</h3>' +
          (v('description') ? '<p>' + esc(v('description')) + '</p>' : '') +
          quote + tags +
          '<div class="case__ctas"><span class="pv-btn">' + esc(v('ctaLabel') || 'Quero um assim') + '</span>' + site + '</div>' +
        '</div>' +
      '</article>';
  }

  // ---------- Salvar ----------
  pForm.addEventListener('submit', function (e) {
    e.preventDefault();
    if (tagEntry.value.trim()) addTag();
    var ok = true;
    ['client', 'title'].forEach(function (n) {
      var bad = pForm[n].value.trim().length < 2;
      pForm[n].closest('.f').classList.toggle('is-invalid', bad);
      if (bad) ok = false;
    });
    if (!ok) { pMsg.textContent = 'Preencha cliente e título.'; return; }

    var published = pForm.published.checked;
    var others = projects.filter(function (p) { return p.id !== editing; });
    if (!published && !others.some(function (p) { return p.published; })) {
      pMsg.textContent = 'O site precisa de pelo menos 1 projeto publicado.';
      return;
    }
    if (!editing && projects.length >= MAX) { pMsg.textContent = 'Limite de ' + MAX + ' projetos atingido.'; return; }

    var current = editing ? projects.find(function (p) { return p.id === editing; }) : null;
    var data = {
      client: pForm.client.value.trim(),
      segment: pForm.segment.value.trim(),
      title: pForm.title.value.trim(),
      description: pForm.description.value.trim(),
      quote: { text: pForm.quoteText.value.trim(), author: pForm.quoteAuthor.value.trim() },
      tags: formTags.slice(0, 6),
      ctaLabel: pForm.ctaLabel.value.trim(),
      siteLabel: pForm.siteLabel.value.trim(),
      siteUrl: pForm.siteUrl.value.trim() ? safeUrl(pForm.siteUrl.value) : '',
      image: formImage,
      imageAlt: pForm.imageAlt.value.trim(),
      published: published,
      order: current ? (current.order || 0) : projects.length
    };
    if (current && current.createdAt) data.createdAt = current.createdAt;

    var btn = $('#pdSave');
    btn.disabled = true;
    btn.textContent = 'Salvando…';
    api.saveProject(editing, data).then(function () {
      toast(editing ? 'Projeto atualizado' : 'Projeto criado');
      closeDrawer(pDrawer);
      return loadProjects();
    }).catch(function (err) {
      console.error(err);
      pMsg.textContent = 'Não foi possível salvar. ' + (err && err.code === 'permission-denied' ? 'Sem permissão.' : 'Tente de novo.');
    }).then(function () {
      btn.disabled = false;
      btn.textContent = 'Salvar projeto';
    });
  });

  // ---------- Excluir ----------
  $('#pdDelete').addEventListener('click', function () {
    var p = projects.find(function (x) { return x.id === editing; });
    if (!p) return;
    if (projects.length <= MIN) { pMsg.textContent = 'O site precisa de pelo menos ' + MIN + ' projeto. Edite este em vez de excluir.'; return; }
    var others = projects.filter(function (x) { return x.id !== p.id; });
    if (!others.some(function (x) { return x.published; })) { pMsg.textContent = 'Este é o único projeto publicado. Publique outro antes de excluir.'; return; }
    confirmBox('Excluir “' + (p.client || p.title) + '”?', 'O projeto sai do site na hora. Não dá para desfazer.').then(function (ok) {
      if (!ok) return;
      api.deleteProject(p.id).then(function () {
        closeDrawer(pDrawer);
        toast('Projeto excluído');
        projects = others;
        projects.forEach(function (x, k) { x.order = k; });
        return api.setOrder(projects);
      }).then(loadProjects).catch(function () { toast('Não foi possível excluir.', true); });
    });
  });

  // =================================================================
  // Modo demonstração (dados de exemplo em memória)
  // =================================================================
  function demoApi() {
    var now = Date.now();
    var H = 3600000;
    var mem = {
      leads: [
        { id: 'l1', name: 'Mariana Duarte', whatsapp: '14998123456', email: 'mariana@studioduarte.com.br', company: 'Studio Duarte', need: 'institucional', message: 'Quero um site novo pro estúdio, hoje dependo de agência pra trocar qualquer foto.', source: 'hero-primary', sourceLabel: 'Quero meu site rodando', project: '', status: 'novo', notes: '', createdAt: new Date(now - 0.4 * H), consent: true, consentAt: new Date(now - 0.4 * H), consentText: 'Concordo que a Cron Web Studio use estes dados para entrar em contato sobre o meu projeto, conforme a Política de Privacidade e a LGPD.', utm: { source: 'instagram', medium: 'bio' }, page: 'https://cronwebstudio.com.br/', referrer: 'https://l.instagram.com/' },
        { id: 'l2', name: 'Ricardo Albuquerque', whatsapp: '11987654321', email: '', company: 'Albuquerque Peças', need: 'sistema', message: 'Vi o projeto da Meccal e quero algo parecido.', source: 'case-meccal', sourceLabel: 'Quero um assim', project: 'Meccal', status: 'novo', notes: '', createdAt: new Date(now - 5 * H), consent: true, consentAt: new Date(now - 5 * H), consentText: 'Concordo…', utm: {}, page: 'https://cronwebstudio.com.br/', referrer: '' },
        { id: 'l3', name: 'Fernanda Lopes', whatsapp: '14996541230', email: 'fernanda@clinicavita.com', company: 'Clínica Vita', need: 'sistema', message: 'Precisamos de um painel pra equipe atualizar convênios e médicos.', source: 'plano-sistema', sourceLabel: 'Quero o plano Sistema', project: '', status: 'contato', notes: 'Liguei dia 14, pediu proposta até sexta.', createdAt: new Date(now - 26 * H), consent: true, consentAt: new Date(now - 26 * H), consentText: 'Concordo…', utm: { source: 'google', medium: 'organic' }, page: 'https://cronwebstudio.com.br/', referrer: 'https://www.google.com/' },
        { id: 'l4', name: 'João Pedro Martins', whatsapp: '1432231122', email: '', company: '', need: 'nao-sei', message: '', source: 'final-whatsapp', sourceLabel: 'Quero conversar', project: '', status: 'proposta', notes: 'Proposta enviada, plano institucional.', createdAt: new Date(now - 74 * H), consent: true, consentAt: new Date(now - 74 * H), consentText: 'Concordo…', utm: {}, page: 'https://cronwebstudio.com.br/', referrer: '' },
        { id: 'l5', name: 'Camila Rocha', whatsapp: '14991112233', email: 'camila@rochaarq.com.br', company: 'Rocha Arquitetura', need: 'institucional', message: 'Portfólio com projetos que eu mesma consiga atualizar.', source: 'hero-primary', sourceLabel: 'Quero meu site rodando', project: '', status: 'fechado', notes: 'Fechou institucional. Início dia 03.', createdAt: new Date(now - 9 * 24 * H), consent: true, consentAt: new Date(now - 9 * 24 * H), consentText: 'Concordo…', utm: {}, page: 'https://cronwebstudio.com.br/', referrer: '' },
        { id: 'l6', name: 'Paulo Nogueira', whatsapp: '11955554444', email: '', company: 'PN Transportes', need: 'sistema', message: 'Orçamento pra sistema de rastreio.', source: 'final-whatsapp', sourceLabel: 'Quero conversar', project: '', status: 'perdido', notes: 'Fora do escopo.', createdAt: new Date(now - 40 * 24 * H), consent: true, consentAt: new Date(now - 40 * 24 * H), consentText: 'Concordo…', utm: {}, page: 'https://cronwebstudio.com.br/', referrer: '' }
      ],
      projects: [
        { id: 'p1', client: 'Meccal', segment: 'Indústria', title: 'Catálogo industrial que o próprio time atualiza.', description: 'Produtos, categorias e fichas técnicas gerenciados por um painel simples. A equipe publica sozinha, sem abrir chamado.', quote: { text: '', author: '' }, tags: ['Catálogo', 'Painel administrativo', 'SEO'], ctaLabel: 'Quero um assim', siteUrl: 'https://meccal.com.br', siteLabel: 'Ver site no ar', image: '', imageAlt: '', published: true, order: 0 },
        { id: 'p2', client: 'Plane Aviation', segment: 'Aviação executiva', title: 'Frota e serviços sempre atualizados.', description: 'Site institucional com painel para aeronaves, serviços e galeria.', quote: { text: 'Hoje a gente atualiza tudo sozinho.', author: 'Plane Aviation' }, tags: ['Institucional', 'Painel'], ctaLabel: '', siteUrl: '', siteLabel: '', image: '', imageAlt: '', published: true, order: 1 }
      ]
    };
    var listener = null;
    function emit() { if (listener) listener(mem.leads.slice().sort(function (a, b) { return b.createdAt - a.createdAt; })); }
    function clone(o) { return JSON.parse(JSON.stringify(o)); }
    var wait = function (v) { return new Promise(function (r) { setTimeout(function () { r(v); }, 250); }); };
    return {
      watchLeads: function (cb) { listener = cb; setTimeout(emit, 200); return function () { listener = null; }; },
      updateLead: function (id, data) {
        var l = mem.leads.find(function (x) { return x.id === id; });
        Object.assign(l, data, { updatedAt: new Date() });
        return wait().then(emit);
      },
      deleteLead: function (id) { mem.leads = mem.leads.filter(function (x) { return x.id !== id; }); return wait().then(emit); },
      listProjects: function () { return wait(clone(mem.projects)); },
      saveProject: function (id, data) {
        if (id) { var i = mem.projects.findIndex(function (x) { return x.id === id; }); mem.projects[i] = Object.assign({ id: id }, data); }
        else { id = 'p' + Date.now(); mem.projects.push(Object.assign({ id: id }, data)); }
        return wait(id);
      },
      deleteProject: function (id) { mem.projects = mem.projects.filter(function (x) { return x.id !== id; }); return wait(); },
      setOrder: function (list) {
        list.forEach(function (p, i) { var m = mem.projects.find(function (x) { return x.id === p.id; }); if (m) m.order = i; });
        return wait();
      }
    };
  }
})();
