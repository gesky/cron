// assertFails que só aceita recusa pela regra. Recusa por estouro do orçamento de
// 1000 expressões não conta: o teste falha e mostra o motivo.
//
// O emulador avalia cada allow duas vezes e lista as duas na mensagem: primeiro uma passada
// de diagnóstico (sem atalho no && e no ||), depois a avaliação que decide. A passada de
// diagnóstico pode estourar o orçamento mesmo quando a que decide termina em "false"; por isso
// só a segunda metade da lista conta.
const rut = require('@firebase/rules-unit-testing');
const MAX = 'maximum of 1000 expressions';

function decisive(msg) {
  const parts = [];
  const re = /(.*?) for '(?:get|list|create|update|delete)' @ L\d+(?:, |$)/gs;
  let m;
  while ((m = re.exec(msg)) !== null) parts.push(m[1]);
  return parts.slice(Math.floor(parts.length / 2));
}

async function assertFails(p) {
  const err = await rut.assertFails(p);
  const msg = String((err && err.message) || '').replace(/^\d+ PERMISSION_DENIED:\s*/, '');
  if (decisive(msg).some((x) => x.indexOf(MAX) !== -1) || (msg.indexOf(MAX) !== -1 && decisive(msg).length === 0)) {
    throw new Error('Recusado pelo orçamento de expressões, não pela regra: ' + msg.slice(0, 400));
  }
  return err;
}

module.exports = { assertFails, assertSucceeds: rut.assertSucceeds };

// Produtos no formato gravado (listas paralelas, como modelo/produtos.js), sem cortar nem
// limpar nada: os testes precisam conseguir montar documentos inválidos.
function P(list) {
  return {
    names: list.map((p) => p.name),
    descriptions: list.map((p) => (p.description == null ? '' : p.description)),
    categories: list.map((p) => (p.category == null ? '' : p.category)),
    images: list.map((p) => (p.image == null ? '' : p.image))
  };
}
module.exports.P = P;
