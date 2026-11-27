// Cron Web Studio · Prévias de exemplo para o modo demonstração
// Usadas em modelo/?demo=<id> (só no computador) e no modo demo do painel.
// Empresas fictícias, claramente de exemplo. Imagens geradas na hora pelo navegador (canvas).
// O campo `demo` só existe aqui: diz ao painel de exemplo a qual lead cada prévia pertence
// (na vida real isso fica no índice privado leads/{id}/previews, nunca na prévia pública).

(function () {
  'use strict';

  // Imagem de exemplo: fundo em degradê com uma forma simples (gerada só quando pedida)
  var cache = {};
  function sample(seed, a, b) {
    if (cache[seed]) return cache[seed];
    try {
      var c = document.createElement('canvas');
      c.width = 480; c.height = 360;
      var x = c.getContext('2d');
      var g = x.createLinearGradient(0, 0, 480, 360);
      g.addColorStop(0, a); g.addColorStop(1, b);
      x.fillStyle = g; x.fillRect(0, 0, 480, 360);
      x.fillStyle = 'rgba(255,255,255,.85)';
      x.beginPath();
      if (seed % 3 === 0) { x.arc(240, 190, 90, 0, Math.PI * 2); }
      else if (seed % 3 === 1) { x.roundRect ? x.roundRect(150, 110, 180, 160, 26) : x.rect(150, 110, 180, 160); }
      else { x.moveTo(240, 90); x.lineTo(350, 280); x.lineTo(130, 280); x.closePath(); }
      x.fill();
      cache[seed] = c.toDataURL('image/jpeg', 0.72);
    } catch (e) { cache[seed] = ''; }
    return cache[seed];
  }
  function logo(letter, bg, fg) {
    var k = 'logo' + letter + bg;
    if (cache[k]) return cache[k];
    try {
      var c = document.createElement('canvas');
      c.width = 256; c.height = 256;
      var x = c.getContext('2d');
      x.fillStyle = bg;
      x.beginPath(); x.arc(128, 128, 120, 0, Math.PI * 2); x.fill();
      x.fillStyle = fg; x.font = '600 120px Sora, Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText(letter, 128, 136);
      cache[k] = c.toDataURL('image/png');
    } catch (e) { cache[k] = ''; }
    return cache[k];
  }

  function build() {
    return [
      {
        id: 'demoLanding000000001', template: '_base', format: 'landing',
        demo: { leadId: 'l4', niche: 'construcao-vidracaria', formatReason: 'Um serviço principal e foco em gerar pedidos de orçamento.' },
        companyName: 'Vidraçaria Horizonte (exemplo)', tagline: 'Vidros sob medida para casas e empresas',
        mainService: 'Box, espelhos e fechamentos em vidro', services: ['Box para banheiro', 'Espelhos sob medida', 'Fechamento de sacadas'],
        primaryColor: '#0e7490', secondaryColor: '#f59e0b', logo: '', products: [], categories: [], texts: {}, active: true
      },
      {
        id: 'demoInstitucional001', template: 'industria-moveis', format: 'institucional',
        demo: { leadId: 'l14', niche: 'industria-moveis', formatReason: 'Empresa de serviços com várias frentes e sem site próprio.' },
        companyName: 'Arte em Madeira Planejados (exemplo)', tagline: 'Móveis planejados do projeto à montagem',
        mainService: 'Móveis planejados', services: ['Cozinhas planejadas', 'Dormitórios', 'Home office', 'Painéis e estantes', 'Projetos comerciais'],
        primaryColor: '#7c4a2d', secondaryColor: '#d6b48a', logo: logo('A', '#7c4a2d', '#ffffff'), products: [], categories: [],
        texts: { about: 'Exemplo de texto próprio: cada ambiente começa com uma visita técnica e um projeto em 3D. Depois da aprovação, a equipe produz e monta tudo, com acompanhamento até a entrega.' },
        active: true
      },
      {
        id: 'demoCatalogo00000001', template: '_base', format: 'catalogo',
        demo: { leadId: 'l13', niche: 'industria-moveis', formatReason: 'Linha grande de produtos e venda por orçamento.' },
        companyName: 'Bellini Estofados (exemplo)', tagline: 'Estofados feitos para durar',
        mainService: 'Estofados sob medida', services: ['Sofás sob medida', 'Poltronas', 'Reforma de estofados'],
        primaryColor: '#c6ff02', secondaryColor: '#1a1a1a', logo: logo('B', '#1a1a1a', '#c6ff02'),
        categories: ['Sofás', 'Poltronas', 'Cabeceiras'],
        products: [
          { name: 'Sofá Aurora', description: 'Retrátil e reclinável, com tecido à escolha.', category: 'Sofás', image: 'S0' },
          { name: 'Sofá Lume 3 lugares', description: 'Linhas retas e assento em espuma de alta densidade.', category: 'Sofás', image: 'S1' },
          { name: 'Sofá de canto Prisma', description: 'Modular, monta em L para salas amplas.', category: 'Sofás', image: '' },
          { name: 'Poltrona Vão', description: 'Base giratória e encosto alto.', category: 'Poltronas', image: 'S2' },
          { name: 'Poltrona Eixo', description: 'Pés em madeira maciça.', category: 'Poltronas', image: '' },
          { name: 'Cabeceira Ripada', description: 'Painel estofado com ripas em madeira.', category: 'Cabeceiras', image: 'S3' }
        ],
        texts: {}, active: true
      },
      // ---------- Template industria ----------
      (function () {
        var ip = industriaProducts();
        return {
          id: 'demoIndustriaCat0001', template: 'industria', format: 'catalogo',
          demo: { leadId: 'l18', niche: 'industria-maquinas', formatReason: 'Linha grande de máquinas por categoria e venda por orçamento.' },
          companyName: 'Massa Forte Equipamentos (exemplo)', tagline: 'Máquinas para panificação',
          mainService: 'Máquinas para panificação',
          services: ['Panificação industrial', 'Padarias e confeitarias', 'Supermercados', 'Cozinhas industriais', 'Indústria de massas'],
          primaryColor: '#b45309', secondaryColor: '#1f2937', logo: logo('M', '#b45309', '#ffffff'),
          categories: ip.categories, products: ip.products, texts: {}, active: true
        };
      })(),
      {
        id: 'demoIndustriaUm00001', template: 'industria', format: 'catalogo',
        demo: { leadId: 'l19', niche: 'industria-maquinas', formatReason: 'Um produto principal, mas com ficha técnica para mostrar.' },
        companyName: 'Prensa Ágil Equipamentos (exemplo)', tagline: '',
        mainService: 'Prensas hidráulicas', services: [],
        primaryColor: '#334155', secondaryColor: '', logo: '',
        categories: ['Prensas'],
        products: [{ name: 'Prensa hidráulica de bancada', description: 'Acionamento: hidráulico\nComando: bimanual\nEstrutura: aço soldado', category: 'Prensas', image: '' }],
        texts: {}, active: true
      },
      {
        id: 'demoIndustriaInst001', template: 'industria', format: 'institucional',
        demo: { leadId: 'l12', niche: 'industria-usinagem', formatReason: 'Fabrica sob desenho: mais aplicações do que produtos de linha.' },
        companyName: 'Lima Usinagem (exemplo)', tagline: 'Peças usinadas sob desenho',
        mainService: 'Peças usinadas sob desenho', services: ['Máquinas agrícolas', 'Linha automotiva', 'Indústria de alimentos', 'Manutenção industrial'],
        primaryColor: '#1d4ed8', secondaryColor: '#94a3b8', logo: logo('L', '#1d4ed8', '#ffffff'), products: [], categories: [],
        texts: {}, active: true
      },
      {
        id: 'demoIndustriaLand001', template: 'industria', format: 'landing',
        demo: { leadId: 'l20', niche: 'industria-implementos', formatReason: 'Uma linha principal e foco em pedidos de orçamento.' },
        companyName: 'Agro Leve Implementos (exemplo)', tagline: 'Implementos para pequenas propriedades',
        mainService: 'Implementos para pequenas propriedades', services: ['Preparo de solo', 'Plantio', 'Transporte na propriedade'],
        primaryColor: '#166534', secondaryColor: '#ca8a04', logo: logo('A', '#166534', '#ffffff'), products: [], categories: [],
        texts: {}, active: true
      }
    ];
  }

  function withImages(p) {
    p = JSON.parse(JSON.stringify(p));
    var colors = [['#c6ff02', '#5c7a00'], ['#d6d3d1', '#78716c'], ['#1a1a1a', '#525252'], ['#a3e635', '#1a1a1a'],
      ['#e7e5e4', '#a8a29e'], ['#cbd5e1', '#64748b'], ['#fde68a', '#b45309'], ['#d1d5db', '#374151']];
    (p.products || []).forEach(function (x) {
      if (/^S\d+$/.test(x.image)) { var n = Number(x.image.slice(1)); var c = colors[n % colors.length]; x.image = sample(n, c[0], c[1]); }
    });
    return p;
  }

  // Catálogo de exemplo do template industria: 12 categorias, 24 modelos, fichas "Rótulo: valor"
  function industriaProducts() {
    var cats = ['Masseiras', 'Cilindros', 'Divisoras', 'Modeladoras', 'Fornos de lastro', 'Fornos turbo',
      'Batedeiras', 'Fatiadoras', 'Câmaras de fermentação', 'Laminadoras', 'Moinhos', 'Acessórios'];
    var one = ['Masseira espiral', 'Cilindro laminador', 'Divisora de massa', 'Modeladora de pães', 'Forno de lastro', 'Forno turbo',
      'Batedeira planetária', 'Fatiadora de pães', 'Câmara de fermentação', 'Laminadora de massa', 'Moinho de farinha de rosca', 'Armário para assadeiras'];
    var list = [];
    cats.forEach(function (c, i) {
      var base = one[i];
      [0, 1].forEach(function (k) {
        var n = i * 2 + k;
        list.push({
          name: base + ' modelo ' + String.fromCharCode(65 + n),
          description: 'Capacidade: conforme o modelo\nMotor: ' + (k ? 'trifásico' : 'monofásico') + '\nAcabamento: aço carbono pintado',
          category: c,
          image: n % 5 === 4 ? '' : 'S' + (10 + n)
        });
      });
    });
    // casos-limite: nome de 60 caracteres, descrição que não segue o padrão, 5 linhas
    list[4].name = 'Divisora volumétrica de massa com regulagem fina das porções';
    list[5].description = 'Modelo compacto para bancada, indicado para produções menores. Pergunte pelas opções de acabamento.';
    list[9].description = 'Tensão: 220 V\nMotor: trifásico\nPeso: sob consulta\nCorreia: em V\nPintura: epóxi';
    return { categories: cats, products: list };
  }

  window.CRON_MODELO_DEMO = {
    list: function () { return build().map(withImages); },
    get: function (id) {
      var p = build().find(function (x) { return x.id === id; });
      if (!p) return null;
      p = withImages(p);
      delete p.demo;
      return p;
    }
  };
})();
