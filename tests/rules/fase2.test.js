// Testes das regras do Firestore (fase 2: prospecção e usuários).
// Rodam só no emulador local, com o projeto fictício "demo-cron". Nunca tocam no banco real.

const fs = require('fs');
const path = require('path');
const { initializeTestEnvironment } = require('@firebase/rules-unit-testing');
const { assertSucceeds, assertFails } = require('./helpers');
const { doc, setDoc, updateDoc, deleteDoc, getDoc, getDocs, addDoc, collection, serverTimestamp, deleteField } = require('firebase/firestore');

let env;
const ADMIN = 'adminUid0000000000000001';
const OTHER = 'adminUid0000000000000002';
const STRANGER = 'strangerUid000000000001';

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
    await setDoc(doc(db, 'admins', ADMIN), {});
    await setDoc(doc(db, 'admins', OTHER), { name: 'Fred', email: 'fred@x.com', role: 'admin' });
    await setDoc(doc(db, 'leads', 'p1'), {
      origin: 'cronus', createdBy: 'cronus', batchId: 'r1', prospectState: 'pendente', status: 'novo',
      company: 'Bellini', drafts: { whatsapp: 'Oi' }, createdAt: new Date()
    });
    await setDoc(doc(db, 'rodadas', 'r1'), { niche: 'industria-moveis', nicheLabel: 'Indústria de móveis', status: 'em_andamento', createdBy: 'cronus', createdAt: new Date(), updatedAt: new Date() });
  });
});

const admin = () => env.authenticatedContext(ADMIN).firestore();
const stranger = () => env.authenticatedContext(STRANGER).firestore();
const pub = () => env.unauthenticatedContext().firestore();

describe('prospecção nos leads', () => {
  it('admin aprova candidato com a mensagem', async () => {
    await assertSucceeds(updateDoc(doc(admin(), 'leads', 'p1'), {
      prospectState: 'aprovado', status: 'mensagem_pronta', stageAt: serverTimestamp(), updatedAt: serverTimestamp(),
      draft: { channel: 'whatsapp', text: 'Oi', approved: true, approvedAt: serverTimestamp() }, 'drafts.whatsapp': 'Oi'
    }));
  });
  it('admin descarta com motivo e volta para pendente', async () => {
    await assertSucceeds(updateDoc(doc(admin(), 'leads', 'p1'), { prospectState: 'descartado', discardReason: 'Sem contato' }));
    await assertSucceeds(updateDoc(doc(admin(), 'leads', 'p1'), { prospectState: 'pendente', discardReason: deleteField() }));
  });
  it('recusa estado e canal desconhecidos', async () => {
    await assertFails(updateDoc(doc(admin(), 'leads', 'p1'), { prospectState: 'talvez' }));
    await assertFails(updateDoc(doc(admin(), 'leads', 'p1'), { 'drafts.telegram': 'Oi' }));
  });
});

describe('rodadas', () => {
  const nova = () => ({ niche: 'clinicas', nicheLabel: 'Clínicas', region: 'Interior', status: 'em_andamento', notes: '',
    criteria: { minRating: 4.5, minReviews: 30, siteStatusAccepted: ['sem_site', 'site_fraco'], requireContact: true },
    createdBy: 'admin', createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  it('admin cria, edita e arquiva', async () => {
    const ref = await assertSucceeds(addDoc(collection(admin(), 'rodadas'), nova()));
    await assertSucceeds(updateDoc(ref, { funnel: { encontradas: 40, qualificadas: 5 }, updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(ref, { status: 'arquivada' }));
  });
  it('ninguém apaga rodada', async () => {
    await assertFails(deleteDoc(doc(admin(), 'rodadas', 'r1')));
  });
  it('recusa valores fora do formato', async () => {
    await assertFails(addDoc(collection(admin(), 'rodadas'), Object.assign(nova(), { status: 'pausada' })));
    await assertFails(addDoc(collection(admin(), 'rodadas'), Object.assign(nova(), { criteria: { siteStatusAccepted: ['qualquer'] } })));
    await assertFails(updateDoc(doc(admin(), 'rodadas', 'r1'), { funnel: { encontradas: -1 } }));
    await assertFails(updateDoc(doc(admin(), 'rodadas', 'r1'), { createdBy: 'admin' }));
  });
  it('quem não é admin não lê nem cria', async () => {
    await assertFails(getDoc(doc(stranger(), 'rodadas', 'r1')));
    await assertFails(addDoc(collection(pub(), 'rodadas'), nova()));
  });
});

describe('usuários (admins)', () => {
  const novo = () => ({ name: 'Ana', email: 'ana@x.com', role: 'admin', createdAt: serverTimestamp(), createdBy: ADMIN });
  const withOwner = () => env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'config', 'owner'), { uid: ADMIN, createdAt: new Date() });
  });
  it('admin lista, adiciona e remove outro admin (com config/owner criado)', async () => {
    await withOwner();
    await assertSucceeds(getDocs(collection(admin(), 'admins')));
    await assertSucceeds(setDoc(doc(admin(), 'admins', 'novoUid00000000000000001'), novo()));
    await assertSucceeds(deleteDoc(doc(admin(), 'admins', OTHER)));
  });
  it('sem config/owner, ninguém remove admin', async () => {
    await assertFails(deleteDoc(doc(admin(), 'admins', OTHER)));
  });
  it('ninguém remove o dono, nem outro admin', async () => {
    await withOwner();
    const other = env.authenticatedContext(OTHER).firestore();
    await assertFails(deleteDoc(doc(other, 'admins', ADMIN)));
  });
  it('ninguém remove o próprio acesso', async () => {
    await withOwner();
    await assertFails(deleteDoc(doc(admin(), 'admins', ADMIN)));
  });
  it('admin completa nome e e-mail', async () => {
    await assertSucceeds(updateDoc(doc(admin(), 'admins', ADMIN), { email: 'pedro@x.com', updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(admin(), 'admins', ADMIN), { role: 'dono', updatedAt: serverTimestamp() }));
  });
  it('recusa cadastro malformado', async () => {
    await assertFails(setDoc(doc(admin(), 'admins', 'novoUid00000000000000001'), Object.assign(novo(), { createdBy: OTHER })));
    await assertFails(setDoc(doc(admin(), 'admins', 'novoUid00000000000000001'), Object.assign(novo(), { email: '' })));
    await assertFails(setDoc(doc(admin(), 'admins', 'id com espaço'), novo()));
  });
  it('quem não é admin não se adiciona nem lista', async () => {
    await assertFails(setDoc(doc(stranger(), 'admins', STRANGER), Object.assign(novo(), { createdBy: STRANGER })));
    await assertFails(getDocs(collection(stranger(), 'admins')));
  });
  it('qualquer conta lê só o próprio documento (o painel confere o acesso)', async () => {
    await assertSucceeds(getDoc(doc(stranger(), 'admins', STRANGER)));
    await assertFails(getDoc(doc(stranger(), 'admins', ADMIN)));
  });
});
