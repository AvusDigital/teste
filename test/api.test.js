'use strict';
// Rodar: npm test   (precisa ter rodado "npm run build" antes, para gerar lib/catalogo.generated.json)
const test = require('node:test'), assert = require('node:assert/strict'), crypto = require('crypto');
for (const k of Object.keys(process.env)) if (/^(MODO|FRETE_|PAGAMENTO_|MERCADOPAGO_|SUPERFRETE_|STORE_|UPSTASH_|NOTIFICAR_|TELEGRAM_|SEGREDO_|SAUDE_|SITE_URL|ORIGEM_)/.test(k)) delete process.env[k];

const catalogo = require('../lib/catalogo');
const { getStore } = require('../lib/providers/store');
const P = require('../lib/pedido');
const U = require('../lib/util');
const api = n => require(`../api/${n}.js`);

const com = catalogo.lista.filter(p => p.precoCent != null && p.ativo);
const [A, B] = com, consulta = catalogo.lista.find(p => p.precoCent == null);

function chamar(fn, { method = 'POST', url = '/x', body, headers = {} } = {}) {
  return new Promise(resolve => {
    const req = { method, url, headers: { host: 'loja.test', 'x-forwarded-for': String(Math.random()), ...headers }, body };
    const res = { statusCode: 200, h: {}, setHeader(k, v) { this.h[k] = v; }, end(t) { let json = null; try { json = JSON.parse(t); } catch {} resolve({ status: this.statusCode, json, h: this.h }); } };
    fn(req, res);
  });
}
const cliente = { nome: 'Maria da Silva', email: 'maria@exemplo.com', fone: '(11) 91234-5678', doc: '529.982.247-25' };
const endereco = { cep: '01310-100', rua: 'Av. Paulista', numero: '1000', complemento: '', bairro: 'Bela Vista', cidade: 'São Paulo', uf: 'SP' };
const comFetch = async (impl, fn) => { const orig = global.fetch, chamadas = []; global.fetch = async (u, o) => { chamadas.push({ u: String(u), o, body: o?.body ? JSON.parse(o.body) : null }); return impl(String(u), o); }; try { await fn(chamadas); } finally { global.fetch = orig; } };
const resp = (obj, status = 200) => ({ ok: status < 400, status, json: async () => obj });
function capturarLog() { const orig = console.log, linhas = []; console.log = (...a) => linhas.push(a.join(' ')); return { linhas, parar: () => { console.log = orig; } }; }

test.beforeEach(() => { getStore()._limpar?.(); for (const k of Object.keys(process.env)) if (/^(MODO|FRETE_|PAGAMENTO_|MERCADOPAGO_|SUPERFRETE_|STORE_|UPSTASH_|NOTIFICAR_|TELEGRAM_|SEGREDO_|SAUDE_|SITE_URL|ORIGEM_)/.test(k)) delete process.env[k]; });

test('util: CPF e CNPJ', () => {
  assert.ok(U.cpfValido('529.982.247-25')); assert.ok(!U.cpfValido('111.111.111-11')); assert.ok(!U.cpfValido('529.982.247-24'));
  assert.ok(U.cnpjValido('11.222.333/0001-81')); assert.ok(!U.cnpjValido('11.222.333/0001-82'));
});

test('precificar: preço vem do catálogo, soma duplicados, recusa inválidos e sob consulta', async () => {
  const r = await P.precificar([{ id: A.id, qtd: 1 }, { id: A.id, qtd: 2 }, { id: B.id, qtd: 1, precoCent: 1 }]);
  assert.equal(r.subtotalCent, A.precoCent * 3 + B.precoCent);
  await assert.rejects(P.precificar([]), /vazio/);
  await assert.rejects(P.precificar([{ id: A.id, qtd: 0 }]), /inválido/);
  await assert.rejects(P.precificar([{ id: 999999, qtd: 1 }]), /não está mais disponível/);
  if (consulta) await assert.rejects(P.precificar([{ id: consulta.id, qtd: 1 }]), /sob consulta/);
});

