// Cron Web Studio · Formulário de lead
// Todos os CTAs com href="#" e data-cta abrem o formulário.
// O data-cta vira a "origem" do lead no admin, pra saber qual botão converte mais.
// Links com data-no-form (ex.: "Ver site no ar") não abrem o formulário.

(function () {
  var modal = document.getElementById('leadModal');
  if (!modal) return;

  var form = document.getElementById('leadForm');
  var card = modal.querySelector('.lf__card');
  var titleEl = document.getElementById('leadTitle');
  var subEl = document.getElementById('leadSub');
  var submitBtn = document.getElementById('leadSubmit');
  var errorEl = document.getElementById('leadError');
  var thanksName = document.getElementById('leadThanksName');
  var lastFocus = null;
  var openedAt = 0;
  var ctx = {};
  var closeTimer = null;

  var DEFAULT_TITLE = 'Vamos conversar sobre o seu projeto.';
  var DEFAULT_SUB = 'Deixe seu contato. A Cron te chama no WhatsApp pra entender como sua operação funciona.';

  // UTMs da campanha (guardadas durante a visita)
  var utm = {};
  try {
    var params = new URLSearchParams(location.search);
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach(function (k) {
      if (params.get(k)) sessionStorage.setItem('cron_' + k, params.get(k).slice(0, 120));
      var v = sessionStorage.getItem('cron_' + k);
      if (v) utm[k.replace('utm_', '')] = v;
    });
  } catch (e) {}

  // ---------- Abrir / fechar ----------
  function open(trigger) {
    clearTimeout(closeTimer);
    lastFocus = trigger || document.activeElement;
    ctx = {
      source: (trigger && trigger.dataset.cta) || 'direto',
      label: trigger ? trigger.textContent.replace(/[→↗]/g, '').trim().slice(0, 120) : '',
      project: (trigger && trigger.dataset.project) || ''
    };

    form.reset();
    modal.classList.remove('is-success', 'is-sending');
    errorEl.textContent = '';
    form.querySelectorAll('.is-invalid').forEach(function (f) { f.classList.remove('is-invalid'); });

    if (ctx.project) {
      titleEl.textContent = 'Quero um projeto como o da ' + ctx.project + '.';
      form.message.value = 'Vi o projeto da ' + ctx.project + ' e quero algo parecido.';
    } else {
      titleEl.textContent = DEFAULT_TITLE;
    }
    subEl.textContent = DEFAULT_SUB;

    var need = ctx.source === 'plano-institucional' ? 'institucional'
      : (ctx.source === 'plano-sistema' || ctx.source === 'painel') ? 'sistema' : '';
    if (need) form.querySelector('input[name="need"][value="' + need + '"]').checked = true;

    modal.hidden = false;
    requestAnimationFrame(function () { modal.classList.add('is-open'); });
    document.documentElement.classList.add('modal-open');
    if (window.CronUI && CronUI.lenis) CronUI.lenis.stop();
    openedAt = Date.now();
    setTimeout(function () { form.name.focus({ preventScroll: true }); }, 250);
  }

  function close() {
    clearTimeout(closeTimer);
    modal.classList.remove('is-open');
    document.documentElement.classList.remove('modal-open');
    if (window.CronUI && CronUI.lenis) CronUI.lenis.start();
    setTimeout(function () {
      modal.hidden = true;
      modal.classList.remove('is-success', 'is-sending');
    }, 420);
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }

  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[data-cta]');
    if (!a || a.hasAttribute('data-no-form') || a.getAttribute('href') !== '#') return;
    e.preventDefault();
    open(a);
  });

  modal.addEventListener('click', function (e) {
    if (e.target.closest('[data-close]')) close();
  });

  document.addEventListener('keydown', function (e) {
    if (modal.hidden) return;
    if (e.key === 'Escape') close();
    if (e.key === 'Tab') {
      var f = card.querySelectorAll('button, input, textarea, a[href]');
      f = Array.prototype.filter.call(f, function (el) { return !el.disabled && el.offsetParent !== null; });
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  // ---------- Máscara de WhatsApp ----------
  form.whatsapp.addEventListener('input', function () {
    var d = this.value.replace(/\D/g, '').slice(0, 11);
    var out;
    if (d.length <= 2) out = d.length ? '(' + d : '';
    else if (d.length <= 6) out = '(' + d.slice(0, 2) + ') ' + d.slice(2);
    else if (d.length <= 10) out = '(' + d.slice(0, 2) + ') ' + d.slice(2, 6) + '-' + d.slice(6);
    else out = '(' + d.slice(0, 2) + ') ' + d.slice(2, 7) + '-' + d.slice(7);
    this.value = out;
  });

  form.addEventListener('input', function (e) {
    var field = e.target.closest('.field, .consent');
    if (field) field.classList.remove('is-invalid');
    errorEl.textContent = '';
  });

  // ---------- Validação ----------
  function validate() {
    var ok = true;
    function mark(name, valid) {
      var el = form.querySelector('[name="' + name + '"]').closest('.field, .consent');
      el.classList.toggle('is-invalid', !valid);
      if (!valid) ok = false;
    }
    mark('name', form.name.value.trim().length >= 2);
    var digits = form.whatsapp.value.replace(/\D/g, '');
    mark('whatsapp', digits.length >= 10 && digits.length <= 11);
    var email = form.email.value.trim();
    mark('email', !email || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email));
    mark('consent', form.consent.checked);
    return ok;
  }

  // ---------- Envio ----------
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (modal.classList.contains('is-sending')) return;

    if (!validate()) {
      var firstBad = form.querySelector('.is-invalid input, .is-invalid textarea');
      if (firstBad) firstBad.focus();
      return;
    }

    // Antispam: campo invisível preenchido ou envio rápido demais = robô
    if (form.website.value || Date.now() - openedAt < 1500) { success(); return; }

    var needEl = form.querySelector('input[name="need"]:checked');
    var lead = {
      name: form.name.value.trim().slice(0, 120),
      whatsapp: form.whatsapp.value.replace(/\D/g, ''),
      email: form.email.value.trim().slice(0, 160),
      company: form.company.value.trim().slice(0, 120),
      need: needEl ? needEl.value : '',
      message: form.message.value.trim().slice(0, 2000),
      source: ctx.source.slice(0, 80),
      sourceLabel: ctx.label,
      project: ctx.project.slice(0, 120),
      consent: true,
      consentText: document.getElementById('consentText').textContent.replace(/\s+/g, ' ').trim().slice(0, 600),
      status: 'novo',
      notes: '',
      page: (location.origin + location.pathname).slice(0, 500),
      referrer: (document.referrer || '').slice(0, 500),
      utm: utm
    };

    modal.classList.add('is-sending');
    submitBtn.disabled = true;

    var isLocal = location.protocol === 'file:' || /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
    var send;

    if (window.CRON && CRON.configured && CRON.db) {
      var ts = firebase.firestore.FieldValue.serverTimestamp();
      lead.createdAt = ts;
      lead.consentAt = ts;
      send = CRON.db.collection('leads').add(lead);
    } else if (isLocal) {
      console.warn('[Cron] Firebase não configurado: envio simulado (só em ambiente local).', lead);
      send = new Promise(function (r) { setTimeout(r, 700); });
    } else {
      send = Promise.reject(new Error('firebase-not-configured'));
    }

    send.then(function () {
      if (typeof window.fbq === 'function') fbq('track', 'Lead', { content_name: lead.source });
      if (typeof window.gtag === 'function') gtag('event', 'generate_lead', { lead_source: lead.source });
      success(lead.name);
    }).catch(function (err) {
      console.error('[Cron] Erro ao enviar lead:', err);
      modal.classList.remove('is-sending');
      submitBtn.disabled = false;
      errorEl.textContent = 'Não conseguimos enviar agora. Tente de novo em instantes.';
    });
  });

  function success(name) {
    submitBtn.disabled = false;
    thanksName.textContent = name ? name.split(' ')[0] : '';
    modal.classList.remove('is-sending');
    card.scrollTop = 0;
    modal.classList.add('is-success');
    // animação (~1s) + 3s visível, depois fecha sozinho
    closeTimer = setTimeout(close, 4000);
  }
})();
