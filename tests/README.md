# Testes das regras do Firestore

Estes testes rodam **só no emulador**, com o projeto fictício `demo-cron`. Eles nunca tocam no banco de produção (`cron-91280`).

Precisa de:

- Node.js 20 ou mais novo
- Java 21 ou mais novo (o emulador do Firestore roda em Java; o `firebase-tools` 15 não aceita versões antigas)

Para rodar, do zero:

```
cd tests
npm install
npm test
```

O `npm test` volta para a raiz do repositório, onde fica o `firebase.json` (que aponta para o `firestore.rules` da raiz), sobe o emulador com `firebase emulators:exec` e roda `rules/crm.test.js`, `rules/fase2.test.js`, `rules/fase3.test.js` e `rules/fase4.test.js`, **cada um num processo Mocha separado** (`run-rules.js`). Assim o `beforeEach` de um arquivo não roda nos testes dos outros. Todos rodam mesmo se um falhar; no fim aparece quais falharam e o comando sai com erro.

Na primeira vez, o `firebase-tools` baixa o emulador (um arquivo `.jar`) para `~/.cache/firebase/emulators`.

## Recusa pelo motivo certo

`rules/helpers.js` troca o `assertFails` por um que falha se a recusa veio do limite de 1000 expressões do Firestore, e não da regra. O emulador mostra duas avaliações na mensagem (uma de diagnóstico e a que decide); só a que decide conta.

## No GitHub

`.github/workflows/regras.yml` roda a mesma suíte (Node 24, Java 21) a cada push que mexe em `firestore.rules`, `firebase.json` ou `tests/`, e pode ser disparado à mão na aba Actions.

A pasta `node_modules/` não vai para o repositório (`.gitignore`).
