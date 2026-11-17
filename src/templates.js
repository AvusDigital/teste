'use strict';
// Páginas geradas no build. Texto sempre passa por esc(); não há innerHTML com dados no navegador.
const { brl } = require('../lib/util');

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const wa = (T, texto) => `https://wa.me/${T.loja.whatsapp}?text=${encodeURIComponent(texto)}`;

const ICONES = {
  carrinho: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.7 12.4a1 1 0 0 0 1 .8h8.8a1 1 0 0 0 1-.8L20 7H6"/></svg>',
  tema: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  busca: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>',
  menu: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>'
};

const logoPar = (loja, lazy) => `<img class="l-escuro" src="/img/logo-fundo-escuro.webp" alt="${esc(loja.nome)}" width="127" height="34"${lazy ? ' loading="lazy"' : ''}><img class="l-claro" src="/img/logo-fundo-claro.webp" alt="" width="127" height="34"${lazy ? ' loading="lazy"' : ''}>`;

function foto(p, eager = false) {
  return `<div class="foto"><img src="${esc(p.img)}" alt="${esc(p.nome)}" width="400" height="400" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async" referrerpolicy="no-referrer"></div>`;
}
const precoHtml = p => p.precoCent == null ? '<span class="preco consulta">Sob consulta</span>' : `<span class="preco">${brl(p.precoCent)}</span>`;

function card(p) {
  return `<article class="card" data-n="${esc(norm([p.nome, p.sku, p.categoria, p.subcategoria, p.marca].join(' ')))}" data-p="${p.precoCent ?? ''}" data-sub="${esc(p.subSlug)}" data-id="${p.id}">
${foto(p)}<div class="card-corpo"><span class="cat-nome">${esc(p.subcategoria || p.categoria)}</span>
<h3><a href="/produto/${p.slug}/">${esc(p.nome)}</a></h3>
<div class="card-rodape">${precoHtml(p)}${p.precoCent == null ? '' : `<button class="btn btn-peq" type="button" data-add="${p.id}" aria-label="Adicionar ${esc(p.nome)} ao carrinho">Adicionar</button>`}</div></div></article>`;
}

