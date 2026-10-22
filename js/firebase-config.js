// Cron Web Studio · Configuração do Firebase
// Cole aqui as chaves do app web (Console do Firebase > Configurações do projeto > Seus apps).
// Usado pela landing (projetos + leads) e pelo admin.html.

window.CRON = (function () {
  var config = {
    apiKey: "COLE_AQUI",
    authDomain: "COLE_AQUI.firebaseapp.com",
    projectId: "COLE_AQUI",
    storageBucket: "COLE_AQUI.appspot.com",
    messagingSenderId: "COLE_AQUI",
    appId: "COLE_AQUI"
  };

  var configured = !!config.apiKey && config.apiKey.indexOf("COLE") !== 0;
  var app = null, db = null, auth = null;

  if (configured && window.firebase) {
    try {
      app = firebase.apps.length ? firebase.app() : firebase.initializeApp(config);
      db = firebase.firestore();
      if (firebase.auth) auth = firebase.auth();
    } catch (e) {
      console.warn("[Cron] Falha ao iniciar o Firebase:", e);
      configured = false;
    }
  }

  return {
    configured: configured,
    config: config,
    app: app,
    db: db,
    auth: auth,
    MIN_PROJECTS: 1,
    MAX_PROJECTS: 4
  };
})();