test('estoque: limita a quantidade e baixa só no pagamento aprovado (uma vez)', async () => {
  const antes = A.estoque; A.estoque = 3;
  try {
    await assert.rejects(P.precificar([{ id: A.id, qtd: 4 }]), /Só temos 3/);
    const l = await P.precificar([{ id: A.id, qtd: 2 }]);
    const ped = await P.criar({ ...l, frete: { id: 'retirada', nome: 'Retirada', precoCent: 0 }, cliente: { ...cliente, tipoDoc: 'CPF', doc: '52998224725', fone: '11912345678' }, endereco: null, retirada: true });
    assert.equal(await P.disponivel(A), 3);
    const log = capturarLog();
    try { await P.confirmarPagamento(ped.codigo, { id: 'x1', metodo: 'pix', valorCent: ped.totalCent }); const r2 = await P.confirmarPagamento(ped.codigo, { id: 'x1', metodo: 'pix', valorCent: ped.totalCent }); assert.equal(r2.ja, true); }
    finally { log.parar(); }
    assert.equal(await P.disponivel(A), 1);                                    // baixou 2, só uma vez
    assert.equal(log.linhas.filter(x => x.includes('PEDIDO PAGO')).length, 1); // avisou a loja uma vez
    assert.equal((await P.obter(ped.codigo)).status, 'pago');
  } finally { A.estoque = antes; }
});

test('frete demo: opções, retirada, e o preço sobe com a quantidade', async () => {
  const a = await chamar(api('frete'), { body: { cep: '20040-020', itens: [{ id: A.id, qtd: 1 }] } });
  assert.equal(a.status, 200); assert.equal(a.json.demo, true);
  assert.deepEqual(a.json.opcoes.map(o => o.id).sort(), ['pac', 'retirada', 'sedex']);
  const b = await chamar(api('frete'), { body: { cep: '20040-020', itens: [{ id: A.id, qtd: 20 }] } });
  const pac = r => r.json.opcoes.find(o => o.id === 'pac').precoCent;
  assert.ok(pac(b) > pac(a));
  assert.equal((await chamar(api('frete'), { body: { cep: '123', itens: [{ id: A.id, qtd: 1 }] } })).status, 400);
});

test('checkout demo: valida dados, ignora preço do cliente, recalcula frete e cria o pedido', async () => {
  const itens = [{ id: A.id, qtd: 2, precoCent: 1 }];
  let r = await chamar(api('checkout'), { body: { itens, freteId: 'pac', cliente: { ...cliente, doc: '111.111.111-11' }, endereco } });
  assert.equal(r.status, 400); assert.match(r.json.erro, /CPF/);
  r = await chamar(api('checkout'), { body: { itens, freteId: 'inexistente', cliente, endereco } });
  assert.equal(r.status, 409);
  r = await chamar(api('checkout'), { body: { itens, freteId: 'pac', cliente, endereco } });
  assert.equal(r.status, 200); assert.match(r.json.url, /^\/pagamento-demo\/\?pedido=ARP-[0-9A-F]{10}&t=/);
  const ped = await P.obter(r.json.codigo);
  const frete = (await chamar(api('frete'), { body: { cep: endereco.cep, itens: [{ id: A.id, qtd: 2 }] } })).json.opcoes.find(o => o.id === 'pac').precoCent;
  assert.equal(ped.totalCent, A.precoCent * 2 + frete); assert.equal(ped.status, 'aguardando');
});