// ---------------------------------------------------------------- layout
function layout(T, { titulo, descricao, caminho, corpo, pagina, jsonld, noindex, imagem }) {
  const { loja, assets } = T;
  const tituloFull = titulo ? `${titulo} | ${loja.nome}` : `${loja.nome} — ${loja.slogan}`;
  const canon = T.siteUrl + caminho;
  const nav = [['/produtos/', 'Produtos'], ...T.categorias.filter(c => c.nome.length <= 16).slice(0, 3).map(c => [`/categoria/${c.slug}/`, c.nome])];
  const navHtml = nav.map(([h, t]) => `<a href="${h}"${caminho === h ? ' aria-current="page"' : ''}>${esc(t)}</a>`).join('');
  const legal = [loja.razaoSocial, loja.cnpj && `CNPJ ${loja.cnpj}`, loja.endereco].filter(Boolean).map(esc).join(' • ');
  return `<!doctype html>
<html lang="pt-BR" data-tema="escuro">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(tituloFull)}</title>
<meta name="description" content="${esc(descricao || loja.slogan)}">
<link rel="canonical" href="${esc(canon)}">
${noindex ? '<meta name="robots" content="noindex, nofollow">' : ''}
<meta property="og:type" content="${pagina === 'produto' ? 'product' : 'website'}"><meta property="og:site_name" content="${esc(loja.nome)}">
<meta property="og:title" content="${esc(tituloFull)}"><meta property="og:description" content="${esc(descricao || loja.slogan)}"><meta property="og:url" content="${esc(canon)}">
${imagem ? `<meta property="og:image" content="${esc(imagem)}">` : ''}
<meta name="theme-color" content="#1b1c1f">
<link rel="icon" href="/favicon.ico">
<script src="/assets/${assets.tema}"></script>
<link rel="stylesheet" href="/assets/${assets.css}">
<script src="/assets/${assets.js}" defer></script>
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g, '\\u003c')}</script>` : ''}
</head>
<body>
<a class="pular" href="#conteudo">Pular para o conteúdo</a>
${T.demo ? '<div class="faixa-demo" role="note">MODO DEMONSTRAÇÃO — frete e pagamento simulados, nenhum valor é cobrado</div>' : ''}
<header class="topo"><div class="wrap">
<a class="logo" href="/" aria-label="${esc(loja.nome)} — página inicial">${logoPar(loja, false)}</a>
<nav class="nav" aria-label="Principal">${navHtml}</nav>
<form class="busca-topo" action="/produtos/" role="search"><label class="visualmente-oculto" for="q-topo">Buscar produtos</label><input id="q-topo" type="search" name="q" placeholder="Buscar produto ou código" autocomplete="off"><button type="submit" aria-label="Buscar">${ICONES.busca}</button></form>
<div class="acoes">
<button class="icone-btn" type="button" data-tema-btn aria-label="Alternar tema claro/escuro">${ICONES.tema}</button>
<a class="icone-btn" href="/carrinho/" aria-label="Carrinho">${ICONES.carrinho}<span class="contagem" data-contagem hidden>0</span></a>
<details class="menu-m"><summary class="icone-btn" aria-label="Menu">${ICONES.menu}</summary><nav aria-label="Menu móvel"><form action="/produtos/" role="search"><label class="visualmente-oculto" for="q-menu">Buscar</label><input id="q-menu" type="search" name="q" placeholder="Buscar produto ou código"><button type="submit" aria-label="Buscar">${ICONES.busca}</button></form><a href="/produtos/">Todos os produtos</a>${T.categorias.map(c => `<a href="/categoria/${c.slug}/">${esc(c.nome)}</a>`).join('')}<a href="/politicas/">Políticas</a></nav></details>
</div></div></header>
<main id="conteudo" data-pagina="${pagina}">
${corpo}
</main>
<footer class="rodape"><div class="wrap">
<div class="cols">
<div>${logoPar(loja, true)}<p class="suave rodape-slogan">${esc(loja.slogan)}. Envio para todo o Brasil.</p></div>
<div><h3>Loja</h3><ul><li><a href="/produtos/">Todos os produtos</a></li>${T.categorias.slice(0, 4).map(c => `<li><a href="/categoria/${c.slug}/">${esc(c.nome)}</a></li>`).join('')}</ul></div>
<div><h3>Atendimento</h3><ul><li><a href="${wa(T, 'Olá! Tenho uma dúvida sobre a loja.')}" rel="noopener">WhatsApp</a></li>${loja.email ? `<li><a href="mailto:${esc(loja.email)}">${esc(loja.email)}</a></li>` : ''}${loja.retirada.ativa && loja.retirada.endereco ? `<li>Retirada: ${esc(loja.retirada.endereco)}${loja.retirada.horario ? '<br>' + esc(loja.retirada.horario) : ''}</li>` : ''}</ul></div>
<div><h3>Informações</h3><ul><li><a href="/politicas/#entrega-e-frete">Entrega e frete</a></li><li><a href="/politicas/#trocas-e-devolucoes">Trocas e devoluções</a></li><li><a href="/politicas/#privacidade">Privacidade</a></li></ul></div>
</div>
<div class="legal"><span>${legal || esc(loja.nome)}</span><span>Pagamento em ambiente seguro. Não guardamos dados de cartão.</span></div>
</div></footer>
<div class="toast" role="status" aria-live="polite" data-toast></div>
</body></html>`;
}

// ---------------------------------------------------------------- home
function home(T) {
  const { loja } = T;
  const heroP = T.destaques[0];
  const destaques = T.destaques.slice(heroP ? 1 : 0, 9);
  return layout(T, {
    caminho: '/', pagina: 'home', descricao: `${loja.slogan}: pistolas, preparação de ar, acessórios e cabines. Frete calculado pelo CEP, Pix e cartão.`,
    jsonld: { '@context': 'https://schema.org', '@type': 'Store', name: loja.nome, url: T.siteUrl, ...(loja.email ? { email: loja.email } : {}), ...(loja.endereco ? { address: loja.endereco } : {}) },
    corpo: `<section class="hero"><div class="wrap">
