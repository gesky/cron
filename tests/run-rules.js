// Roda cada arquivo de teste num processo Mocha separado, para os hooks
// (before/beforeEach) de um arquivo não rodarem nos testes dos outros.
// Roda todos mesmo se um falhar e sai com erro se algum falhou.
const { spawnSync } = require('child_process');
const path = require('path');

const files = ['crm', 'fase2', 'fase3', 'fase4'].map((n) => path.join('rules', n + '.test.js'));
const mocha = require.resolve('mocha/bin/mocha.js');
const failed = [];
for (const f of files) {
  console.log('\n=== ' + f + ' ===');
  const r = spawnSync(process.execPath, [mocha, '--timeout', '20000', f], { cwd: __dirname, stdio: 'inherit' });
  if (r.status !== 0) failed.push(f);
}
console.log(failed.length ? '\nFalharam: ' + failed.join(', ') : '\nTodos os arquivos passaram.');
process.exit(failed.length ? 1 : 0);
