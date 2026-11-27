// Testes das regras do Firestore (fase 4: acesso do CronUS, dono do sistema e privacidade das prévias).
// Rodam só no emulador local, com o projeto fictício "demo-cron". Nunca tocam no banco real.

const fs = require('fs');
const path = require('path');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { doc, setDoc, updateDoc, deleteDoc, getDoc, getDocs, addDoc, collection, serverTimestamp } = require('firebase/firestore');

let env;
const ADMIN = 'adminUid0000000000000001';
const OTHER = 'adminUid0000000000000002';
const BOT = 'botUid000000000000000001';
const STRANGER = 'strangerUid000000000001';
const IMG = 'data:image/webp;base64,UklGRhIAAABXRUJQVlA4TAYAAAAvAAAAAAfQ//73v/+BiOh/AAA=';

function preview(extra) {
  return Object.assign({
    template: '_base', format: 'catalogo', companyName: 'Bellini Estofados', tagline: 'Estofados',
    mainService: 'Estofados', services: ['Sofás'], primaryColor: '#c6ff02', secondaryColor: '#1a1a1a', logo: IMG,
    products: Array.from({ length: 24 }, (_, i) => ({ name: 'Produto ' + i, description: 'Descrição', category: 'Sofás', image: IMG })),
    categories: ['Sofás'], texts: {}, active: false,
    createdBy: 'cronus', createdAt: serverTimestamp(), updatedAt: serverTimestamp()
  }, extra || {});
}
function botLead(extra) {
  return Object.assign({
    origin: 'cronus', createdBy: 'cronus', createdAt: serverTimestamp(), status: 'novo', prospectState: 'pendente',
    company: 'Tavares Móveis', whatsapp: '43999887766', niche: 'industria-moveis', batchId: 'r1',
    drafts: { whatsapp: 'Oi, Sérgio!' }, draft: { channel: 'whatsapp', text: 'Oi, Sérgio!' },
    sources: { whatsapp: 'google_maps' }
  }, extra || {});
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
    await setDoc(doc(db, 'admins', ADMIN), { name: 'Pedro', email: 'pedro@x.com', role: 'admin' });
    await setDoc(doc(db, 'admins', OTHER), { name: 'Fred', email: 'fred@x.com', role: 'admin' });
    await setDoc(doc(db, 'bots', BOT), { name: 'CronUS', email: 'cronus@x.com', role: 'bot' });
    await setDoc(doc(db, 'config', 'owner'), { uid: ADMIN, createdAt: new Date() });
    await setDoc(doc(db, 'leads', 'pc'), { origin: 'cronus', createdBy: 'cronus', status: 'novo', prospectState: 'pendente', company: 'Pendente Ltda', createdAt: new Date() });
    await setDoc(doc(db, 'leads', 'ap'), { origin: 'cronus', createdBy: 'cronus', status: 'mensagem_pronta', prospectState: 'aprovado', company: 'Aprovada Ltda', createdAt: new Date(),
      draft: { channel: 'whatsapp', text: 'Oi', approved: true, approvedAt: new Date() } });
    await setDoc(doc(db, 'leads', 'site1'), { origin: 'site', name: 'Maria', whatsapp: '14999990000', status: 'novo', createdAt: new Date() });
    await setDoc(doc(db, 'leads', 'man1'), { origin: 'manual', createdBy: 'admin', company: 'Manual Ltda', status: 'novo', createdAt: new Date() });
    await setDoc(doc(db, 'leads', 'pc', 'interacoes', 'i1'), { type: 'nota', text: 'x', channel: '', from: '', to: '', createdAt: new Date(), createdBy: 'admin' });
    await setDoc(doc(db, 'leads', 'pc', 'kit', 'marca'), { logo: '', products: [], categories: [], updatedAt: new Date(), updatedBy: 'admin' });
    await setDoc(doc(db, 'leads', 'pc', 'previews', 'prevPrevPrevPrevPrev'), { niche: 'industria-moveis', formatReason: 'x', createdAt: new Date() });
    await setDoc(doc(db, 'previews', 'prevPrevPrevPrevPrev'), Object.assign(preview({ active: true, products: [] }), { createdAt: new Date(), updatedAt: new Date() }));
    await setDoc(doc(db, 'rodadas', 'r1'), { niche: 'industria-moveis', nicheLabel: 'Móveis', status: 'em_andamento', createdBy: 'cronus', createdAt: new Date(), updatedAt: new Date() });
    await setDoc(doc(db, 'projects', 'rascunho'), { client: 'X', title: 'Rascunho', published: false });
  });
});

