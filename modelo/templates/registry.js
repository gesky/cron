// Cron Web Studio · Sites modelo: lista de templates permitidos
// Só os nomes desta lista são carregados (nada de caminho montado com valor do banco).
// Novo nicho: copie templates/_base, renomeie a pasta, ajuste os defaults e o visual e adicione o nome aqui
// (e, se o código de nicho dos leads for diferente do nome, um prefixo em PREFIX).
(function () {
  'use strict';
  window.CRON_MODELO_TEMPLATES = ['_base', 'industria'];

  // Nomes legíveis (seletor do editor e cartão do lead)
  window.CRON_MODELO_TEMPLATE_NAMES = { _base: 'Base', industria: 'Indústria' };

  // Código de nicho do lead -> template. Os leads usam códigos como industria-maquinas,
  // industria-moveis, industria-usinagem: o prefixo decide.
  var PREFIX = [['industria-', 'industria']];

  // Nome exato da lista; senão, o mapa por prefixo; senão, _base. Sempre um nome da lista.
  window.CRON_MODELO_TEMPLATE_FOR = function (niche) {
    var list = window.CRON_MODELO_TEMPLATES;
    var n = typeof niche === 'string' ? niche.trim().toLowerCase() : '';
    if (n && list.indexOf(n) !== -1) return n;
    for (var i = 0; i < PREFIX.length; i++) {
      if (n.indexOf(PREFIX[i][0]) === 0 && list.indexOf(PREFIX[i][1]) !== -1) return PREFIX[i][1];
    }
    return '_base';
  };

  // Cada template.js chama CRON_MODELO.register(nome, { defaults, render, options }).
  // No painel, isso só guarda os textos padrão (para mostrar como sugestão na edição).
  window.CRON_MODELO = window.CRON_MODELO || {
    defs: {},
    register: function (name, def) {
      if (window.CRON_MODELO_TEMPLATES.indexOf(name) === -1) return;
      this.defs[name] = def;
    }
  };
})();