<div><h1>Equipamento de pintura que não te deixa na mão.</h1>
<p class="lead">Pistolas, preparação de ar, acessórios e cabines para pintura automotiva e industrial. Você vê o frete pelo CEP antes de pagar.</p>
<div class="cta"><a class="btn" href="/produtos/">Ver produtos</a><a class="btn btn-sec" href="${wa(T, 'Olá! Preciso de ajuda para escolher um equipamento.')}" rel="noopener">Falar no WhatsApp</a></div>
<div class="garantias"><span>Linha profissional</span><span>Envio para todo o Brasil</span><span>Pix e cartão</span></div></div>
${heroP ? `<div class="destaque-hero">${foto(heroP, true)}<div class="info"><span class="suave">${esc(heroP.categoria)}</span><h2><a class="sem-sub" href="/produto/${heroP.slug}/">${esc(heroP.nome)}</a></h2>
<div class="linha">${precoHtml(heroP)}<button class="btn" type="button" data-add="${heroP.id}">Adicionar ao carrinho</button></div></div></div>` : ''}
</div></section>
<section class="secao"><div class="wrap"><div class="secao-cab"><h2>Compre por categoria</h2><a href="/produtos/">Ver tudo</a></div>
<div class="cats">${T.categorias.map(c => `<a class="cat" href="/categoria/${c.slug}/"><div class="foto"><img src="${esc(c.img)}" alt="" width="84" height="84" loading="lazy" referrerpolicy="no-referrer"></div><div><strong>${esc(c.nome)}</strong><span>${c.qtd} produto${c.qtd > 1 ? 's' : ''}</span></div></a>`).join('')}</div></div></section>
${destaques.length ? `<section class="secao"><div class="wrap"><div class="secao-cab"><h2>Mais procurados</h2><a href="/produtos/">Ver todos</a></div><div class="grade">${destaques.map(card).join('')}</div></div></section>` : ''}
<section class="secao"><div class="wrap"><div class="faixa">
<div><h3>Frete antes de pagar</h3><p>Coloque o CEP no carrinho e veja valor e prazo de cada opção de entrega.</p></div>
<div><h3>Pix e cartão</h3><p>O pagamento acontece no ambiente seguro do Mercado Pago. Você não digita cartão aqui.</p></div>
<div><h3>Atendimento direto</h3><p>Dúvida sobre qual pistola usar? Chame no WhatsApp e a gente indica.</p></div>
</div></div></section>`
  });
}

// ---------------------------------------------------------------- listagem
function listagem(T, cat) {
  const prods = cat ? T.produtos.filter(p => p.catSlug === cat.slug) : T.produtos;
  const subs = cat ? [...new Map(prods.filter(p => p.subcategoria).map(p => [p.subSlug, p.subcategoria]))] : [];
  const titulo = cat ? cat.nome : 'Todos os produtos';
  const caminho = cat ? `/categoria/${cat.slug}/` : '/produtos/';
  return layout(T, {
    titulo, caminho, pagina: 'lista',
    descricao: cat ? `${cat.nome} para pintura profissional: ${prods.length} produtos com frete calculado pelo CEP.` : `Catálogo completo da ${T.loja.nome}: pistolas, preparação de ar, acessórios e cabines.`,
    jsonld: { '@context': 'https://schema.org', '@type': 'ItemList', itemListElement: prods.slice(0, 50).map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: `${T.siteUrl}/produto/${p.slug}/`, name: p.nome })) },
    corpo: `<div class="wrap"><div class="pagina-cab"><nav class="migalhas" aria-label="Você está em"><a href="/">Início</a> / ${cat ? `<a href="/produtos/">Produtos</a> / ${esc(cat.nome)}` : 'Produtos'}</nav><h1>${esc(titulo)}</h1></div>
