// Cron Web Studio · Configuração do Firebase
// Cole aqui as chaves do app web (Console do Firebase > Configurações do projeto > Seus apps).
// Usado pela landing (projetos + leads) e pelo admin.html.

window.CRON = (function () {
  var config = {
    apiKey: "AIzaSyCSC_zDbZt1ga1GAu3-ldz8CDlEpXhOq9I",
    authDomain: "cron-91280.firebaseapp.com",
    projectId: "cron-91280",
    storageBucket: "cron-91280.firebasestorage.app",
    messagingSenderId: "421142538286",
    appId: "1:421142538286:web:358161b84cfce251c497bf"
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