const bot = () => env.authenticatedContext(BOT).firestore();
const admin = () => env.authenticatedContext(ADMIN).firestore();
const other = () => env.authenticatedContext(OTHER).firestore();
const stranger = () => env.authenticatedContext(STRANGER).firestore();
const pub = () => env.unauthenticatedContext().firestore();

describe('CronUS: o que pode', () => {
  it('cria e edita rodada (sem arquivar)', async () => {
    const ref = await assertSucceeds(addDoc(collection(bot(), 'rodadas'), { niche: 'clinicas', nicheLabel: 'Clínicas', status: 'em_andamento', createdBy: 'cronus', createdAt: serverTimestamp(), updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(ref, { funnel: { encontradas: 40, qualificadas: 6 }, status: 'concluida', updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(ref, { status: 'arquivada', updatedAt: serverTimestamp() }));
  });
  it('cria lead de prospecção pendente e edita', async () => {
    const ref = await assertSucceeds(addDoc(collection(bot(), 'leads'), botLead()));
    await assertSucceeds(updateDoc(ref, { qualification: 'qualificado', format: 'landing', formatReason: 'Um serviço', brand: { primaryColor: '#112233' }, status: 'mensagem_pronta', updatedAt: serverTimestamp() }));
  });
  it('cria interação, kit e prévia com índice privado', async () => {
    await assertSucceeds(addDoc(collection(bot(), 'leads', 'pc', 'interacoes'), { type: 'nota', text: 'Encontrado no Google Maps', channel: '', from: '', to: '', createdAt: serverTimestamp(), createdBy: 'cronus' }));
    await assertSucceeds(setDoc(doc(bot(), 'leads', 'pc', 'kit', 'marca'), { logo: IMG, products: [{ name: 'Mesa' }], categories: ['Mesas'], updatedAt: serverTimestamp(), updatedBy: 'cronus' }));
    const p = await assertSucceeds(addDoc(collection(bot(), 'previews'), preview()));
    await assertSucceeds(setDoc(doc(bot(), 'leads', 'pc', 'previews', p.id), { niche: 'industria-moveis', formatReason: 'Catálogo', createdAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(doc(bot(), 'leads', 'pc'), { previewId: p.id, 'draft.previewId': p.id }));
  });
  it('lê o que precisa', async () => {
    await assertSucceeds(getDocs(collection(bot(), 'leads')));
    await assertSucceeds(getDocs(collection(bot(), 'rodadas')));
    await assertSucceeds(getDoc(doc(bot(), 'leads', 'pc', 'kit', 'marca')));
    await assertSucceeds(getDocs(collection(bot(), 'leads', 'pc', 'interacoes')));
    await assertSucceeds(getDocs(collection(bot(), 'leads', 'pc', 'previews')));
    await assertSucceeds(getDoc(doc(bot(), 'bots', BOT)));
  });
});

describe('CronUS: o que não pode', () => {
  it('não apaga nada', async () => {
    await assertFails(deleteDoc(doc(bot(), 'leads', 'pc')));
    await assertFails(deleteDoc(doc(bot(), 'leads', 'pc', 'interacoes', 'i1')));
    await assertFails(deleteDoc(doc(bot(), 'leads', 'pc', 'kit', 'marca')));
    await assertFails(deleteDoc(doc(bot(), 'leads', 'pc', 'previews', 'prevPrevPrevPrevPrev')));
    await assertFails(deleteDoc(doc(bot(), 'previews', 'prevPrevPrevPrevPrev')));
    await assertFails(deleteDoc(doc(bot(), 'rodadas', 'r1')));
    await assertFails(deleteDoc(doc(bot(), 'admins', OTHER)));
    await assertFails(deleteDoc(doc(bot(), 'bots', BOT)));
    await assertFails(deleteDoc(doc(bot(), 'config', 'owner')));
  });
  it('não aprova mensagem', async () => {
    await assertFails(updateDoc(doc(bot(), 'leads', 'pc'), { draft: { channel: 'whatsapp', text: 'Oi', approved: true } }));
    await assertFails(updateDoc(doc(bot(), 'leads', 'pc'), { draft: { channel: 'whatsapp', text: 'Oi', approvedAt: serverTimestamp() } }));
    await assertFails(updateDoc(doc(bot(), 'leads', 'pc'), { draft: { channel: 'whatsapp', text: 'Oi', sentAt: serverTimestamp() } }));
    await assertFails(addDoc(collection(bot(), 'leads'), botLead({ draft: { channel: 'whatsapp', text: 'Oi', approved: true } })));
    // mensagem já aprovada pelo Pedro: o bot não mexe
    await assertFails(updateDoc(doc(bot(), 'leads', 'ap'), { 'draft.text': 'Outro texto' }));
  });
  it('não aprova nem descarta candidato', async () => {
    await assertFails(updateDoc(doc(bot(), 'leads', 'pc'), { prospectState: 'aprovado' }));
    await assertFails(updateDoc(doc(bot(), 'leads', 'pc'), { prospectState: 'descartado' }));
    await assertFails(updateDoc(doc(bot(), 'leads', 'ap'), { prospectState: 'pendente' }));
    await assertFails(addDoc(collection(bot(), 'leads'), botLead({ prospectState: 'aprovado' })));
  });
  it('não fecha, não perde, não manda proposta', async () => {
    await assertFails(updateDoc(doc(bot(), 'leads', 'pc'), { status: 'fechado' }));
    await assertFails(updateDoc(doc(bot(), 'leads', 'pc'), { status: 'perdido' }));
    await assertFails(updateDoc(doc(bot(), 'leads', 'pc'), { status: 'proposta' }));
    await assertFails(addDoc(collection(bot(), 'leads'), botLead({ status: 'proposta' })));
  });
  it('não grava campos do admin', async () => {
    await assertFails(updateDoc(doc(bot(), 'leads', 'pc'), { notes: 'x' }));
    await assertFails(updateDoc(doc(bot(), 'leads', 'pc'), { owner: 'bot' }));
    await assertFails(updateDoc(doc(bot(), 'leads', 'pc'), { lostReason: 'x' }));
    await assertFails(updateDoc(doc(bot(), 'leads', 'pc'), { discardReason: 'x' }));
    await assertFails(updateDoc(doc(bot(), 'leads', 'pc'), { origin: 'site' }));
  });
  it('não edita lead do site, manual ou indicação', async () => {
    await assertFails(updateDoc(doc(bot(), 'leads', 'site1'), { company: 'X' }));
    await assertFails(updateDoc(doc(bot(), 'leads', 'man1'), { company: 'X' }));
    await assertFails(setDoc(doc(bot(), 'leads', 'site1', 'kit', 'marca'), { logo: '', updatedAt: serverTimestamp(), updatedBy: 'cronus' }));
  });
  it('não cria lead com outra origem nem se passa pelo admin', async () => {
    await assertFails(addDoc(collection(bot(), 'leads'), botLead({ origin: 'manual' })));
    await assertFails(addDoc(collection(bot(), 'leads'), botLead({ createdBy: 'admin' })));
    await assertFails(addDoc(collection(bot(), 'leads', 'pc', 'interacoes'), { type: 'nota', text: 'x', channel: '', from: '', to: '', createdAt: serverTimestamp(), createdBy: 'admin' }));
    await assertFails(addDoc(collection(bot(), 'previews'), preview({ createdBy: 'admin' })));
    await assertFails(addDoc(collection(bot(), 'rodadas'), { niche: 'x-y', nicheLabel: 'X', status: 'em_andamento', createdBy: 'admin', createdAt: serverTimestamp(), updatedAt: serverTimestamp() }));
  });
  it('não lê projetos não publicados (o admin lê)', async () => {
    await assertFails(getDoc(doc(bot(), 'projects', 'rascunho')));
    await assertFails(getDoc(doc(pub(), 'projects', 'rascunho')));
    await assertSucceeds(getDoc(doc(admin(), 'projects', 'rascunho')));
  });
  it('não lista nem cria admins, não mexe em bots nem em config', async () => {
    await assertFails(getDocs(collection(bot(), 'admins')));
    await assertFails(setDoc(doc(bot(), 'admins', BOT), { name: 'CronUS', email: 'c@x.com', role: 'admin', createdAt: serverTimestamp(), createdBy: BOT }));
    await assertFails(setDoc(doc(bot(), 'bots', 'outroBot000000000000001'), { name: 'Outro', email: 'o@x.com', role: 'bot', createdAt: serverTimestamp(), createdBy: BOT }));
    await assertFails(getDoc(doc(bot(), 'config', 'owner')));
    await assertFails(updateDoc(doc(bot(), 'projects', 'rascunho'), { title: 'Mudou' }));
  });
});

describe('admins e bots não se misturam', () => {
  it('admin não cria admin para o UID do bot, nem bot para o UID de admin', async () => {
    await assertFails(setDoc(doc(admin(), 'admins', BOT), { name: 'CronUS', email: 'c@x.com', role: 'admin', createdAt: serverTimestamp(), createdBy: ADMIN }));
    await assertFails(setDoc(doc(admin(), 'bots', OTHER), { name: 'Fred', email: 'f@x.com', role: 'bot', createdAt: serverTimestamp(), createdBy: ADMIN }));
  });
  it('admin libera e remove um bot novo', async () => {
    await assertSucceeds(setDoc(doc(admin(), 'bots', 'novoBot0000000000000001'), { name: 'CronUS 2', email: 'c2@x.com', role: 'bot', createdAt: serverTimestamp(), createdBy: ADMIN }));
    await assertSucceeds(deleteDoc(doc(admin(), 'bots', 'novoBot0000000000000001')));
  });
});

describe('conta qualquer e formulário público', () => {
  it('conta autenticada sem papel não grava nada disso', async () => {
    await assertFails(addDoc(collection(stranger(), 'leads'), botLead()));
    await assertFails(updateDoc(doc(stranger(), 'leads', 'pc'), { company: 'X' }));
    await assertFails(addDoc(collection(stranger(), 'rodadas'), { niche: 'x-y', nicheLabel: 'X', status: 'em_andamento', createdBy: 'cronus', createdAt: serverTimestamp(), updatedAt: serverTimestamp() }));
    await assertFails(addDoc(collection(stranger(), 'previews'), preview()));
    await assertFails(getDocs(collection(stranger(), 'leads')));
  });
  it('formulário do site continua passando', async () => {
    await assertSucceeds(addDoc(collection(pub(), 'leads'), {
      name: 'Maria', whatsapp: '14999990000', email: '', company: '', need: '', message: '',
      source: 'hero-primary', sourceLabel: 'Quero', project: '', consent: true, consentText: 'Concordo',
      consentAt: serverTimestamp(), createdAt: serverTimestamp(), status: 'novo', notes: '', page: '', referrer: '', utm: {}
    }));
  });
});

describe('dono do sistema', () => {
  it('outro admin não remove o dono; o dono não remove a si mesmo', async () => {
    await assertFails(deleteDoc(doc(other(), 'admins', ADMIN)));
    await assertFails(deleteDoc(doc(admin(), 'admins', ADMIN)));
    await assertSucceeds(deleteDoc(doc(admin(), 'admins', OTHER)));
  });
  it('sem config/owner, ninguém remove admin', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => { await deleteDoc(doc(ctx.firestore(), 'config', 'owner')); });
    await assertFails(deleteDoc(doc(admin(), 'admins', OTHER)));
  });
  it('config/owner é imutável e só admin cria', async () => {
    await assertFails(updateDoc(doc(admin(), 'config', 'owner'), { uid: OTHER }));
    await assertFails(deleteDoc(doc(admin(), 'config', 'owner')));
    await env.withSecurityRulesDisabled(async (ctx) => { await deleteDoc(doc(ctx.firestore(), 'config', 'owner')); });
    await assertFails(setDoc(doc(stranger(), 'config', 'owner'), { uid: STRANGER, createdAt: serverTimestamp() }));
    await assertFails(setDoc(doc(admin(), 'config', 'outro'), { uid: ADMIN, createdAt: serverTimestamp() }));
    await assertSucceeds(setDoc(doc(admin(), 'config', 'owner'), { uid: ADMIN, createdAt: serverTimestamp() }));
  });
});

describe('privacidade das prévias', () => {
  it('visitante abre a prévia ativa sem campos internos', async () => {
    const snap = await assertSucceeds(getDoc(doc(pub(), 'previews', 'prevPrevPrevPrevPrev')));
    const data = snap.data();
    if ('leadId' in data || 'niche' in data || 'formatReason' in data) throw new Error('prévia pública com campo interno');
  });
  it('documento público com campo interno é recusado', async () => {
    await assertFails(addDoc(collection(bot(), 'previews'), preview({ leadId: 'pc' })));
    await assertFails(addDoc(collection(bot(), 'previews'), preview({ niche: 'industria-moveis' })));
    await assertFails(addDoc(collection(bot(), 'previews'), preview({ formatReason: 'x' })));
    await assertFails(updateDoc(doc(bot(), 'previews', 'prevPrevPrevPrevPrev'), { leadId: 'pc', updatedAt: serverTimestamp() }));
  });
  it('visitante não lista prévias nem lê o índice privado', async () => {
    await assertFails(getDocs(collection(pub(), 'previews')));
    await assertFails(getDoc(doc(pub(), 'leads', 'pc', 'previews', 'prevPrevPrevPrevPrev')));
    await assertFails(getDocs(collection(stranger(), 'leads', 'pc', 'previews')));
  });
});