<div class="lista-layout"><aside class="filtros" aria-label="Filtros">
<div><h2>Buscar</h2><label class="visualmente-oculto" for="q">Buscar nesta lista</label><input id="q" type="search" placeholder="Nome ou código" autocomplete="off"></div>
<div><h2>Categorias</h2><ul><li><a href="/produtos/"${!cat ? ' aria-current="page"' : ''}>Todas <span>${T.produtos.length}</span></a></li>${T.categorias.map(c => `<li><a href="/categoria/${c.slug}/"${cat && cat.slug === c.slug ? ' aria-current="page"' : ''}>${esc(c.nome)} <span>${c.qtd}</span></a></li>`).join('')}</ul></div>
<div><h2>Ordenar</h2><label class="visualmente-oculto" for="ordem">Ordenar por</label><select id="ordem"><option value="">Relevância</option><option value="menor">Menor preço</option><option value="maior">Maior preço</option><option value="az">Nome (A–Z)</option></select></div>
</aside>
<section aria-label="Produtos">${subs.length > 1 ? `<div class="chips" role="group" aria-label="Subcategorias"><button class="chip" type="button" data-sub="" aria-pressed="true">Todas</button>${subs.map(([s, n]) => `<button class="chip" type="button" data-sub="${esc(s)}" aria-pressed="false">${esc(n)}</button>`).join('')}</div>` : ''}
<div class="barra"><span class="suave" data-resultado aria-live="polite">${prods.length} produto${prods.length !== 1 ? 's' : ''}</span></div>
<div class="grade" data-grade>${prods.map(card).join('')}</div>
<p class="vazio" data-vazio hidden>Nenhum produto encontrado. Tente outro termo ou <a href="${wa(T, 'Olá! Não encontrei um produto no site.')}" rel="noopener">fale com a gente no WhatsApp</a>.</p>
</section></div></div>`
  });
}

// ---------------------------------------------------------------- produto
function produto(T, p) {
  const cat = T.categorias.find(c => c.slug === p.catSlug);
  const rel = T.produtos.filter(x => x.catSlug === p.catSlug && x.id !== p.id && x.precoCent != null).slice(0, 4);
  const url = `${T.siteUrl}/produto/${p.slug}/`;
  const specs = [['Marca', p.marca], ['Categoria', p.categoria], ['Subcategoria', p.subcategoria], ['Código', p.sku && p.sku !== p.nome ? p.sku : ''], ['Peso', p.pesoG ? `${p.pesoG} g` : '']].filter(r => r[1]);
  const ld = { '@context': 'https://schema.org', '@type': 'Product', name: p.nome, image: [p.imgAbs], sku: p.sku || String(p.id), category: p.categoria,
    ...(p.marca ? { brand: { '@type': 'Brand', name: p.marca } } : {}), ...(p.descricao ? { description: p.descricao } : {}),
    ...(p.precoCent != null ? { offers: { '@type': 'Offer', url, priceCurrency: 'BRL', price: (p.precoCent / 100).toFixed(2), availability: 'https://schema.org/InStock', itemCondition: 'https://schema.org/NewCondition' } } : {}) };
  return layout(T, {
    titulo: p.nome, caminho: `/produto/${p.slug}/`, pagina: 'produto', imagem: p.imgAbs, jsonld: ld,
    descricao: p.descricao || `${p.nome}${p.precoCent != null ? ` por ${brl(p.precoCent)}` : ''}. ${p.categoria} da ${T.loja.nome}, com frete calculado pelo CEP.`,
    corpo: `<div class="wrap"><nav class="migalhas topo-mig" aria-label="Você está em"><a href="/">Início</a> / <a href="/produtos/">Produtos</a> / <a href="/categoria/${cat.slug}/">${esc(cat.nome)}</a></nav>
