// Testes das regras do Firestore (fase 3: sites modelo, kit da marca e qualificação).
// Rodam só no emulador local, com o projeto fictício "demo-cron". Nunca tocam no banco real.

const fs = require('fs');
const path = require('path');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { doc, setDoc, updateDoc, deleteDoc, getDoc, getDocs, addDoc, collection, query, where, serverTimestamp } = require('firebase/firestore');

let env;
const ADMIN = 'adminUid0000000000000001';
const IMG = 'data:image/webp;base64,UklGRhIAAABXRUJQVlA4TAYAAAAvAAAAAAfQ//73v/+BiOh/AAA=';

function preview(extra) {
  return Object.assign({
    leadId: 'lead1', niche: 'industria-moveis', template: '_base', format: 'catalogo', formatReason: 'Muitos produtos',
    companyName: 'Bellini Estofados', tagline: 'Estofados feitos para durar', mainService: 'Estofados sob medida',
    services: ['Sofás', 'Poltronas'], primaryColor: '#c6ff02', secondaryColor: '#1a1a1a', logo: IMG,
    products: [{ name: 'Sofá Aurora', description: 'Retrátil', category: 'Sofás', image: IMG }], categories: ['Sofás'],
    texts: { headline: 'Olá', diferenciais: ['Um', 'Dois'] },
    active: true, createdBy: 'admin', createdAt: serverTimestamp(), updatedAt: serverTimestamp()
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
    await setDoc(doc(db, 'admins', ADMIN), {});
    await setDoc(doc(db, 'leads', 'lead1'), { origin: 'cronus', createdBy: 'cronus', status: 'novo', company: 'Bellini', createdAt: new Date() });
    await setDoc(doc(db, 'previews', 'ativaAtivaAtivaAtiva'), Object.assign(preview(), { createdAt: new Date(), updatedAt: new Date() }));
    await setDoc(doc(db, 'previews', 'inativaInativaInativ'), Object.assign(preview({ active: false }), { createdAt: new Date(), updatedAt: new Date() }));
    await setDoc(doc(db, 'leads', 'lead1', 'kit', 'marca'), { logo: IMG, products: [], categories: [], updatedAt: new Date(), updatedBy: 'admin' });
  });
});

const admin = () => env.authenticatedContext(ADMIN).firestore();
const pub = () => env.unauthenticatedContext().firestore();

describe('prévias: público', () => {
  it('abre prévia ativa', async () => { await assertSucceeds(getDoc(doc(pub(), 'previews', 'ativaAtivaAtivaAtiva'))); });
  it('não abre prévia inativa', async () => { await assertFails(getDoc(doc(pub(), 'previews', 'inativaInativaInativ'))); });
  it('não lista prévias', async () => {
    await assertFails(getDocs(collection(pub(), 'previews')));
    await assertFails(getDocs(query(collection(pub(), 'previews'), where('active', '==', true))));
  });
  it('não cria, não edita, não apaga', async () => {
    await assertFails(addDoc(collection(pub(), 'previews'), preview()));
    await assertFails(updateDoc(doc(pub(), 'previews', 'ativaAtivaAtivaAtiva'), { companyName: 'Outra' }));
    await assertFails(deleteDoc(doc(pub(), 'previews', 'ativaAtivaAtivaAtiva')));
  });
  it('não lê o kit', async () => { await assertFails(getDoc(doc(pub(), 'leads', 'lead1', 'kit', 'marca'))); });
});

