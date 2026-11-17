'use strict';
// Build sem dependências: planilha/CSV -> catálogo validado -> páginas HTML estáticas em dist/.
// Falha fechado: se o catálogo estiver quebrado, o build aborta e o deploy anterior continua no ar.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { slugify } = require('../lib/util');
const loja = require('../data/loja.json');
const T = require('../src/templates');

const RAIZ = path.join(__dirname, '..'), DIST = path.join(RAIZ, 'dist');
const lerArq = p => fs.readFileSync(path.join(RAIZ, p), 'utf8');

const { parseCsv, numero, decodificar } = require('./csv');
const { dimensoes } = require('./imgsize');
const sim = s => /^(sim|s|1|true|x)$/i.test(s);

async function carregarCsv(avisos) {
  const url = process.env.CATALOGO_CSV_URL;
  if (url) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const txt = decodificar(Buffer.from(await r.arrayBuffer()));
      if (!/^\uFEFF?\s*id\s*[,;]/i.test(txt)) throw new Error('não parece o CSV de produtos (primeira coluna deve ser "id")');
      console.log('catálogo: planilha online (CATALOGO_CSV_URL)');
      return txt;
    } catch (e) { avisos.push(`CATALOGO_CSV_URL falhou (${e.message}); usando data/produtos.csv`); }
  }
  console.log('catálogo: data/produtos.csv');
  return decodificar(fs.readFileSync(path.join(RAIZ, 'data/produtos.csv')));
}