<div class="produto" data-id="${p.id}" data-controlado="${p.estoque != null ? 1 : 0}">${foto(p, true)}
<div class="info"><span class="suave">${esc(p.subcategoria || p.categoria)}</span><h1 class="h1-prod">${esc(p.nome)}</h1>
${precoHtml(p)}<p class="esgotado" data-esgotado hidden>Esgotado no momento.</p><p class="suave" data-estoque-info hidden></p>
${p.precoCent != null ? `<div class="acoes-compra" data-compra><div class="qtd"><button type="button" data-menos aria-label="Diminuir quantidade">−</button><input type="number" inputmode="numeric" min="1" max="99" value="1" aria-label="Quantidade" data-qtd><button type="button" data-mais aria-label="Aumentar quantidade">+</button></div>
<button class="btn flex1" type="button" data-add="${p.id}" data-usar-qtd>Adicionar ao carrinho</button></div>
<p class="aviso">Frete calculado pelo CEP no carrinho. Pagamento por Pix ou cartão no Mercado Pago.</p>` : `<p class="aviso">Este produto é vendido sob consulta. Chame no WhatsApp para saber valor e prazo.</p>`}
<a class="btn btn-sec" href="${wa(T, `Olá! Tenho uma dúvida sobre: ${p.nome}\n${url}`)}" rel="noopener">Tirar dúvida no WhatsApp</a>
${p.descricao ? `<div><h2 class="h2-peq">Sobre o produto</h2><p class="suave">${esc(p.descricao)}</p></div>` : ''}
<table class="specs"><tbody>${specs.map(([k, v]) => `<tr><th scope="row">${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</tbody></table>
</div></div>
${rel.length ? `<section class="secao sem-topo"><div class="secao-cab"><h2>Mais em ${esc(cat.nome)}</h2><a href="/categoria/${cat.slug}/">Ver categoria</a></div><div class="grade">${rel.map(card).join('')}</div></section>` : ''}</div>`
  });
}

// ---------------------------------------------------------------- carrinho / checkout / sucesso / demo
const cab = (t, s) => `<div class="pagina-cab"><h1 class="h1-pag">${t}</h1>${s ? `<p>${s}</p>` : ''}</div>`;

function carrinho(T) {
  return layout(T, { titulo: 'Carrinho', caminho: '/carrinho/', pagina: 'carrinho', noindex: true, descricao: 'Seu carrinho.',
    corpo: `<div class="wrap">${cab('Seu carrinho')}
<div data-vazio-carrinho hidden class="vazio">Seu carrinho está vazio. <a href="/produtos/">Ver produtos</a></div>
<div class="duas-col" data-conteudo-carrinho hidden>
<div class="caixa"><h2>Itens</h2><div data-itens></div></div>
<aside class="resumo"><div class="caixa"><h2>Entrega</h2>
<form data-form-cep novalidate><label for="cep">CEP de entrega<div class="cep-linha"><input id="cep" inputmode="numeric" autocomplete="postal-code" placeholder="00000-000" maxlength="9"><button class="btn btn-sec" type="submit">Calcular</button></div></label></form>
<p class="erro-msg" role="alert" data-erro></p><div class="opcoes" data-opcoes></div></div>
<div class="caixa"><div class="linha-valor"><span>Produtos</span><span data-subtotal>—</span></div><div class="linha-valor"><span>Frete</span><span data-frete>Calcule pelo CEP</span></div><div class="linha-valor total"><span>Total</span><span data-total>—</span></div>
<a class="btn btn-bloco mt1" href="/checkout/" data-continuar aria-disabled="true">Continuar para o pagamento</a></div></aside></div></div>` });
}

function checkout(T) {
  const campo = (id, rotulo, extra = '', cls = '') => `<label class="${cls}" for="${id}">${rotulo}<input id="${id}" name="${id}" ${extra} required></label>`;
  return layout(T, { titulo: 'Finalizar pedido', caminho: '/checkout/', pagina: 'checkout', noindex: true, descricao: 'Finalize seu pedido.',
    corpo: `<div class="wrap">${cab('Finalizar pedido')}
<form class="duas-col" data-form-checkout novalidate><div>
<div class="caixa"><h2>Seus dados</h2><div class="campos">
${campo('nome', 'Nome completo', 'autocomplete="name" maxlength="80"')}
${campo('email', 'E-mail', 'type="email" autocomplete="email" maxlength="120"', 'c3')}${campo('fone', 'WhatsApp com DDD', 'inputmode="tel" autocomplete="tel" maxlength="16"', 'c3')}
${campo('doc', 'CPF ou CNPJ', 'inputmode="numeric" maxlength="18"')}</div></div>
<div class="caixa" data-bloco-entrega><h2>Endereço de entrega</h2><div class="campos">
${campo('cep', 'CEP', 'inputmode="numeric" autocomplete="postal-code" maxlength="9"', 'c2')}${campo('rua', 'Rua', 'autocomplete="address-line1" maxlength="100"', 'c4')}
${campo('numero', 'Número', 'maxlength="12"', 'c2')}<label class="c4" for="complemento">Complemento <small>(opcional)</small><input id="complemento" maxlength="60" autocomplete="address-line2"></label>
${campo('bairro', 'Bairro', 'maxlength="60"', 'c3')}${campo('cidade', 'Cidade', 'maxlength="60" autocomplete="address-level2"', 'c2')}${campo('uf', 'UF', 'maxlength="2" autocomplete="address-level1"', 'c1')}</div></div>
<p class="aviso" data-aviso-retirada hidden>Você escolheu retirar na loja. Não precisa informar endereço.</p></div>
<aside class="resumo"><div class="caixa"><h2>Resumo</h2><div data-resumo></div>
<p class="erro-msg" role="alert" data-erro></p>
<button class="btn btn-bloco" type="submit" data-enviar>Ir para o pagamento</button>
<p class="suave nota">Você paga por Pix ou cartão no ambiente seguro do Mercado Pago. Usamos seus dados só para processar e entregar o pedido.</p></div></aside></form></div>` });
}

