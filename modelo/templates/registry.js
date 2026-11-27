// Cron Web Studio · Sites modelo: lista de templates permitidos
// Só os nomes desta lista são carregados (nada de caminho montado com valor do banco).
// Novo nicho: copie templates/_base, renomeie a pasta, ajuste os defaults e o visual e adicione o nome aqui.
(function () {
  'use strict';
  window.CRON_MODELO_TEMPLATES = ['_base'];

  // Cada template.js chama CRON_MODELO.register(nome, { defaults, render }).
  // No painel, isso só guarda os textos padrão (para mostrar como sugestão na edição).
  window.CRON_MODELO = window.CRON_MODELO || {
    defs: {},
    register: function (name, def) {
      if (window.CRON_MODELO_TEMPLATES.indexOf(name) === -1) return;
      this.defs[name] = def;
    }
  };
})();