// ---------- normalização e validação ----------
function normalizar(linhas, avisos) {
  const erros = [], ids = new Set(), slugs = new Set(), out = [];
  const locais = fs.existsSync(path.join(RAIZ, 'public/img/produtos')) ? fs.readdirSync(path.join(RAIZ, 'public/img/produtos')) : [];
  linhas.forEach((l, i) => {
    const ln = i + 2, id = Number(l.id);
    if (!Number.isInteger(id) || id < 1) return erros.push(`linha ${ln}: id inválido "${l.id}"`);
    if (ids.has(id)) return erros.push(`linha ${ln}: id ${id} repetido`);
    ids.add(id);
    if (!l.nome) return erros.push(`linha ${ln} (id ${id}): nome vazio`);
    const preco = numero(l.preco), estoque = numero(l.estoque), peso = numero(l.peso_g);
    if (Number.isNaN(preco) || (preco != null && preco < 0)) return erros.push(`linha ${ln} (id ${id}): preço inválido "${l.preco}"`);
    if (Number.isNaN(estoque) || (estoque != null && (estoque < 0 || !Number.isInteger(estoque)))) return erros.push(`linha ${ln} (id ${id}): estoque inválido "${l.estoque}"`);
    const dim = ['comprimento_cm', 'largura_cm', 'altura_cm'].map(k => numero(l[k]));
    if (dim.some(Number.isNaN)) return erros.push(`linha ${ln} (id ${id}): medidas inválidas`);
    let slug = slugify(l.nome); if (slugs.has(slug)) slug = `${slug}-${id}`; slugs.add(slug);
    const local = locais.find(f => f.startsWith(id + '.'));
    const img = local ? `/img/produtos/${local}` : (/^https:\/\//.test(l.imagem) ? l.imagem : '/img/placeholder.svg');
    out.push({
      id, slug, sku: l.sku, nome: l.nome, categoria: l.categoria || 'Outros', subcategoria: l.subcategoria || '', marca: l.marca,
      precoCent: preco == null ? null : Math.round(preco * 100), estoque, pesoG: peso || null,
      dim: dim.every(Boolean) ? { c: dim[0], l: dim[1], a: dim[2] } : null,
      img, descricao: l.descricao, destaque: sim(l.destaque), ativo: l.ativo === '' ? true : !/^(nao|não|n|0|false)$/i.test(l.ativo)
    });
  });
  if (erros.length) { console.error('\nERROS NO CATÁLOGO:\n - ' + erros.join('\n - ')); process.exit(1); }
  const ativos = out.filter(p => p.ativo);
  if (!ativos.length) { console.error('\nERRO: nenhum produto ativo. Abortando para não publicar loja vazia.'); process.exit(1); }
  const semPeso = ativos.filter(p => !p.pesoG).length, semDim = ativos.filter(p => !p.dim).length, semImg = ativos.filter(p => p.img.endsWith('placeholder.svg')).length;
  const remotas = ativos.filter(p => p.img.startsWith('https://')).length;
  if (semPeso) avisos.push(`${semPeso} produto(s) sem peso_g (usa FRETE_PESO_PADRAO_G)`);
  if (semDim) avisos.push(`${semDim} de ${ativos.length} produto(s) sem medidas: o frete real usará a caixa padrão (FRETE_CAIXA_PADRAO). Preencha comprimento/largura/altura.`);
  if (semImg) avisos.push(`${semImg} produto(s) sem imagem`);
  const pequenas = ativos.filter(p => p.img.startsWith('/img/produtos/')).filter(p => { try { const d = dimensoes(fs.readFileSync(path.join(RAIZ, 'public', p.img))); return d && Math.min(d.w, d.h) < 600; } catch { return false; } }).length;
  if (pequenas) avisos.push(`${pequenas} imagem(ns) local(is) com menos de 600 px: podem ficar borradas em telas grandes (veja data/imagens-pequenas.txt)`);
  if (remotas) avisos.push(`${remotas} imagem(ns) ainda vêm de site externo. Rode "npm run imagens" para baixar para o projeto.`);
  return ativos;
}

// ---------- saída ----------
const gravar = (rel, conteudo) => { const p = path.join(DIST, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, conteudo); };
const hashDe = c => crypto.createHash('sha1').update(c).digest('hex').slice(0, 8);
function copiarDir(de, para) { if (!fs.existsSync(de)) return; for (const f of fs.readdirSync(de, { withFileTypes: true })) { const a = path.join(de, f.name), b = path.join(para, f.name); if (f.isDirectory()) { fs.mkdirSync(b, { recursive: true }); copiarDir(a, b); } else fs.copyFileSync(a, b); } }

async function main() {
  const avisos = [];
  const produtos = normalizar(parseCsv(await carregarCsv(avisos)), avisos);

  fs.rmSync(DIST, { recursive: true, force: true }); fs.mkdirSync(DIST, { recursive: true });
  copiarDir(path.join(RAIZ, 'public'), DIST);

  // assets com hash no nome (cache imutável)
  const assets = {};
  for (const [chave, arq, ext] of [['css', 'src/styles.css', 'css'], ['js', 'src/client/app.js', 'js'], ['tema', 'src/client/tema.js', 'js']]) {
    const c = lerArq(arq); const nome = `${path.basename(arq, '.' + ext)}.${hashDe(c)}.${ext}`; gravar('assets/' + nome, c); assets[chave] = nome;
  }

  const siteUrl = (process.env.SITE_URL || loja.dominio).replace(/\/+$/, '');
  const abs = u => u.startsWith('/') ? siteUrl + u : u;
  produtos.forEach(p => { p.catSlug = slugify(p.categoria); p.subSlug = slugify(p.subcategoria); p.imgAbs = abs(p.img); });
  const categorias = [...new Set(produtos.map(p => p.categoria))].map(nome => {
    const ps = produtos.filter(p => p.categoria === nome); return { nome, slug: slugify(nome), qtd: ps.length, img: (ps.find(p => p.precoCent != null) || ps[0]).img };
  }).sort((a, b) => b.qtd - a.qtd);

  // destaques: marcados na planilha primeiro; depois um de cada categoria, em rodízio
  const comPreco = produtos.filter(p => p.precoCent != null);
  const destaques = comPreco.filter(p => p.destaque);
  for (let r = 0; destaques.length < 9 && r < 9; r++) for (const c of categorias) { const x = comPreco.filter(p => p.catSlug === c.slug && !destaques.includes(p))[0]; if (x && destaques.length < 9) destaques.push(x); }

  const modoDemo = (process.env.MODO || 'demo') !== 'producao';
  const ctx = { loja, assets, siteUrl, produtos, categorias, destaques, demo: modoDemo };

  gravar('index.html', T.home(ctx));
  gravar('produtos/index.html', T.listagem(ctx));
  categorias.forEach(c => gravar(`categoria/${c.slug}/index.html`, T.listagem(ctx, c)));
  produtos.forEach(p => gravar(`produto/${p.slug}/index.html`, T.produto(ctx, p)));
  gravar('carrinho/index.html', T.carrinho(ctx)); gravar('checkout/index.html', T.checkout(ctx)); gravar('sucesso/index.html', T.sucesso(ctx));
  gravar('pagamento-demo/index.html', T.pagamentoDemo(ctx)); gravar('politicas/index.html', T.politicas(ctx)); gravar('404.html', T.naoEncontrada(ctx));

  // catálogo para o navegador (carrinho) e para o servidor (preço/frete/estoque: fonte da verdade)
  gravar('catalogo.json', JSON.stringify(produtos.map(p => ({ i: p.id, s: p.slug, n: p.nome, p: p.precoCent, m: p.img }))));
  fs.writeFileSync(path.join(RAIZ, 'lib/catalogo.generated.json'), JSON.stringify({ geradoEm: new Date().toISOString(), produtos: produtos.map(({ id, slug, sku, nome, categoria, precoCent, estoque, pesoG, dim, ativo }) => ({ id, slug, sku, nome, categoria, precoCent, estoque, pesoG, dim, ativo })) }));

  const urls = ['/', '/produtos/', '/politicas/', ...categorias.map(c => `/categoria/${c.slug}/`), ...produtos.map(p => `/produto/${p.slug}/`)];
  gravar('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `<url><loc>${siteUrl}${u}</loc></url>`).join('\n')}\n</urlset>\n`);
  gravar('robots.txt', `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /carrinho/\nDisallow: /checkout/\nDisallow: /sucesso/\nDisallow: /pagamento-demo/\n\nSitemap: ${siteUrl}/sitemap.xml\n`);

  // autoverificação de segurança: o CSP proíbe script/estilo inline, então o HTML gerado não pode ter nenhum
  const ruins = [];
  (function varrer(d) { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) varrer(p); else if (f.name.endsWith('.html')) {
    const h = fs.readFileSync(p, 'utf8');
    if (/\sstyle="/.test(h)) ruins.push(path.relative(DIST, p) + ': atributo style inline');
    if (/\son[a-z]+="/.test(h)) ruins.push(path.relative(DIST, p) + ': manipulador on*= inline');
    if (/<script(?![^>]*(src=|application\/ld\+json))/.test(h)) ruins.push(path.relative(DIST, p) + ': <script> inline');
  } } })(DIST);
  if (ruins.length) { console.error('\nERRO (CSP): ' + [...new Set(ruins)].slice(0, 8).join('\n  ')); process.exit(1); }

  if (!loja.cnpj || !loja.razaoSocial || !loja.endereco) avisos.push('data/loja.json sem razaoSocial/cnpj/endereco (necessário antes de vender)');
  const paginas = 9 + categorias.length + produtos.length;
  console.log(`\nOK: ${produtos.length} produtos, ${categorias.length} categorias, ${paginas} páginas em dist/ (modo ${modoDemo ? 'demo' : 'producao'})`);
  if (avisos.length) console.log('\nAvisos:\n - ' + avisos.join('\n - '));
}
main().catch(e => { console.error(e); process.exit(1); });
