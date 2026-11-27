// Cron Web Studio · Usuários do painel (aba "Usuários")
// Quem tem documento em admins/{uid} entra no painel. Aqui você adiciona e remove esse acesso.
// Sem Cloud Functions: a conta de login é criada num app secundário do Firebase, para não
// trocar a sua sessão. Remover tira o acesso ao painel na hora; a conta de login continua
// existindo no Firebase (para apagar de vez: console > Authentication > Usuários).

(function () {
  'use strict';

  var A = window.CRON_ADMIN;
  if (!A || !A.api) return;

  var api = A.api, $ = A.$, esc = A.esc, toDate = A.toDate, fmtDate = A.fmtDate,
    initials = A.initials, toast = A.toast, confirmBox = A.confirmBox;

  var admins = [], bots = [], owner = '', ownerLoaded = false, unsub = null, unsubBots = null, editing = null;
  var EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

  A.register({
    start: function () {
      unsub = api.watchAdmins(function (list) { admins = list; render(); }, function (err) {
        console.error(err);
        $('#userList').innerHTML = '<p class="empty-line">Não foi possível carregar os usuários. Confira se as regras novas foram publicadas.</p>';
      });
      api.getOwner().then(function (uid) { owner = uid || ''; ownerLoaded = true; render(); });
      unsubBots = api.watchBots(function (list) { bots = list; renderBots(); }, function (err) {
        console.error(err);
        $('#botList').innerHTML = '<p class="empty-line">Não foi possível carregar o assistente. Confira se as regras novas foram publicadas.</p>';
      });
    },
    stop: function () {
      if (unsub) unsub();
      if (unsubBots) unsubBots();
      unsub = unsubBots = null;
    }
  });

  function render() {
    var me = A.user.uid;
    var list = admins.slice().sort(function (a, b) {
      if (a.id === me) return -1;
      if (b.id === me) return 1;
      return (a.name || a.email || '').localeCompare(b.name || b.email || '');
    });
    $('#ownerWarn').hidden = !ownerLoaded || !!owner;
    $('#userList').innerHTML = list.map(function (u) {
      var mine = u.id === me;
      var isOwner = !!owner && u.id === owner;
      var name = u.name || (mine && !u.email ? 'Você' : '') || 'Sem nome';
      var email = u.email || (mine ? A.user.email : '');
      var created = toDate(u.createdAt);
      return '<article class="user">' +
        '<span class="avatar">' + esc(initials(u.name || email || '?')) + '</span>' +
        '<div class="user__info">' +
          '<strong>' + esc(name) + (isOwner ? ' <span class="user__owner">Dono</span>' : '') + (mine ? ' <span class="user__me">Você</span>' : '') + '</strong>' +
          '<span>' + esc(email || 'E-mail não informado') + '</span>' +
          '<small>UID ' + esc(u.id) + (created ? ' · desde ' + fmtDate(created) : '') + '</small>' +
        '</div>' +
        '<div class="user__actions">' +
          '<button class="btn btn--ghost" type="button" data-uedit="' + esc(u.id) + '">Editar</button>' +
          (mine || isOwner ? '' : '<button class="btn-danger" type="button" data-uremove="' + esc(u.id) + '">Remover</button>') +
        '</div>' +
      '</article>';
    }).join('') || '<p class="empty-line">Nenhum usuário encontrado.</p>';
  }

  $('#userList').addEventListener('click', function (e) {
    var b = e.target.closest('[data-uremove]');
    if (b) {
      var u = admins.find(function (x) { return x.id === b.dataset.uremove; });
      if (!u || u.id === A.user.uid || (owner && u.id === owner)) return;
      confirmBox('Remover o acesso de ' + (u.name || u.email || 'este usuário') + '?',
        'A pessoa sai do painel na hora. A conta de login continua no Firebase; para apagar de vez, use o console em Authentication > Usuários.', 'Remover')
        .then(function (ok) {
          if (!ok) return;
          api.removeAdmin(u.id).then(function () { toast('Acesso removido'); })
            .catch(function (err) {
              console.error(err);
              toast(err && err.code === 'owner-protected' ? 'O acesso do dono não pode ser removido.'
                : err && err.code === 'permission-denied' && !owner ? 'Para remover usuários, crie primeiro o documento config/owner no Firebase (veja o SETUP.md).'
                : 'Não foi possível remover.', true);
            });
        });
      return;
    }
    var ed = e.target.closest('[data-uedit]');
    if (ed) openUser(admins.find(function (x) { return x.id === ed.dataset.uedit; }));
  });

  // ---------- Gaveta ----------
  var drawer = $('#userDrawer'), form = $('#userForm'), msg = $('#usMsg');

  function syncMethod() {
    var m = form.method.value;
    $('#usPassWrap').hidden = editing || m !== 'password';
    $('#usUidWrap').hidden = editing || m !== 'uid';
  }
  Array.prototype.forEach.call(form.querySelectorAll('[name="method"]'), function (r) { r.addEventListener('change', syncMethod); });

  $('#newUser').addEventListener('click', function () { openUser(null); });

  function openUser(u) {
    editing = u ? u.id : null;
    form.reset();
    msg.textContent = '';
    msg.className = 'form-msg';
    $('#usTitle').textContent = u ? 'Editar usuário' : 'Adicionar usuário';
    $('#usSave').textContent = u ? 'Salvar' : 'Adicionar';
    $('#usMethodBox').hidden = !!u;
    if (u) {
      form.name.value = u.name || '';
      form.email.value = u.email || (u.id === A.user.uid ? A.user.email : '');
    }
    syncMethod();
    A.openDrawer(drawer);
    setTimeout(function () { form.name.focus(); }, 250);
  }

  function authError(err) {
    var c = err && err.code || '';
    if (c === 'auth/email-already-in-use') return 'Esse e-mail já tem conta no Firebase. Escolha "A conta já existe no Firebase" e cole o UID que aparece em Authentication > Usuários.';
    if (c === 'auth/admin-restricted-operation' || c === 'auth/operation-not-allowed') return 'A criação de contas pelo site está desligada no Firebase. Crie a conta no console (Authentication > Usuários > Adicionar usuário), copie o UID e use a opção "A conta já existe no Firebase".';
    if (c === 'auth/weak-password') return 'Senha fraca. Use pelo menos 8 caracteres, misturando letras e números.';
    if (c === 'auth/invalid-email') return 'E-mail inválido.';
    if (c === 'auth/too-many-requests') return 'Muitas tentativas seguidas. Espere alguns minutos e tente de novo.';
    if (c === 'permission-denied') return 'O banco recusou a gravação. Confira se as regras novas foram publicadas.';
    if (c === 'already-exists') return 'Essa pessoa já tem acesso ao painel.';
    return 'Não foi possível concluir. Tente de novo.';
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    msg.className = 'form-msg';
    var name = form.name.value.trim().slice(0, 80);
    var email = form.email.value.trim().toLowerCase();
    if (name.length < 2) { msg.textContent = 'Preencha o nome.'; return; }
    if (!EMAIL.test(email) || email.length > 160) { msg.textContent = 'Preencha um e-mail válido.'; return; }
    var btn = $('#usSave');

    if (editing) {
      btn.disabled = true;
      api.updateAdmin(editing, { name: name, email: email }).then(function () {
        toast('Usuário salvo');
        A.closeDrawer(drawer);
      }).catch(function (err) { msg.textContent = authError(err); }).then(function () { btn.disabled = false; });
      return;
    }

    if (admins.some(function (a) { return (a.email || '').toLowerCase() === email; })) {
      msg.textContent = 'Esse e-mail já tem acesso ao painel.';
      return;
    }
    var method = form.method.value;
    var getUid;
    if (method === 'uid') {
      var uid = form.uid.value.trim();
      if (!/^[A-Za-z0-9]{20,40}$/.test(uid)) { msg.textContent = 'O UID tem só letras e números (cerca de 28 caracteres).'; return; }
      if (admins.some(function (a) { return a.id === uid; })) { msg.textContent = 'Esse UID já tem acesso ao painel.'; return; }
      getUid = Promise.resolve(uid);
    } else {
      var pass = method === 'password' ? form.password.value : '';
      if (method === 'password' && pass.length < 8) { msg.textContent = 'A senha provisória precisa de pelo menos 8 caracteres.'; return; }
      getUid = api.createAuthUser(email, pass);
    }
    btn.disabled = true;
    msg.textContent = 'Criando acesso…';
    getUid.then(function (uid) {
      return api.addAdmin(uid, { name: name, email: email }).then(function () { return uid; });
    }).then(function () {
      A.closeDrawer(drawer);
      toast(method === 'invite' ? 'Usuário adicionado. O e-mail para criar a senha foi enviado.'
        : method === 'password' ? 'Usuário adicionado. Passe a senha provisória para a pessoa.'
        : 'Usuário adicionado.');
    }).catch(function (err) {
      console.error(err);
      msg.textContent = authError(err);
    }).then(function () { btn.disabled = false; });
  });
  // =================================================================
  // Assistente (CronUS): conta criada no console, liberada aqui por bots/{uid}
  // =================================================================
  function renderBots() {
    $('#botList').innerHTML = bots.length ? bots.map(function (b) {
      var created = toDate(b.createdAt);
      return '<article class="user user--bot">' +
        '<span class="avatar avatar--bot" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="5" y="8" width="14" height="11" rx="3"/><path d="M12 4v4M9 13h.01M15 13h.01"/></svg></span>' +
        '<div class="user__info">' +
          '<strong>' + esc(b.name || 'Assistente') + ' <span class="user__bot">Assistente</span></strong>' +
          '<span>' + esc(b.email || 'E-mail não informado') + '</span>' +
          '<small>UID ' + esc(b.id) + (created ? ' · desde ' + fmtDate(created) : '') + ' · grava prospecção, não entra no painel</small>' +
        '</div>' +
        '<div class="user__actions"><button class="btn-danger" type="button" data-bremove="' + esc(b.id) + '">Remover</button></div>' +
      '</article>';
    }).join('') : '<p class="empty-line">Nenhum assistente liberado.</p>';
  }

  $('#botList').addEventListener('click', function (e) {
    var b = e.target.closest('[data-bremove]');
    if (!b) return;
    var bot = bots.find(function (x) { return x.id === b.dataset.bremove; });
    if (!bot) return;
    confirmBox('Remover o assistente ' + (bot.name || '') + '?',
      'Ele perde a permissão de gravar na hora. A conta de login continua no Firebase; para apagar de vez, use o console em Authentication > Usuários.', 'Remover')
      .then(function (ok) {
        if (!ok) return;
        api.removeBot(bot.id).then(function () { toast('Assistente removido'); })
          .catch(function (err) { console.error(err); toast('Não foi possível remover.', true); });
      });
  });

  var bDrawer = $('#botDrawer'), bForm = $('#botForm'), bMsg = $('#bMsg');
  $('#newBot').addEventListener('click', function () {
    bForm.reset();
    bMsg.textContent = '';
    A.openDrawer(bDrawer);
    setTimeout(function () { bForm.uid.focus(); }, 250);
  });
  bForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var uid = bForm.uid.value.trim(), name = bForm.name.value.trim().slice(0, 80), email = bForm.email.value.trim().toLowerCase();
    if (!/^[A-Za-z0-9]{20,40}$/.test(uid)) { bMsg.textContent = 'O UID tem só letras e números (cerca de 28 caracteres).'; return; }
    if (name.length < 2) { bMsg.textContent = 'Dê um nome ao assistente.'; return; }
    if (!EMAIL.test(email) || email.length > 160) { bMsg.textContent = 'Preencha o e-mail da conta do assistente.'; return; }
    if (admins.some(function (a) { return a.id === uid; })) { bMsg.textContent = 'Esse UID é de um usuário do painel. O assistente precisa de uma conta só dele.'; return; }
    if (bots.some(function (b) { return b.id === uid; })) { bMsg.textContent = 'Esse assistente já está liberado.'; return; }
    var btn = $('#bSave');
    btn.disabled = true;
    api.addBot(uid, { name: name, email: email }).then(function () {
      toast('Assistente liberado');
      A.closeDrawer(bDrawer);
    }).catch(function (err) {
      console.error(err);
      bMsg.textContent = err && err.code === 'permission-denied'
        ? 'O banco recusou. Confira se as regras novas foram publicadas e se esse UID não é de um usuário do painel.'
        : err && err.code === 'already-exists' ? 'Esse UID já está em uso.' : 'Não foi possível liberar. Tente de novo.';
    }).then(function () { btn.disabled = false; });
  });
})();