test('demo: token obrigatório, fluxo aprovado e recusado', async () => {
  const r = await chamar(api('checkout'), { body: { itens: [{ id: A.id, qtd: 1 }], freteId: 'retirada', cliente } });
  const codigo = r.json.codigo, t = new URL(r.json.url, 'http://x').searchParams.get('t');
  assert.equal((await chamar(api('pedido'), { method: 'GET', url: `/api/pedido?codigo=${codigo}&t=errado` })).status, 404);
  const ok = await chamar(api('pedido'), { method: 'GET', url: `/api/pedido?codigo=${codigo}&t=${t}` });
  assert.equal(ok.status, 200); assert.equal(ok.json.status, 'aguardando'); assert.equal(ok.json.cliente, undefined);   // sem dados pessoais no resumo público
  assert.equal((await chamar(api('demo-pagar'), { body: { codigo, t: 'x', resultado: 'aprovado' } })).status, 404);
  const log = capturarLog(); let p; try { p = await chamar(api('demo-pagar'), { body: { codigo, t, resultado: 'aprovado' } }); } finally { log.parar(); }
  assert.equal(p.json.status, 'pago');
  const r2 = await chamar(api('checkout'), { body: { itens: [{ id: A.id, qtd: 1 }], freteId: 'retirada', cliente } });
  const t2 = new URL(r2.json.url, 'http://x').searchParams.get('t');
  assert.equal((await chamar(api('demo-pagar'), { body: { codigo: r2.json.codigo, t: t2, resultado: 'recusado' } })).json.status, 'recusado');
});

test('produção: demo é bloqueado (falha fechado)', async () => {
  process.env.MODO = 'producao';
  assert.equal((await chamar(api('frete'), { body: { cep: '20040020', itens: [{ id: A.id, qtd: 1 }] } })).status, 503);
  assert.equal((await chamar(api('checkout'), { body: { itens: [{ id: A.id, qtd: 1 }], freteId: 'retirada', cliente } })).status, 503);
  assert.equal((await chamar(api('demo-pagar'), { body: {} })).status, 404);
  assert.equal((await chamar(api('saude'), { method: 'GET', url: '/api/saude' })).json.modo, 'producao');
});

test('saúde: só mostra detalhes com a chave', async () => {
  process.env.SAUDE_KEY = 'chave-secreta-123';
  assert.equal((await chamar(api('saude'), { method: 'GET', url: '/api/saude?key=errada' })).json.pendencias, undefined);
  const d = (await chamar(api('saude'), { method: 'GET', url: '/api/saude?key=chave-secreta-123' })).json;
  assert.ok(Array.isArray(d.pendencias) && d.pendencias.length > 0); assert.equal(d.provedores.frete, 'demo');
  assert.ok(!JSON.stringify(d).includes('chave-secreta-123'));
});

test('SuperFrete: monta a cotação e filtra opções com erro', async () => {
  Object.assign(process.env, { FRETE_PROVIDER: 'superfrete', SUPERFRETE_TOKEN: 'tk', ORIGEM_CEP: '01001-000' });
  await comFetch(() => resp([{ id: 1, name: 'PAC', price: 31.2, delivery_range: { min: 4, max: 7 }, company: { name: 'Correios' } }, { id: 2, name: 'SEDEX', has_error: true }, { id: 17, name: 'Mini', price: 18.9, delivery_time: 6, company: { name: 'Correios' } }]), async chamadas => {
    const r = await chamar(api('frete'), { body: { cep: '20040020', itens: [{ id: A.id, qtd: 2 }] } });
    assert.equal(r.status, 200); assert.equal(r.json.demo, false);
    assert.deepEqual(r.json.opcoes.filter(o => o.id !== 'retirada').map(o => [o.id, o.precoCent]), [['mini', 1890], ['pac', 3120]]);
    const c = chamadas[0]; assert.match(c.u, /api\.superfrete\.com\/api\/v0\/calculator$/); assert.equal(c.o.headers.Authorization, 'Bearer tk');
    assert.equal(c.body.from.postal_code, '01001000'); assert.equal(c.body.to.postal_code, '20040020'); assert.equal(c.body.products[0].quantity, 2);
    assert.ok(c.body.products[0].length > 0 && c.body.products[0].weight > 0);
  });
});

