// Testes das regras do Firestore (fase 1: CRM).
// Rodam só no emulador local, com o projeto fictício "demo-cron". Nunca tocam no banco real.
// Como rodar: cd tests && npm install && npm test   (precisa de Java instalado)

const fs = require('fs');
const path = require('path');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { doc, setDoc, updateDoc, deleteDoc, getDoc, addDoc, collection, serverTimestamp, deleteField, Timestamp } = require('firebase/firestore');

let env;
const ADMIN = 'admin-uid';
const STRANGER = 'outro-uid';

function siteLead() {
  return {
    name: 'Maria Teste', whatsapp: '14999990000', email: '', company: 'Teste Ltda', need: 'institucional',
    message: 'Quero um site', source: 'hero-primary', sourceLabel: 'Quero meu site', project: '',
    consent: true, consentText: 'Concordo...', consentAt: serverTimestamp(),
    createdAt: serverTimestamp(), status: 'novo', notes: '', page: 'https://cronwebstudio.com.br/', referrer: '', utm: {}
  };
}

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-cron',
    firestore: { rules: fs.readFileSync(path.join(__dirname, '..', '..', 'firestore.rules'), 'utf8') }
  });
});
after(async () => { await env.cleanup(); });
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'admins', ADMIN), { ok: true });
    await setDoc(doc(db, 'leads', 'old'), Object.assign(siteLead(), { createdAt: new Date(), consentAt: new Date(), status: 'contato' }));
  });
});

const pub = () => env.unauthenticatedContext().firestore();
const admin = () => env.authenticatedContext(ADMIN).firestore();
const stranger = () => env.authenticatedContext(STRANGER).firestore();

describe('formulário do site', () => {
  it('visitante cria lead exatamente como hoje', async () => {
    await assertSucceeds(addDoc(collection(pub(), 'leads'), siteLead()));
  });
  it('visitante não cria lead sem consentimento', async () => {
    await assertFails(addDoc(collection(pub(), 'leads'), Object.assign(siteLead(), { consent: false })));
  });
  it('visitante não cria lead com campos de CRM', async () => {
    await assertFails(addDoc(collection(pub(), 'leads'), Object.assign(siteLead(), { origin: 'cronus' })));
  });
  it('visitante não lê leads', async () => {
    await assertFails(getDoc(doc(pub(), 'leads', 'old')));
  });
});

describe('cadastro manual (admin)', () => {
  const manual = () => ({
    company: 'Lima Usinagem', name: 'Rogério', origin: 'manual', status: 'novo', owner: 'pedro', notes: '',
    whatsapp: '', phone: '1433334444', niche: 'industria-usinagem', createdAt: serverTimestamp(), stageAt: serverTimestamp(), createdBy: 'admin'
  });
  it('admin cadastra lead manual', async () => {
    await assertSucceeds(addDoc(collection(admin(), 'leads'), manual()));
  });
  it('admin não cadastra lead dizendo que veio do CronUS', async () => {
    await assertFails(addDoc(collection(admin(), 'leads'), Object.assign(manual(), { origin: 'cronus' })));
  });
  it('admin não cadastra lead sem empresa nem nome', async () => {
    const d = manual(); delete d.company; delete d.name;
    await assertFails(addDoc(collection(admin(), 'leads'), d));
  });
  it('quem não é admin não cadastra lead manual', async () => {
    await assertFails(addDoc(collection(stranger(), 'leads'), manual()));
  });
});

describe('edição pelo admin', () => {
  it('muda etapa, próximo passo e mensagem', async () => {
    await assertSucceeds(updateDoc(doc(admin(), 'leads', 'old'), {
      status: 'em_conversa', stageAt: serverTimestamp(), updatedAt: serverTimestamp(),
      nextStep: { text: 'Ligar', dueAt: Timestamp.fromDate(new Date()) },
      'draft.text': 'Oi!', 'draft.channel': 'whatsapp', 'draft.approved': true, 'draft.approvedAt': serverTimestamp()
    }));
  });
  it('aceita a etapa antiga "contato" em leads existentes', async () => {
    await assertSucceeds(updateDoc(doc(admin(), 'leads', 'old'), { notes: 'ok', updatedAt: serverTimestamp() }));
  });
  it('remove campos opcionais', async () => {
    await assertSucceeds(updateDoc(doc(admin(), 'leads', 'old'), { googleRating: 4.5 }));
    await assertSucceeds(updateDoc(doc(admin(), 'leads', 'old'), { googleRating: deleteField() }));
  });
  it('não altera consentimento, UTM nem data de criação', async () => {
    await assertFails(updateDoc(doc(admin(), 'leads', 'old'), { consent: false }));
    await assertFails(updateDoc(doc(admin(), 'leads', 'old'), { utm: { source: 'x' } }));
    await assertFails(updateDoc(doc(admin(), 'leads', 'old'), { createdAt: serverTimestamp() }));
  });
  it('recusa valores fora do formato', async () => {
    await assertFails(updateDoc(doc(admin(), 'leads', 'old'), { status: 'ganho' }));
    await assertFails(updateDoc(doc(admin(), 'leads', 'old'), { whatsapp: 'abc' }));
    await assertFails(updateDoc(doc(admin(), 'leads', 'old'), { state: 'São Paulo' }));
    await assertFails(updateDoc(doc(admin(), 'leads', 'old'), { googleRating: 7 }));
    await assertFails(updateDoc(doc(admin(), 'leads', 'old'), { 'draft.extra': 1 }));
  });
  it('quem não é admin não edita', async () => {
    await assertFails(updateDoc(doc(stranger(), 'leads', 'old'), { notes: 'x' }));
  });
});

describe('histórico (interações)', () => {
  const it1 = () => ({ type: 'nota', text: 'Ligou', channel: '', from: '', to: '', createdAt: serverTimestamp(), createdBy: 'admin' });
  it('admin cria e lê', async () => {
    const ref = await assertSucceeds(addDoc(collection(admin(), 'leads', 'old', 'interacoes'), it1()));
    await assertSucceeds(getDoc(ref));
  });
  it('ninguém edita nem apaga', async () => {
    const ref = await addDoc(collection(admin(), 'leads', 'old', 'interacoes'), it1());
    await assertFails(updateDoc(ref, { text: 'mudou' }));
    await assertFails(deleteDoc(ref));
  });
  it('não aceita tipo desconhecido nem autor diferente de admin', async () => {
    await assertFails(addDoc(collection(admin(), 'leads', 'old', 'interacoes'), Object.assign(it1(), { type: 'spam' })));
    await assertFails(addDoc(collection(admin(), 'leads', 'old', 'interacoes'), Object.assign(it1(), { createdBy: 'cronus' })));
  });
  it('visitante não lê histórico', async () => {
    await assertFails(getDoc(doc(pub(), 'leads', 'old', 'interacoes', 'x')));
  });
});