function sucesso(T) {
  return layout(T, { titulo: 'Pedido', caminho: '/sucesso/', pagina: 'sucesso', noindex: true, descricao: 'Status do seu pedido.',
    corpo: `<div class="wrap"><div class="caixa status" data-status><div class="marca" aria-hidden="true">…</div><h1 class="h1-st" data-titulo>Verificando seu pedido</h1><p data-texto>Só um instante.</p><span class="codigo" data-codigo hidden></span>
<div class="acoes-centro"><a class="btn" href="/produtos/">Continuar comprando</a><a class="btn btn-sec" data-wa href="${wa(T, 'Olá! Quero falar sobre o meu pedido.')}" rel="noopener">Falar no WhatsApp</a></div></div>
<div class="caixa resumo-pedido" data-resumo-pedido hidden></div></div>` });
}

function pagamentoDemo(T) {
  return layout(T, { titulo: 'Pagamento (demonstração)', caminho: '/pagamento-demo/', pagina: 'pagamento-demo', noindex: true, descricao: 'Pagamento de demonstração.',
    corpo: `<div class="wrap estreito">${cab('Pagamento de demonstração', 'Esta página simula o checkout do Mercado Pago. Nenhum valor é cobrado.')}
<div class="caixa"><div data-resumo></div><p class="erro-msg" role="alert" data-erro></p>
<div class="pilha mt1"><button class="btn" type="button" data-resultado="aprovado">Simular pagamento aprovado</button><button class="btn btn-sec" type="button" data-resultado="pendente">Simular pagamento pendente (Pix aguardando)</button><button class="btn btn-sec" type="button" data-resultado="recusado">Simular pagamento recusado</button></div></div></div>` });
}

function politicas(T) {
  const slug = s => esc(norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
  return layout(T, { titulo: 'Políticas da loja', caminho: '/politicas/', pagina: 'texto', descricao: 'Entrega, pagamento, trocas e privacidade.',
    corpo: `<div class="wrap"><div class="pagina-cab"><h1>Políticas da loja</h1></div><div class="texto">${T.loja.politicas.map(p => `<h2 id="${slug(p.titulo)}">${esc(p.titulo)}</h2><p>${esc(p.texto)}</p>`).join('')}
<p class="mt2">Dúvidas? <a href="${wa(T, 'Olá! Tenho uma dúvida sobre as políticas da loja.')}" rel="noopener">Fale com a gente no WhatsApp</a>.</p></div></div>` });
}

function naoEncontrada(T) {
  return layout(T, { titulo: 'Página não encontrada', caminho: '/404.html', pagina: 'texto', noindex: true, descricao: 'Página não encontrada.',
    corpo: `<div class="wrap"><div class="status"><h1>Essa página não existe</h1><p>O link pode ter mudado. Veja o catálogo ou fale com a gente.</p><div class="acoes-centro"><a class="btn" href="/produtos/">Ver produtos</a><a class="btn btn-sec" href="/">Início</a></div></div></div>` });
}

module.exports = { home, listagem, produto, carrinho, checkout, sucesso, pagamentoDemo, politicas, naoEncontrada, norm };