test('Mercado Pago: cria preferência segura e confirma pelo webhook assinado', async () => {
  Object.assign(process.env, { PAGAMENTO_PROVIDER: 'mercadopago', MERCADOPAGO_ACCESS_TOKEN: 'APP_USR-x', MERCADOPAGO_WEBHOOK_SECRET: 'segredo-mp', SITE_URL: 'https://loja.test' });
  let codigo, total;
  await comFetch(() => resp({ id: 'pref1', init_point: 'https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=pref1' }), async chamadas => {
    const r = await chamar(api('checkout'), { body: { itens: [{ id: A.id, qtd: 2 }], freteId: 'pac', cliente, endereco } });
    assert.equal(r.status, 200); assert.match(r.json.url, /^https:\/\/www\.mercadopago\.com\.br\//);
    codigo = r.json.codigo; total = r.json.totalCent;
    const pref = chamadas.find(c => c.u.endsWith('/checkout/preferences')).body;
    assert.equal(pref.external_reference, codigo); assert.equal(pref.items[0].unit_price, A.precoCent * 1 / 100); assert.equal(pref.items.at(-1).id, 'frete');
    assert.deepEqual(pref.payment_methods.excluded_payment_types.map(x => x.id).sort(), ['account_money', 'debit_card', 'prepaid_card', 'ticket']);
    assert.match(pref.back_urls.success, /^https:\/\/loja\.test\/sucesso\/\?pedido=ARP-.+&t=/);
  });
  const assinar = (seg, id) => { const ts = '1700000000', rid = 'rq1'; return { 'x-signature': `ts=${ts},v1=${crypto.createHmac('sha256', seg).update(`id:${id};request-id:${rid};ts:${ts};`).digest('hex')}`, 'x-request-id': rid }; };
  const aviso = { type: 'payment', data: { id: '777001' } }, url = '/api/webhook-mercadopago?data.id=777001&type=payment';
  assert.equal((await chamar(api('webhook-mercadopago'), { url, body: aviso, headers: assinar('outro', '777001') })).status, 401);
  // valor menor que o total -> NÃO confirma
  await comFetch(() => resp({ id: 777001, status: 'approved', external_reference: codigo, payment_type_id: 'bank_transfer', transaction_amount: 1 }), async () => {
    const log = capturarLog(); try { assert.equal((await chamar(api('webhook-mercadopago'), { url, body: aviso, headers: assinar('segredo-mp', '777001') })).status, 200); } finally { log.parar(); }
    assert.equal((await P.obter(codigo)).status, 'aguardando');
  });
  await comFetch(() => resp({ id: 777001, status: 'approved', external_reference: codigo, payment_type_id: 'bank_transfer', transaction_amount: total / 100 }), async () => {
    const log = capturarLog(); try { for (let i = 0; i < 2; i++) await chamar(api('webhook-mercadopago'), { url, body: aviso, headers: assinar('segredo-mp', '777001') }); } finally { log.parar(); }
    assert.equal((await P.obter(codigo)).status, 'pago');
    assert.equal(log.linhas.filter(x => x.includes('PEDIDO PAGO')).length, 1);     // reenvio do webhook não duplica aviso
  });
});

test('http: origem diferente é barrada e há limite de requisições', async () => {
  const r = await chamar(api('frete'), { headers: { origin: 'https://site-malicioso.com' }, body: { cep: '20040020', itens: [{ id: A.id, qtd: 1 }] } });
  assert.equal(r.status, 403);
  const req = { headers: { 'x-forwarded-for': '9.9.9.9' } }, { handler } = require('../lib/http');
  const h = handler({ metodos: ['GET'], limite: [3, 60], rota: 'teste' }, async (rq, rs) => { rs.statusCode = 200; rs.end('{}'); });
  const out = []; for (let i = 0; i < 5; i++) out.push((await chamar(h, { method: 'GET', headers: req.headers })).status);
  assert.deepEqual(out, [200, 200, 200, 429, 429]);
});