describe('prévias: admin', () => {
  it('cria prévia válida e lista por lead', async () => {
    await assertSucceeds(addDoc(collection(admin(), 'previews'), preview()));
    await assertSucceeds(getDocs(query(collection(admin(), 'previews'), where('leadId', '==', 'lead1'))));
  });
  it('recusa campo a mais, cor, formato e data inválidos', async () => {
    await assertFails(addDoc(collection(admin(), 'previews'), preview({ phone: '14999990000' })));
    await assertFails(addDoc(collection(admin(), 'previews'), preview({ primaryColor: 'vermelho' })));
    await assertFails(addDoc(collection(admin(), 'previews'), preview({ format: 'sistema' })));
    await assertFails(addDoc(collection(admin(), 'previews'), preview({ createdAt: new Date(2020, 0, 1) })));
    await assertFails(addDoc(collection(admin(), 'previews'), preview({ createdBy: 'cronus' })));
  });
  it('recusa produtos fora do limite', async () => {
    const many = Array.from({ length: 25 }, (_, i) => ({ name: 'Produto ' + i }));
    await assertFails(addDoc(collection(admin(), 'previews'), preview({ products: many })));
    await assertFails(addDoc(collection(admin(), 'previews'), preview({ products: [{ name: 'x'.repeat(61) }] })));
    await assertFails(addDoc(collection(admin(), 'previews'), preview({ products: [{ name: 'Ok', image: 'https://site.com/foto.jpg' }] })));
    await assertFails(addDoc(collection(admin(), 'previews'), preview({ logo: 'data:text/html;base64,PGgxPg==' })));
    await assertSucceeds(addDoc(collection(admin(), 'previews'), preview({ products: Array.from({ length: 24 }, (_, i) => ({ name: 'Produto ' + i })) })));
  });
  it('atualiza e desativa, mas não troca o lead', async () => {
    await assertSucceeds(updateDoc(doc(admin(), 'previews', 'ativaAtivaAtivaAtiva'), { active: false, updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(admin(), 'previews', 'ativaAtivaAtivaAtiva'), { leadId: 'outro', updatedAt: serverTimestamp() }));
  });
  it('apaga (exclusão completa do lead)', async () => {
    await assertSucceeds(deleteDoc(doc(admin(), 'previews', 'inativaInativaInativ')));
  });
});

describe('qualificação e marca no lead', () => {
  it('admin grava qualificação, formato, marca e prévia aprovada', async () => {
    await assertSucceeds(updateDoc(doc(admin(), 'leads', 'lead1'), {
      qualification: 'qualificado', format: 'catalogo', formatReason: 'Muitos produtos',
      brand: { primaryColor: '#123456', secondaryColor: '', tagline: 'Slogan', mainService: 'Serviço', services: ['A', 'B'] },
      draft: { channel: 'whatsapp', text: 'Oi {link}', approved: true, approvedAt: serverTimestamp(), previewId: 'ativaAtivaAtivaAtiva' }
    }));
    await assertSucceeds(updateDoc(doc(admin(), 'leads', 'lead1'), { qualification: 'desqualificado', disqualifyReason: 'Já tem site novo' }));
  });
  it('recusa valores fora do formato', async () => {
    await assertFails(updateDoc(doc(admin(), 'leads', 'lead1'), { qualification: 'talvez' }));
    await assertFails(updateDoc(doc(admin(), 'leads', 'lead1'), { format: 'sistema' }));
    await assertFails(updateDoc(doc(admin(), 'leads', 'lead1'), { brand: { primaryColor: 'azul' } }));
    await assertFails(updateDoc(doc(admin(), 'leads', 'lead1'), { brand: { services: Array(9).fill('x') } }));
    await assertFails(updateDoc(doc(admin(), 'leads', 'lead1'), { 'draft.previewId': 'id com espaço' }));
  });
  it('o formulário público continua passando', async () => {
    await assertSucceeds(addDoc(collection(pub(), 'leads'), {
      name: 'Maria', whatsapp: '14999990000', email: '', company: '', need: '', message: '',
      source: 'hero-primary', sourceLabel: 'Quero', project: '', consent: true, consentText: 'Concordo',
      consentAt: serverTimestamp(), createdAt: serverTimestamp(), status: 'novo', notes: '', page: '', referrer: '', utm: {}
    }));
  });
});

describe('kit da marca', () => {
  it('só aceita o documento marca', async () => {
    await assertSucceeds(setDoc(doc(admin(), 'leads', 'lead1', 'kit', 'marca'), { logo: IMG, products: [{ name: 'Mesa' }], categories: ['Mesas'], updatedAt: serverTimestamp(), updatedBy: 'admin' }));
    await assertFails(setDoc(doc(admin(), 'leads', 'lead1', 'kit', 'outro'), { logo: IMG, updatedAt: serverTimestamp(), updatedBy: 'admin' }));
  });
  it('respeita os limites de logo e produtos', async () => {
    await assertFails(setDoc(doc(admin(), 'leads', 'lead1', 'kit', 'marca'), { logo: 'data:image/png;base64,' + 'A'.repeat(200001), updatedAt: serverTimestamp(), updatedBy: 'admin' }));
    await assertFails(setDoc(doc(admin(), 'leads', 'lead1', 'kit', 'marca'), { products: Array.from({ length: 25 }, () => ({ name: 'x' })), updatedAt: serverTimestamp(), updatedBy: 'admin' }));
    await assertFails(setDoc(doc(admin(), 'leads', 'lead1', 'kit', 'marca'), { products: [{ name: 'x', image: 'data:image/png;base64,' + 'A'.repeat(30001) }], updatedAt: serverTimestamp(), updatedBy: 'admin' }));
  });
  it('admin apaga junto com o lead', async () => {
    await assertSucceeds(deleteDoc(doc(admin(), 'leads', 'lead1', 'kit', 'marca')));
  });
});
