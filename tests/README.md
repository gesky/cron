# Testes das regras do Firestore

Estes testes rodam **só no emulador local**, com o projeto fictício `demo-cron`. Eles nunca tocam no banco de produção (`cron-91280`).

Precisa de:

- Node.js 18 ou mais novo
- Java 11 ou mais novo (o emulador do Firestore roda em Java)

Para rodar:

```
cd tests
npm install
npm test
```

O comando sobe o emulador, roda `rules/*.test.js` contra o `firestore.rules` da raiz e desliga o emulador no fim. A pasta `node_modules/` não vai para o repositório (`.gitignore`).
