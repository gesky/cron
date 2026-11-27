// Formato dos produtos no Firestore (prévia e kit da marca).
//
// No banco, os produtos ficam em quatro listas paralelas:
//   products: { names: [...], descriptions: [...], categories: [...], images: [...] }
// O produto i é names[i], descriptions[i], categories[i] e images[i].
// Assim as regras conferem cada lista inteira numa expressão só (join + regex) e o
// catálogo de 24 produtos cabe no limite de 1000 expressões por gravação.
//
// No painel e na página da prévia, os produtos continuam sendo uma lista de objetos
// { name, description, category, image }. Este arquivo converte nos dois sentidos e
// também lê prévias antigas, gravadas como lista de objetos.
(function () {
  'use strict';
  var SEP = '¶'; // ¶: separador das listas nas regras; não pode aparecer nos textos
  var MAX = 24;

  function txt(v, max, multiline) {
    var s = typeof v === 'string' ? v : '';
    s = s.split(SEP).join(' ');
    if (!multiline) s = s.replace(/[\r\n]+/g, ' ');
    return s.trim().slice(0, max);
  }

  // lista de objetos -> listas paralelas (para gravar)
  function pack(list) {
    var out = { names: [], descriptions: [], categories: [], images: [] };
    (Array.isArray(list) ? list : []).forEach(function (p) {
      if (!p || out.names.length >= MAX) return;
      var name = txt(p.name, 60);
      if (!name) return;
      out.names.push(name);
      out.descriptions.push(txt(p.description, 160, true));
      out.categories.push(txt(p.category, 40));
      out.images.push(typeof p.image === 'string' ? p.image : '');
    });
    return out;
  }

  // listas paralelas (ou lista antiga de objetos) -> lista de objetos (para usar)
  function unpack(v) {
    if (Array.isArray(v)) return v.filter(function (p) { return p && typeof p === 'object'; });
    if (!v || typeof v !== 'object' || !Array.isArray(v.names)) return [];
    var d = v.descriptions || [], c = v.categories || [], im = v.images || [];
    return v.names.slice(0, MAX).map(function (name, i) {
      return { name: String(name || ''), description: String(d[i] || ''), category: String(c[i] || ''), image: String(im[i] || '') };
    });
  }

  // limpa uma lista de textos curtos para as regras (sem o separador)
  function cleanList(list, n, max) {
    return (Array.isArray(list) ? list : []).slice(0, n).map(function (x) { return txt(x, max); });
  }

  window.CRON_PRODUTOS = { pack: pack, unpack: unpack, cleanList: cleanList, SEP: SEP };
})();
