// Cron Web Studio · Painel administrativo (núcleo)
// Login, abas, gavetas, utilitários, camada de dados e Projetos (1 a 4, imagens em WebP).
// O CRM fica em js/admin-crm.js e usa o que este arquivo expõe em window.CRON_ADMIN.
//
// Modo demonstração: abra admin.html?demo no computador (file:// ou localhost)
// para ver o painel com dados de exemplo, sem tocar no Firebase.

(function () {
  'use strict';

  // Anti-clickjacking: o painel nunca roda dentro de um iframe de outro site
  if (window.top !== window.self) {
    document.documentElement.innerHTML = '';
    try { window.top.location = window.self.location.href; } catch (e) {}
    return;
  }

  var C = window.CRON || {};
  var MIN = C.MIN_PROJECTS || 1;
  var MAX = C.MAX_PROJECTS || 4;
  var IMG_MAX_CHARS = 700000;   // ~510 KB de WebP; documento do Firestore aceita até 1 MiB
  var IMG_MAX_DIM = 1600;

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

  // Pergunta com campo de texto (ex.: motivo de perda). Resolve com o texto ou null.
  function promptBox(title, text, opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      var box = $('#promptDlg');
      var input = $('#promptInput');
      var msg = $('#promptMsg');
      $('#promptTitle').textContent = title;
      $('#promptText').textContent = text || '';
      $('#promptYes').textContent = opts.yes || 'Salvar';
      input.value = opts.value || '';
      input.placeholder = opts.placeholder || '';
      input.maxLength = opts.max || 300;
      msg.textContent = '';
      box.hidden = false;
      setTimeout(function () { input.focus(); }, 30);
      function done(v) {
        box.hidden = true;
        $('#promptYes').onclick = $('#promptNo').onclick = null;
        box.onkeydown = null;
        resolve(v);
      }
      $('#promptYes').onclick = function () {
        var v = input.value.trim();
        if (opts.required && v.length < 2) { msg.textContent = opts.requiredMsg || 'Preencha o campo.'; input.focus(); return; }
        done(v);
      };
      $('#promptNo').onclick = function () { done(null); };
      box.onkeydown = function (e) {
        if (e.key === 'Escape') { e.stopPropagation(); done(null); }
        if (e.key === 'Enter' && !e.shiftKey && input.tagName !== 'TEXTAREA') { e.preventDefault(); $('#promptYes').click(); }
      };
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
  // ?demo só funciona no computador (file:// ou localhost), mesmo com o Firebase configurado:
  // nada do modo demo grava no banco de verdade.
  var demo = isLocal && /[?&]demo\b/.test(location.search);
  var api;

  if (C.configured && C.db && !demo) {
    var db = C.db;
    var FV = firebase.firestore.FieldValue;
    var leadsCol = db.collection('leads');
    // Interações sempre gravadas no mesmo batch da mudança no lead
    var addInter = function (batch, leadRef, list) {
      (list || []).forEach(function (it) {
        batch.set(leadRef.collection('interacoes').doc(), {
          type: it.type, text: it.text || '', channel: it.channel || '',
          from: it.from || '', to: it.to || '',
          createdAt: FV.serverTimestamp(), createdBy: 'admin'
        });
      });
    };
    // Prévias antigas (fase 3) guardavam leadId, niche e formatReason no documento público.
    // Toda gravação numa prévia remove esses campos, para o link público parar de entregá-los.
    var cleanPublic = function (data) {
      data.leadId = FV.delete();
      data.niche = FV.delete();
      data.formatReason = FV.delete();
      return data;
    };
    api = {
      now: function () { return FV.serverTimestamp(); },
      del: function () { return FV.delete(); },
      watchLeads: function (cb, onErr) {
        return leadsCol.orderBy('createdAt', 'desc').onSnapshot(function (snap) {
          var list = [];
          snap.forEach(function (d) { list.push(Object.assign({ id: d.id }, d.data())); });
          cb(list);
        }, onErr);
      },
      // data aceita caminhos com ponto ('draft.approved'); inters: lista de interações
      updateLead: function (id, data, inters) {
        data.updatedAt = FV.serverTimestamp();
        var ref = leadsCol.doc(id);
        var batch = db.batch();
        batch.update(ref, data);
        addInter(batch, ref, inters);
        return batch.commit();
      },
      createLead: function (data, inters) {
        var ref = leadsCol.doc();
        data.createdAt = FV.serverTimestamp();
        data.stageAt = FV.serverTimestamp();
        data.createdBy = 'admin';
        var batch = db.batch();
        batch.set(ref, data);
        addInter(batch, ref, inters);
        return batch.commit().then(function () { return ref.id; });
      },
      // Exclusão completa (LGPD): histórico, kit da marca e prévias, em lotes; o lead por último
      deleteLead: function (id) {
        var ref = leadsCol.doc(id);
        return Promise.all([
          ref.collection('interacoes').get(),
          ref.collection('kit').get(),
          ref.collection('previews').get(),
          // prévias criadas antes do índice privado ainda guardam o leadId no documento público
          db.collection('previews').where('leadId', '==', id).get()
        ]).then(function (res) {
          var refs = [], seen = {};
          var push = function (r) { if (!seen[r.path]) { seen[r.path] = 1; refs.push(r); } };
          res.forEach(function (snap) { snap.docs.forEach(function (d) { push(d.ref); }); });
          // cada item do índice aponta para uma prévia pública com o mesmo id
          res[2].docs.forEach(function (d) { push(db.collection('previews').doc(d.id)); });
          var chain = Promise.resolve();
          for (var i = 0; i < refs.length; i += 400) {
            (function (part) {
              chain = chain.then(function () {
                var b = db.batch();
                part.forEach(function (r) { b.delete(r); });
                return b.commit();
              });
            })(refs.slice(i, i + 400));
          }
          return chain.then(function () { return ref.delete(); });
        });
      },
      watchInteractions: function (id, cb, onErr) {
        return leadsCol.doc(id).collection('interacoes').orderBy('createdAt', 'desc').limit(100)
          .onSnapshot(function (snap) {
            var list = [];
            snap.forEach(function (d) { list.push(Object.assign({ id: d.id }, d.data())); });
            cb(list);
          }, onErr);
      },
      addInteraction: function (id, it) {
        var batch = db.batch();
        addInter(batch, leadsCol.doc(id), [it]);
        return batch.commit();
      },
      // Troca o status antigo 'contato' por 'em_conversa'. Em lotes, pode rodar quantas vezes quiser.
      migrateLegacyStatus: function () {
        return leadsCol.where('status', '==', 'contato').get().then(function (snap) {
          var docs = snap.docs, chain = Promise.resolve();
          for (var i = 0; i < docs.length; i += 400) {
            (function (part) {
              chain = chain.then(function () {
                var b = db.batch();
                part.forEach(function (d) { b.update(d.ref, { status: 'em_conversa', updatedAt: FV.serverTimestamp() }); });
                return b.commit();
              });
            })(docs.slice(i, i + 400));
          }
          return chain.then(function () { return docs.length; });
        });
      },
      // Várias atualizações de leads (aprovar ou descartar em lote). Cada item: { id, data, inters }
      updateLeads: function (items) {
        var chain = Promise.resolve();
        for (var i = 0; i < items.length; i += 150) {
          (function (part) {
            chain = chain.then(function () {
              var b = db.batch();
              part.forEach(function (it) {
                var ref = leadsCol.doc(it.id);
                it.data.updatedAt = FV.serverTimestamp();
                b.update(ref, it.data);
                addInter(b, ref, it.inters);
              });
              return b.commit();
            });
          })(items.slice(i, i + 150));
        }
        return chain;
      },
      // ---------- Kit da marca e sites modelo ----------
      getKit: function (leadId) {
        return leadsCol.doc(leadId).collection('kit').doc('marca').get().then(function (d) { return d.exists ? d.data() : null; });
      },
      saveKit: function (leadId, data) {
        data.updatedAt = FV.serverTimestamp();
        data.updatedBy = 'admin';
        return leadsCol.doc(leadId).collection('kit').doc('marca').set(data);
      },
      // Lista pelo índice privado (leads/{id}/previews) e junta as prévias antigas que ainda têm leadId
      listPreviews: function (leadId) {
        return Promise.all([
          leadsCol.doc(leadId).collection('previews').get(),
          db.collection('previews').where('leadId', '==', leadId).get().catch(function () { return { docs: [] }; })
        ]).then(function (res) {
          var meta = {};
          res[0].docs.forEach(function (d) { meta[d.id] = d.data(); });
          res[1].docs.forEach(function (d) { if (!meta[d.id]) meta[d.id] = {}; });
          return Promise.all(Object.keys(meta).map(function (pid) {
            return db.collection('previews').doc(pid).get().then(function (d) {
              return d.exists ? Object.assign({ id: d.id }, d.data(), { formatReason: meta[pid].formatReason || '', niche: meta[pid].niche || '' }) : null;
            }).catch(function () { return null; });
          }));
        }).then(function (list) {
          return list.filter(Boolean).sort(function (a, b) { return (toDate(b.createdAt) || 0) - (toDate(a.createdAt) || 0); });
        });
      },
      getPreview: function (id) {
        return db.collection('previews').doc(id).get().then(function (d) { return d.exists ? Object.assign({ id: d.id }, d.data()) : null; });
      },
      // Cria a prévia, liga ao lead e registra no histórico no mesmo batch. A anterior é desativada.
      // Cria a prévia pública (sem nada interno), o índice privado no lead, liga ao lead,
      // desativa a anterior e registra no histórico, tudo no mesmo batch.
      // meta: { niche, formatReason } vão só para o índice privado.
      createPreview: function (data, leadId, meta, oldId) {
        var ref = db.collection('previews').doc();
        var lead = leadsCol.doc(leadId);
        data.createdAt = FV.serverTimestamp();
        data.updatedAt = FV.serverTimestamp();
        data.createdBy = 'admin';
        data.active = true;
        var b = db.batch();
        b.set(ref, data);
        b.set(lead.collection('previews').doc(ref.id), {
          niche: (meta && meta.niche) || '', formatReason: (meta && meta.formatReason) || '', createdAt: FV.serverTimestamp()
        });
        b.update(lead, { previewId: ref.id, updatedAt: FV.serverTimestamp() });
        addInter(b, lead, [{ type: 'nota', text: oldId ? 'Site modelo gerado de novo.' : 'Site modelo gerado.' }]);
        if (oldId) b.update(db.collection('previews').doc(oldId), cleanPublic({ active: false, updatedAt: FV.serverTimestamp() }));
        return b.commit().then(function () { return ref.id; });
      },
      updatePreview: function (id, data) {
        data.updatedAt = FV.serverTimestamp();
        return db.collection('previews').doc(id).update(cleanPublic(data));
      },
      setPreviewActive: function (id, active) {
        return db.collection('previews').doc(id).update(cleanPublic({ active: !!active, updatedAt: FV.serverTimestamp() }));
      },
      // ---------- Dono e CronUS ----------
      getOwner: function () {
        return db.collection('config').doc('owner').get().then(function (d) { return d.exists ? (d.data().uid || '') : ''; })
          .catch(function () { return ''; });
      },
      watchBots: function (cb, onErr) {
        return db.collection('bots').onSnapshot(function (snap) {
          var list = [];
          snap.forEach(function (d) { list.push(Object.assign({ id: d.id }, d.data())); });
          cb(list);
        }, onErr);
      },
      addBot: function (uid, data) {
        data.createdAt = FV.serverTimestamp();
        data.createdBy = C.auth.currentUser.uid;
        data.role = 'bot';
        return db.collection('bots').doc(uid).set(data);
      },
      removeBot: function (uid) { return db.collection('bots').doc(uid).delete(); },
      // ---------- Rodadas de prospecção ----------
      watchRodadas: function (cb, onErr) {
        return db.collection('rodadas').orderBy('createdAt', 'desc').onSnapshot(function (snap) {
          var list = [];
          snap.forEach(function (d) { list.push(Object.assign({ id: d.id }, d.data())); });
          cb(list);
        }, onErr);
      },
      createRodada: function (data) {
        data.createdAt = FV.serverTimestamp();
        data.updatedAt = FV.serverTimestamp();
        data.createdBy = 'admin';
        return db.collection('rodadas').add(data).then(function (ref) { return ref.id; });
      },
      updateRodada: function (id, data) {
        data.updatedAt = FV.serverTimestamp();
        return db.collection('rodadas').doc(id).update(data);
      },
      // ---------- Usuários do painel ----------
      watchAdmins: function (cb, onErr) {
        return db.collection('admins').onSnapshot(function (snap) {
          var list = [];
          snap.forEach(function (d) { list.push(Object.assign({ id: d.id }, d.data())); });
          cb(list);
        }, onErr);
      },
      watchSelf: function (uid, cb) {
        return db.collection('admins').doc(uid).onSnapshot(function (d) { cb(d.exists); }, function () {});
      },
      addAdmin: function (uid, data) {
        data.createdAt = FV.serverTimestamp();
        data.createdBy = C.auth.currentUser.uid;
        data.role = 'admin';
        return db.collection('admins').doc(uid).set(data);
      },
      updateAdmin: function (uid, data) {
        data.updatedAt = FV.serverTimestamp();
        return db.collection('admins').doc(uid).update(data);
      },
      removeAdmin: function (uid) {
        return api.getOwner().then(function (owner) {
          if (owner && owner === uid) throw { code: 'owner-protected' };
          return db.collection('admins').doc(uid).delete();
        });
      },
      // Cria a conta de login num app secundário, para não trocar a sua sessão.
      // Sem senha definida, gera uma aleatória e manda o e-mail para a pessoa criar a dela.
      createAuthUser: function (email, password) {
        var sec = firebase.apps.filter(function (a) { return a.name === 'cron-users'; })[0] ||
          firebase.initializeApp(C.config, 'cron-users');
        var auth2 = sec.auth();
        auth2.languageCode = 'pt-BR';
        var pass = password;
        if (!pass) {
          var arr = new Uint32Array(6);
          crypto.getRandomValues(arr);
          pass = Array.prototype.map.call(arr, function (n) { return n.toString(36); }).join('') + 'Aa1!';
        }
        var uid;
        return auth2.setPersistence(firebase.auth.Auth.Persistence.NONE)
          .then(function () { return auth2.createUserWithEmailAndPassword(email, pass); })
          .then(function (cred) {
            uid = cred.user.uid;
            return password ? null : auth2.sendPasswordResetEmail(email);
          })
          .then(function () { return auth2.signOut(); })
          .then(function () { return uid; });
      },
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
  // Ponte para os módulos (CRM e os próximos): utilitários e dados num só lugar
  // =================================================================
  var modules = [];
  var started = false;
  var TABS = ['leads', 'prospect', 'projects', 'users'];
  var unsubSelf = null;
  // Uma única escuta de leads para todo o painel (CRM e Prospecção leem daqui)
  var leadSubs = [], lastLeads = null, unsubLeadsAll = null;
  function broadcastLeads(list) {
    lastLeads = list;
    leadSubs.forEach(function (cb) { cb(list); });
  }
  window.CRON_ADMIN = {
    api: api || null,
    demo: demo,
    $: $, $$: $$, esc: esc, toDate: toDate, fmtDate: fmtDate, ago: ago,
    fmtPhone: fmtPhone, initials: initials, firstName: firstName, safeUrl: safeUrl,
    toast: toast, confirmBox: confirmBox, promptBox: promptBox,
    openDrawer: openDrawer, closeDrawer: closeDrawer,
    toWebP: function (file, maxDim, maxChars) { return toWebP(file, maxDim, maxChars); },
    setTab: function (t) { setTab(t); },
    user: { uid: '', email: '' },
    // Recebe a lista completa de leads sempre que algo muda. Devolve a função para parar.
    onLeads: function (cb) {
      leadSubs.push(cb);
      if (lastLeads) setTimeout(function () { cb(lastLeads); }, 0);
      return function () { leadSubs = leadSubs.filter(function (x) { return x !== cb; }); };
    },
    // Cada módulo chama register({ start, stop, onTab }). Se o painel já abriu, começa na hora.
    register: function (m) {
      modules.push(m);
      if (started && m.start) m.start();
    }
  };

  // =================================================================
  // Inicialização e login
  // =================================================================
  if (!api) { showView('view-setup'); return; }

  if (demo) {
    $('#userEmail').textContent = 'modo demonstração';
    window.CRON_ADMIN.user = { uid: 'demoAdminUid000000000001', email: 'pedro@cronwebstudio.com.br' };
    startApp();
  } else {
    C.auth.onAuthStateChanged(function (user) {
      if (!user) { stopApp(); showView('view-login'); return; }
      C.db.collection('admins').doc(user.uid).get().then(function (doc) {
        if (!doc.exists) { $('#deniedUid').textContent = user.uid; showView('view-denied'); return; }
        $('#userEmail').textContent = user.email;
        window.CRON_ADMIN.user = { uid: user.uid, email: user.email || '' };
        // Completa nome e e-mail no próprio cadastro de admin (documentos criados à mão no console)
        var me = doc.data() || {};
        if (!me.email && user.email) {
          api.updateAdmin(user.uid, { email: user.email.toLowerCase().slice(0, 160) }).catch(function () {});
        }
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
    // sessão some ao fechar o navegador
    C.auth.setPersistence(firebase.auth.Auth.Persistence.SESSION)
      .then(function () { return C.auth.signInWithEmailAndPassword(email, pass); }).catch(function (err) {
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

  // Sai sozinho depois de 45 min sem uso
  var idleTimer = null;
  function resetIdle() {
    if (demo || !started) return;
    clearTimeout(idleTimer);
    idleTimer = setTimeout(function () { C.auth.signOut(); toast('Sessão encerrada por inatividade.'); }, 45 * 60 * 1000);
  }
  ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'].forEach(function (ev) {
    window.addEventListener(ev, resetIdle, { passive: true });
  });

  function startApp() {
    showView('view-app');
    setTimeout(resetIdle, 0);
    if (started) return;
    started = true;
    var saved = '';
    try { saved = localStorage.getItem('cron_admin_tab') || ''; } catch (e) {}
    // Link direto para o CRM (#crm?...) sempre abre a aba CRM
    if (location.hash.indexOf('#crm') === 0) saved = 'leads';
    setTab(TABS.indexOf(saved) !== -1 ? saved : 'leads');
    unsubLeadsAll = api.watchLeads(broadcastLeads, function (err) {
      console.error(err);
      toast('Não foi possível carregar os leads.', true);
    });
    modules.forEach(function (m) { if (m.start) m.start(); });
    loadProjects();
    // Se o seu acesso for removido por outro admin, o painel fecha
    if (!demo && api.watchSelf) {
      unsubSelf = api.watchSelf(window.CRON_ADMIN.user.uid, function (exists) {
        if (!exists) { toast('Seu acesso ao painel foi removido.', true); C.auth.signOut(); }
      });
    }
  }
  function stopApp() {
    modules.forEach(function (m) { if (m.stop) m.stop(); });
    if (unsubLeadsAll) unsubLeadsAll();
    if (unsubSelf) unsubSelf();
    unsubLeadsAll = unsubSelf = null;
    lastLeads = null;
    started = false;
  }

  // ---------- Abas ----------
  function setTab(tab) {
    if (TABS.indexOf(tab) === -1) tab = 'leads';
    $$('.side__link').forEach(function (b) {
      var on = b.dataset.tab === tab;
      b.classList.toggle('is-active', on);
      if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    TABS.forEach(function (t) { var el = $('#tab-' + t); if (el) el.hidden = t !== tab; });
    try { localStorage.setItem('cron_admin_tab', tab); } catch (e) {}
    modules.forEach(function (m) { if (m.onTab) m.onTab(tab); });
    window.scrollTo(0, 0);
  }
  $$('.side__link').forEach(function (b) {
    b.addEventListener('click', function () { setTab(b.dataset.tab); });
  });

  // =================================================================
  // GAVETAS (abrir/fechar)
  // =================================================================
  // Gavetas podem se empilhar (ex.: editar a prévia por cima do lead); Esc fecha só a de cima
  var drawerStack = [];
  function openDrawer(dr) {
    drawerStack = drawerStack.filter(function (d) { return d !== dr; });
    drawerStack.push(dr);
    dr.style.zIndex = 50 + drawerStack.length;
    dr.hidden = false;
    requestAnimationFrame(function () { requestAnimationFrame(function () { dr.classList.add('is-open'); }); });
    document.body.style.overflow = 'hidden';
  }
  function closeDrawer(dr) {
    drawerStack = drawerStack.filter(function (d) { return d !== dr; });
    dr.classList.remove('is-open');
    if (!drawerStack.length) document.body.style.overflow = '';
    dr.dispatchEvent(new CustomEvent('drawer:closed'));
    setTimeout(function () { if (!dr.classList.contains('is-open')) dr.hidden = true; }, 380);
  }
  $$('.drawer').forEach(function (dr) {
    dr.addEventListener('click', function (e) {
      if (e.target.closest('[data-close]')) closeDrawer(dr);
    });
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape' || !$('#confirm').hidden || !$('#promptDlg').hidden) return;
    var top = drawerStack[drawerStack.length - 1];
    if (top) closeDrawer(top);
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
  // Converte para WebP dentro de um limite de tamanho. Padrão: imagens de projeto.
  function toWebP(file, maxDim, maxChars) {
    maxDim = maxDim || IMG_MAX_DIM;
    maxChars = maxChars || IMG_MAX_CHARS;
    return loadImage(file).then(function (img) {
      var w = img.naturalWidth, h = img.naturalHeight;
      var scale = Math.min(1, maxDim / Math.max(w, h));
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
        if (data.length <= maxChars) return data;
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
  // Modo demonstração (dados de exemplo em memória, nunca vão para o banco)
  // =================================================================
  function demoApi() {
    var now = Date.now();
    var H = 3600000, D = 24 * H;
    var ago = function (ms) { return new Date(now - ms); };
    var ahead = function (ms) { return new Date(now + ms); };
    var today = function (h) { var d = new Date(); d.setHours(h, 0, 0, 0); return d; };
    var CONSENT = 'Concordo que a Cron Web Studio use estes dados para entrar em contato sobre o meu projeto, conforme a Política de Privacidade e a LGPD.';
    var DEL = { __del: true };
    var site = function (o) {
      return Object.assign({ origin: 'site', email: '', company: '', need: '', message: '', source: 'hero-primary', sourceLabel: 'Quero meu site rodando', project: '', notes: '', consent: true, consentText: CONSENT, utm: {}, page: 'https://cronwebstudio.com.br/', referrer: '' }, o, { consentAt: o.createdAt });
    };
    var mem = {
      leads: [
        site({ id: 'l1', name: 'Mariana Duarte', whatsapp: '14998123456', email: 'mariana@studioduarte.com.br', company: 'Studio Duarte', need: 'institucional', message: 'Quero um site novo pro estúdio, hoje dependo de agência pra trocar qualquer foto.', status: 'novo', createdAt: ago(0.4 * H), stageAt: ago(0.4 * H), utm: { source: 'instagram', medium: 'bio' }, referrer: 'https://l.instagram.com/' }),
        site({ id: 'l2', name: 'Ricardo Albuquerque', whatsapp: '11987654321', company: 'Albuquerque Peças', need: 'sistema', message: 'Vi o projeto da Meccal e quero algo parecido.', source: 'case-meccal', sourceLabel: 'Quero um assim', project: 'Meccal', status: 'em_conversa', createdAt: ago(5 * D), stageAt: ago(3 * D), channel: 'whatsapp', nextStep: { text: 'Mandar exemplos de catálogo', dueAt: ago(1 * D) } }),
        { id: 'l3', origin: 'cronus', createdBy: 'cronus', batchId: 'r1', name: 'Sérgio Tavares', role: 'Sócio-diretor', company: 'Tavares Móveis Planejados', niche: 'industria-moveis', whatsapp: '43999887766', instagram: 'tavaresmoveis', currentSite: '', siteStatus: 'sem_site', siteScore: 0, siteReason: 'Só tem Instagram e um link de catálogo em PDF.', googleRating: 4.8, googleReviews: 212, channel: 'whatsapp', fitReason: 'Fábrica com mais de 15 anos, catálogo grande e só PDF no WhatsApp.', status: 'mensagem_pronta', createdAt: ago(1 * D), stageAt: ago(1 * D), draft: { channel: 'whatsapp', text: 'Oi, Sérgio, tudo bem? Aqui é o Pedro, da Cron. Vi o trabalho da Tavares no Instagram e reparei que o catálogo vai por PDF. A gente monta catálogos online que a própria equipe atualiza. Posso te mostrar um exemplo?', approved: false }, sources: { whatsapp: 'google_maps', instagram: 'busca' }, googleMapsUrl: 'https://maps.google.com/?cid=1', notes: '' },
        { id: 'l4', origin: 'cronus', createdBy: 'cronus', batchId: 'r1', name: '', company: 'Vidraçaria Horizonte', niche: 'construcao-vidracaria', whatsapp: '14996660011', instagram: 'horizontevidros', currentSite: 'https://horizontevidros.com.br', siteStatus: 'site_fraco', siteScore: 3, siteReason: 'Lento no celular, sem formulário e fotos de 2016.', googleRating: 4.6, googleReviews: 98, channel: 'instagram', fitReason: 'Bem avaliada, portfólio de obras e site parado.', status: 'mensagem_pronta', createdAt: ago(1 * D), stageAt: ago(1 * D), draft: { channel: 'instagram', text: 'Oi, pessoal da Horizonte! Aqui é o Pedro, da Cron. As obras de vocês no Instagram são ótimas, mas o site não mostra isso. Posso mandar uma ideia de como ficaria?', approved: true, approvedAt: ago(2 * H) }, notes: '' },
        { id: 'l5', origin: 'cronus', createdBy: 'cronus', name: 'Ana Ribeiro', company: 'Clínica Sorriso Pleno', niche: 'saude-odontologia', whatsapp: '16991234567', instagram: 'sorrisopleno', siteStatus: 'site_fraco', siteScore: 4, channel: 'whatsapp', status: 'abordado', createdAt: ago(4 * D), stageAt: ago(2 * D), draft: { channel: 'whatsapp', text: 'Oi, Ana! Aqui é o Pedro, da Cron...', approved: true, approvedAt: ago(2 * D), sentAt: ago(2 * D) }, nextStep: { text: 'Follow-up se não responder', dueAt: today(17) }, notes: '' },
        { id: 'l6', origin: 'indicacao', createdBy: 'admin', name: 'Carlos Menezes', role: 'Gerente comercial', company: 'Menezes Distribuidora', niche: 'distribuidor-hospitalar', whatsapp: '5514997776655', phone: '1432345678', email: 'carlos@menezesdist.com.br', channel: 'whatsapp', status: 'respondeu', createdAt: ago(6 * D), stageAt: ago(1 * D), fitReason: 'Indicação da MedControl.', nextStep: { text: 'Ligar para entender o catálogo', dueAt: ahead(3 * H) }, notes: '' },
        site({ id: 'l7', name: 'Fernanda Lopes', whatsapp: '14996541230', email: 'fernanda@clinicavita.com', company: 'Clínica Vita', need: 'sistema', message: 'Precisamos de um painel pra equipe atualizar convênios e médicos.', source: 'plano-sistema', sourceLabel: 'Quero o plano Sistema', status: 'reuniao', createdAt: ago(9 * D), stageAt: ago(2 * D), meetingAt: ahead(1 * D + 2 * H), utm: { source: 'google', medium: 'organic' }, referrer: 'https://www.google.com/' }),
        site({ id: 'l8', name: 'João Pedro Martins', whatsapp: '1432231122', status: 'proposta', source: 'final-whatsapp', sourceLabel: 'Quero conversar', createdAt: ago(12 * D), stageAt: ago(5 * D), notes: 'Proposta enviada, plano institucional.', nextStep: { text: 'Cobrar retorno da proposta', dueAt: ago(2 * D) } }),
        site({ id: 'l9', name: 'Camila Rocha', whatsapp: '14991112233', email: 'camila@rochaarq.com.br', company: 'Rocha Arquitetura', need: 'institucional', status: 'fechado', createdAt: ago(30 * D), stageAt: ago(20 * D), notes: 'Fechou institucional.' }),
        site({ id: 'l10', name: 'Paulo Nogueira', whatsapp: '11955554444', company: 'PN Transportes', need: 'sistema', message: 'Orçamento pra sistema de rastreio.', source: 'final-whatsapp', status: 'perdido', lostReason: 'Fora do escopo (rastreamento de frota).', createdAt: ago(40 * D), stageAt: ago(35 * D) }),
        site({ id: 'l11', name: 'Beatriz Couto', whatsapp: '21988887777', company: 'Couto Advocacia', need: 'institucional', status: 'contato', createdAt: ago(15 * D), stageAt: ago(14 * D), notes: 'Lead antigo, ainda com a etapa "contato".' }),
        { id: 'l12', origin: 'manual', createdBy: 'admin', name: 'Rogério Lima', company: 'Lima Usinagem', niche: 'industria-usinagem', phone: '1433334444', whatsapp: '', email: 'compras@limausinagem.com.br', channel: 'email', status: 'novo', createdAt: ago(3 * H), stageAt: ago(3 * H), notes: '' }
      ],
      inter: {
        l2: [{ id: 'i1', type: 'mudanca_etapa', from: 'novo', to: 'em_conversa', text: '', channel: '', createdAt: ago(3 * D), createdBy: 'admin' },
             { id: 'i2', type: 'nota', text: 'Quer catálogo de peças com busca por código.', channel: '', from: '', to: '', createdAt: ago(3 * D - H), createdBy: 'admin' }],
        l5: [{ id: 'i3', type: 'mensagem_enviada', text: 'Oi, Ana! Aqui é o Pedro, da Cron...', channel: 'whatsapp', from: '', to: '', createdAt: ago(2 * D), createdBy: 'admin' }],
        l6: [{ id: 'i4', type: 'resposta', text: 'Respondeu que quer conversar na semana que vem.', channel: 'whatsapp', from: '', to: '', createdAt: ago(1 * D), createdBy: 'admin' }]
      },
      projects: [
        { id: 'p1', client: 'Meccal', segment: 'Indústria', title: 'Catálogo industrial que o próprio time atualiza.', description: 'Produtos, categorias e fichas técnicas gerenciados por um painel simples. A equipe publica sozinha, sem abrir chamado.', quote: { text: '', author: '' }, tags: ['Catálogo', 'Painel administrativo', 'SEO'], ctaLabel: 'Quero um assim', siteUrl: 'https://meccal.com.br', siteLabel: 'Ver site no ar', image: '', imageAlt: '', published: true, order: 0 },
        { id: 'p2', client: 'Plane Aviation', segment: 'Aviação executiva', title: 'Frota e serviços sempre atualizados.', description: 'Site institucional com painel para aeronaves, serviços e galeria.', quote: { text: 'Hoje a gente atualiza tudo sozinho.', author: 'Plane Aviation' }, tags: ['Institucional', 'Painel'], ctaLabel: '', siteUrl: '', siteLabel: '', image: '', imageAlt: '', published: true, order: 1 }
      ]
    };
    mem.rodadas = [
      { id: 'r1', niche: 'industria-moveis', nicheLabel: 'Indústria de móveis', region: 'Interior de SP', criteria: { minRating: 4.3, minReviews: 30, siteStatusAccepted: ['sem_site', 'site_fraco'], requireContact: true }, funnel: { encontradas: 48, notaMinima: 31, avaliacoes: 22, siteSemOuFraco: 14, comContato: 9, qualificadas: 6 }, status: 'em_andamento', notes: 'Primeira rodada de teste.', createdBy: 'cronus', createdAt: ago(1 * D), updatedAt: ago(2 * H) },
      { id: 'r2', niche: 'saude-odontologia', nicheLabel: 'Clínicas odontológicas', region: 'Norte do PR', criteria: { minRating: 4.5, minReviews: 50, siteStatusAccepted: ['site_fraco'], requireContact: true }, funnel: { encontradas: 30, notaMinima: 20, avaliacoes: 12, siteSemOuFraco: 6, comContato: 5, qualificadas: 3 }, status: 'concluida', notes: '', createdBy: 'cronus', createdAt: ago(6 * D), updatedAt: ago(4 * D) }
    ];
    var pend = function (o) {
      return Object.assign({ origin: 'cronus', createdBy: 'cronus', batchId: 'r1', prospectState: 'pendente', status: 'novo', niche: 'industria-moveis', notes: '', createdAt: ago(20 * H), stageAt: ago(20 * H) }, o);
    };
    mem.leads.push(
      pend({ id: 'l13', name: 'Marcos Bellini', role: 'Proprietário', company: 'Bellini Estofados', whatsapp: '43998765432', instagram: 'bellini.estofados', currentSite: 'https://bellini.com.br', siteStatus: 'site_fraco', siteScore: 2, siteReason: 'Site de 2014, não abre bem no celular e sem catálogo.', googleRating: 4.7, googleReviews: 156, channel: 'whatsapp', fitReason: 'Fábrica com 20 anos, linha grande de estofados e site parado.', drafts: { whatsapp: 'Oi, Marcos, tudo bem? Aqui é o Pedro, da Cron. Vi a linha de estofados da Bellini e reparei que o site não mostra os modelos. A gente cria catálogos online que a própria equipe atualiza. Posso te mandar um exemplo?', instagram: 'Oi, pessoal da Bellini! Aqui é o Pedro, da Cron. Os estofados de vocês merecem um catálogo à altura. Posso mandar uma ideia?' }, sources: { whatsapp: 'google_maps', instagram: 'busca', currentSite: 'busca' } }),
      pend({ id: 'l14', company: 'Arte em Madeira Planejados', whatsapp: '14991230987', email: 'contato@arteemmadeira.com.br', siteStatus: 'sem_site', siteScore: 0, siteReason: 'Sem site, só perfil no Google.', googleRating: 4.9, googleReviews: 88, channel: 'whatsapp', fitReason: 'Avaliação alta e sem site próprio.', drafts: { whatsapp: 'Oi! Aqui é o Pedro, da Cron. Vi as avaliações da Arte em Madeira no Google, muito boas. Hoje quem procura vocês não encontra um site. Posso mostrar como ficaria um?', email: 'Olá, equipe da Arte em Madeira. Sou o Pedro, da Cron Web Studio...' } }),
      pend({ id: 'l15', company: 'Moveis Sartori', instagram: 'moveissartori', siteStatus: 'site_fraco', siteScore: 4, siteReason: 'Página única sem formulário.', googleRating: 4.4, googleReviews: 41, channel: 'instagram', fitReason: 'Boa nota, portfólio no Instagram, site fraco.', drafts: { instagram: 'Oi, pessoal da Sartori! Aqui é o Pedro, da Cron. O portfólio de vocês no Instagram é ótimo. Posso mandar uma ideia de site que mostre isso?' } }),
      pend({ id: 'l16', company: 'Lar Design Móveis', whatsapp: '43997651234', siteStatus: 'ok', siteScore: 7, googleRating: 4.3, googleReviews: 33, channel: 'whatsapp', fitReason: '' }),
      pend({ id: 'l17', company: 'Casa Nobre Móveis', siteStatus: 'sem_site', googleRating: 4.5, googleReviews: 60, prospectState: 'descartado', discardReason: 'Sem nenhum contato encontrado.' })
    );
    mem.leads.forEach(function (l) { if (l.id === 'l3' || l.id === 'l4') l.prospectState = 'aprovado'; });
    // Sites modelo de exemplo (os mesmos de modelo/demo-data.js, para abrir em modelo/?demo=<id>)
    var DM = window.CRON_MODELO_DEMO;
    mem.pindex = {}; // leadId -> [{ id, niche, formatReason, createdAt }] (índice privado)
    mem.previews = DM ? DM.list().map(function (p) {
      var d = p.demo || {};
      delete p.demo;
      (mem.pindex[d.leadId] = mem.pindex[d.leadId] || []).push({ id: p.id, niche: d.niche || '', formatReason: d.formatReason || '', createdAt: ago(3 * H) });
      p._lead = d.leadId;
      p._formatReason = d.formatReason || '';
      return Object.assign({ createdAt: ago(3 * H), updatedAt: ago(3 * H), createdBy: 'admin' }, p);
    }) : [];
    mem.owner = 'demoAdminUid000000000001';
    mem.bots = [{ id: 'demoBotUid00000000000001', name: 'CronUS (exemplo)', email: 'cronus@cronwebstudio.com.br', role: 'bot', createdAt: ago(2 * D) }];
    mem.kits = {};
    var setQ = function (id, o) { var l = mem.leads.find(function (x) { return x.id === id; }); if (l) Object.assign(l, o); };
    var byLead = function (leadId) { return mem.previews.find(function (p) { return (p._lead || p.leadIdDemo) === leadId; }); };
    mem.previews.forEach(function (p) {
      var leadId = p._lead, fr = p._formatReason;
      delete p._lead; delete p._formatReason;
      p.leadIdDemo = leadId;
      setQ(leadId, {
        qualification: 'qualificado', format: p.format, formatReason: fr, previewId: p.id,
        brand: { primaryColor: p.primaryColor || '', secondaryColor: p.secondaryColor || '', tagline: p.tagline || '', mainService: p.mainService || '', services: (p.services || []).slice() }
      });
      mem.kits[leadId] = { logo: p.logo || '', products: (p.products || []).slice(), categories: (p.categories || []).slice() };
    });
    var byLeadIdx = function (leadId) { return (mem.pindex[leadId] || []).map(function (x) { return x.id; }); };
    var publicCopy = function (p) { var o = clone(p); delete o.leadIdDemo; return o; };
    if (byLead('l4')) { var l4 = mem.leads.find(function (x) { return x.id === 'l4'; }); l4.draft.previewId = byLead('l4').id; l4.draft.text += ' {link}'; }
    setQ('l15', { qualification: 'desqualificado', disqualifyReason: 'Já tem site novo, feito este ano.' });
    setQ('l16', { qualification: '', format: '' });
    // Prévias do modo demo também ficam no navegador, para a página modelo/?demo= encontrar
    var saveLocal = function (p) {
      try { localStorage.setItem('cron_demo_preview_' + p.id, JSON.stringify(publicCopy(p))); } catch (e) {}
    };
    mem.previews.forEach(saveLocal);
    mem.admins = [
      { id: 'demoAdminUid000000000001', name: 'Pedro Spadotto', email: 'pedro@cronwebstudio.com.br', role: 'admin', createdAt: ago(60 * D) },
      { id: 'demoAdminUid000000000002', name: '', email: '', createdAt: ago(30 * D) }
    ];
    var listener = null, interListeners = {}, rodListener = null, admListener = null, botListener = null;
    function emitRod() { if (rodListener) rodListener(mem.rodadas.slice().sort(function (a, b) { return b.createdAt - a.createdAt; })); }
    function emitAdm() { if (admListener) admListener(mem.admins.slice()); }
    function emit() { if (listener) listener(mem.leads.slice().sort(function (a, b) { return b.createdAt - a.createdAt; })); }
    function emitInter(id) {
      var cb = interListeners[id];
      if (cb) cb((mem.inter[id] || []).slice().sort(function (a, b) { return b.createdAt - a.createdAt; }));
    }
    function clone(o) { return JSON.parse(JSON.stringify(o)); }
    var wait = function (v) { return new Promise(function (r) { setTimeout(function () { r(v); }, 200); }); };
    // aplica caminhos com ponto ('draft.approved') e o marcador de exclusão
    function apply(obj, data) {
      Object.keys(data).forEach(function (k) {
        var parts = k.split('.'), o = obj;
        for (var i = 0; i < parts.length - 1; i++) { o[parts[i]] = o[parts[i]] || {}; o = o[parts[i]]; }
        var last = parts[parts.length - 1];
        if (data[k] === DEL) delete o[last]; else o[last] = data[k];
      });
    }
    function pushInter(id, list) {
      (list || []).forEach(function (it) {
        mem.inter[id] = mem.inter[id] || [];
        mem.inter[id].push({ id: 'i' + Math.random().toString(36).slice(2), type: it.type, text: it.text || '', channel: it.channel || '', from: it.from || '', to: it.to || '', createdAt: new Date(), createdBy: 'admin' });
      });
      emitInter(id);
    }
    return {
      now: function () { return new Date(); },
      del: function () { return DEL; },
      watchLeads: function (cb) { listener = cb; setTimeout(emit, 150); return function () { listener = null; }; },
      updateLead: function (id, data, inters) {
        var l = mem.leads.find(function (x) { return x.id === id; });
        apply(l, data); l.updatedAt = new Date();
        pushInter(id, inters);
        return wait().then(emit);
      },
      createLead: function (data, inters) {
        var id = 'l' + Date.now();
        var l = { id: id, createdAt: new Date(), stageAt: new Date(), createdBy: 'admin' };
        apply(l, data);
        mem.leads.push(l);
        pushInter(id, inters);
        return wait(id).then(function (v) { emit(); return v; });
      },
      deleteLead: function (id) {
        mem.leads = mem.leads.filter(function (x) { return x.id !== id; });
        delete mem.inter[id];
        delete mem.kits[id];
        var ids = byLeadIdx(id);
        mem.previews = mem.previews.filter(function (p) {
          if (ids.indexOf(p.id) === -1) return true;
          try { localStorage.removeItem('cron_demo_preview_' + p.id); } catch (e) {}
          return false;
        });
        delete mem.pindex[id];
        return wait().then(emit);
      },
      getKit: function (leadId) { return wait(mem.kits[leadId] ? clone(mem.kits[leadId]) : null); },
      saveKit: function (leadId, data) {
        mem.kits[leadId] = clone(data);
        return wait();
      },
      listPreviews: function (leadId) {
        var idx = mem.pindex[leadId] || [];
        return wait(idx.map(function (m) {
          var p = mem.previews.find(function (x) { return x.id === m.id; });
          return p ? Object.assign(publicCopy(p), { formatReason: m.formatReason, niche: m.niche }) : null;
        }).filter(Boolean).sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); }));
      },
      getPreview: function (id) { var p = mem.previews.find(function (x) { return x.id === id; }); return wait(p ? publicCopy(p) : null); },
      getOwner: function () { return wait(mem.owner); },
      watchBots: function (cb) { botListener = cb; setTimeout(function () { cb(mem.bots.slice()); }, 120); return function () { botListener = null; }; },
      addBot: function (uid, data) {
        if (mem.bots.some(function (b) { return b.id === uid; }) || mem.admins.some(function (a) { return a.id === uid; })) return Promise.reject({ code: 'already-exists' });
        mem.bots.push(Object.assign({ id: uid, role: 'bot', createdAt: new Date(), createdBy: mem.owner }, data));
        return wait().then(function () { if (botListener) botListener(mem.bots.slice()); });
      },
      removeBot: function (uid) {
        mem.bots = mem.bots.filter(function (b) { return b.id !== uid; });
        return wait().then(function () { if (botListener) botListener(mem.bots.slice()); });
      },
      createPreview: function (data, leadId, meta, oldId) {
        var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', id = '';
        for (var i = 0; i < 20; i++) id += chars.charAt(Math.floor(Math.random() * chars.length));
        var p = Object.assign({}, clone(data), { id: id, active: true, createdBy: 'admin', createdAt: new Date(), updatedAt: new Date() });
        mem.previews.push(p);
        saveLocal(p);
        (mem.pindex[leadId] = mem.pindex[leadId] || []).push({ id: id, niche: (meta && meta.niche) || '', formatReason: (meta && meta.formatReason) || '', createdAt: new Date() });
        if (oldId) { var o = mem.previews.find(function (x) { return x.id === oldId; }); if (o) { o.active = false; saveLocal(o); } }
        var l = mem.leads.find(function (x) { return x.id === leadId; });
        if (l) { l.previewId = id; l.updatedAt = new Date(); }
        pushInter(leadId, [{ type: 'nota', text: oldId ? 'Site modelo gerado de novo.' : 'Site modelo gerado.' }]);
        return wait(id).then(function (v) { emit(); return v; });
      },
      updatePreview: function (id, data) {
        var p = mem.previews.find(function (x) { return x.id === id; });
        if (p) { apply(p, clone(data)); Object.keys(data).forEach(function (k) { if (data[k] === DEL) delete p[k]; }); p.updatedAt = new Date(); saveLocal(p); }
        return wait();
      },
      setPreviewActive: function (id, active) {
        var p = mem.previews.find(function (x) { return x.id === id; });
        if (p) { p.active = !!active; p.updatedAt = new Date(); saveLocal(p); }
        return wait();
      },
      watchInteractions: function (id, cb) { interListeners[id] = cb; setTimeout(function () { emitInter(id); }, 100); return function () { delete interListeners[id]; }; },
      addInteraction: function (id, it) { pushInter(id, [it]); return wait(); },
      updateLeads: function (items) {
        items.forEach(function (it) {
          var l = mem.leads.find(function (x) { return x.id === it.id; });
          if (!l) return;
          apply(l, it.data); l.updatedAt = new Date();
          pushInter(it.id, it.inters);
        });
        return wait().then(emit);
      },
      watchRodadas: function (cb) { rodListener = cb; setTimeout(emitRod, 120); return function () { rodListener = null; }; },
      createRodada: function (data) {
        var id = 'r' + Date.now();
        mem.rodadas.push(Object.assign({ id: id, createdAt: new Date(), updatedAt: new Date(), createdBy: 'admin' }, data));
        return wait(id).then(function (v) { emitRod(); return v; });
      },
      updateRodada: function (id, data) {
        var r = mem.rodadas.find(function (x) { return x.id === id; });
        apply(r, data); r.updatedAt = new Date();
        return wait().then(emitRod);
      },
      watchAdmins: function (cb) { admListener = cb; setTimeout(emitAdm, 120); return function () { admListener = null; }; },
      addAdmin: function (uid, data) {
        if (mem.admins.some(function (a) { return a.id === uid; })) return Promise.reject({ code: 'already-exists' });
        mem.admins.push(Object.assign({ id: uid, role: 'admin', createdAt: new Date(), createdBy: 'demoAdminUid000000000001' }, data));
        return wait().then(emitAdm);
      },
      updateAdmin: function (uid, data) {
        var a = mem.admins.find(function (x) { return x.id === uid; });
        if (a) apply(a, data);
        return wait().then(emitAdm);
      },
      removeAdmin: function (uid) {
        if (uid === mem.owner) return Promise.reject({ code: 'owner-protected' });
        mem.admins = mem.admins.filter(function (a) { return a.id !== uid; });
        return wait().then(emitAdm);
      },
      createAuthUser: function (email) {
        if (/existe@/.test(email)) return Promise.reject({ code: 'auth/email-already-in-use' });
        return wait('demoUid' + Math.random().toString(36).slice(2, 12) + 'xxxxxxxxxx');
      },
      migrateLegacyStatus: function () {
        var n = 0;
        mem.leads.forEach(function (l) { if (l.status === 'contato') { l.status = 'em_conversa'; n++; } });
        return wait(n).then(function (v) { emit(); return v; });
      },
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
