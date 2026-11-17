'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('fs'), path = require('path');
const { parseCsv, numero } = require('../scripts/csv');

test('CSV: aspas, vírgula dentro do campo, quebra de linha, BOM e separador ;', () => {
  const r = parseCsv('\uFEFFid,nome,preco\r\n1,"Pistola, grande ""VD""",\"1.234,50\"\r\n2,"Duas\nlinhas",10\r\n');
  assert.equal(r.length, 2); assert.equal(r[0].nome, 'Pistola, grande "VD"'); assert.equal(numero(r[0].preco), 1234.5); assert.equal(r[1].nome, 'Duas\nlinhas');
  assert.equal(parseCsv('id;nome;preco\n3;Teste;9,9')[0].nome, 'Teste');
  assert.equal(numero(''), null); assert.ok(Number.isNaN(numero('abc'))); assert.equal(numero('R$ 130,00'), 130);
});

test('build: páginas essenciais existem, SEO presente, sem script/estilo inline', () => {
  const dist = path.join(__dirname, '../dist'); if (!fs.existsSync(dist)) return;            // roda depois do build
  for (const f of ['index.html', 'produtos/index.html', 'carrinho/index.html', 'checkout/index.html', 'sucesso/index.html', 'politicas/index.html', '404.html', 'sitemap.xml', 'robots.txt', 'catalogo.json']) assert.ok(fs.existsSync(path.join(dist, f)), f);
  const cat = require('../lib/catalogo').lista, p = cat.find(x => x.precoCent != null);
  const html = fs.readFileSync(path.join(dist, 'produto', p.slug, 'index.html'), 'utf8');
  assert.match(html, /application\/ld\+json/); assert.match(html, /"@type":"Product"/); assert.match(html, /rel="canonical"/);
  assert.ok(!/\sstyle="/.test(html) && !/\son[a-z]+="/.test(html));
  assert.ok(fs.readFileSync(path.join(dist, 'sitemap.xml'), 'utf8').includes(`/produto/${p.slug}/`));
});
