'use strict';
// Mercado Pago — Checkout Pro. Credenciais: mercadopago.com.br/developers/panel/app > sua aplicação.
// Token TEST-... para testar, APP_USR-... para vender. Webhook: /api/webhook-mercadopago (evento "Pagamentos").
const { HttpError } = require('../../http');
const { tokenDe } = require('../../pedido');

const TIPOS = { credit_card: 'credit_card', debit_card: 'debit_card', pix: 'bank_transfer', boleto: 'ticket', saldo: 'account_money' };
const reais = cent => +(cent / 100).toFixed(2);

async function mp(c, caminho, init = {}) {
  const r = await fetch('https://api.mercadopago.com' + caminho, {
    ...init, signal: AbortSignal.timeout(9000),
    headers: { Authorization: `Bearer ${c.mp.token}`, 'Content-Type': 'application/json', 'User-Agent': 'arpint-loja/1.0', ...(init.headers || {}) }
  });
  return { r, j: await r.json().catch(() => null) };
}

async function criar({ pedido, c }) {
  if (!c.mp.token || !c.siteUrl) throw new HttpError(503, 'Pagamento indisponível no momento.');
  const itens = pedido.itens.map(i => ({ id: String(i.id), title: i.nome.slice(0, 250), quantity: i.qtd, unit_price: reais(i.precoCent), currency_id: 'BRL' }));
  if (pedido.frete.precoCent > 0) itens.push({ id: 'frete', title: `Frete ${pedido.frete.nome}`.slice(0, 250), quantity: 1, unit_price: reais(pedido.frete.precoCent), currency_id: 'BRL' });
  const excluidos = Object.entries(TIPOS).filter(([k]) => !c.mp.metodos.includes(k)).map(([, id]) => ({ id })).concat({ id: 'prepaid_card' });
  const [nome, ...resto] = pedido.cliente.nome.split(' '), e = pedido.endereco;
  const volta = `${c.siteUrl}/sucesso/?pedido=${pedido.codigo}&t=${tokenDe(pedido.codigo)}`;
  const body = {
    items: itens, external_reference: pedido.codigo, auto_return: 'approved', statement_descriptor: 'ARPINT',
    back_urls: { success: volta, pending: volta, failure: `${c.siteUrl}/checkout/?pagamento=falhou` },
    notification_url: `${c.siteUrl}/api/webhook-mercadopago?source_news=webhooks`,
    payment_methods: { excluded_payment_types: excluidos, installments: c.mp.parcelas },
    payer: { name: nome, surname: resto.join(' '), email: pedido.cliente.email,
      phone: { area_code: pedido.cliente.fone.slice(0, 2), number: pedido.cliente.fone.slice(2) },
      identification: { type: pedido.cliente.tipoDoc, number: pedido.cliente.doc },
      ...(e ? { address: { zip_code: e.cep, street_name: e.rua, ...(/^\d{1,9}$/.test(e.numero) ? { street_number: Number(e.numero) } : {}) } } : {}) },
    metadata: { loja: 'arpint', frete: pedido.frete.nome, retirada: pedido.retirada }
  };
  let r, j;
  try { ({ r, j } = await mp(c, '/checkout/preferences', { method: 'POST', body: JSON.stringify(body), headers: { 'X-Idempotency-Key': pedido.codigo } })); }
  catch (e2) { console.error('[pagamento] Mercado Pago fora do ar:', e2.name); throw new HttpError(502, 'Não conseguimos iniciar o pagamento agora. Tente de novo em instantes.'); }
  const url = c.mp.token.startsWith('TEST-') ? (j?.sandbox_init_point || j?.init_point) : j?.init_point;
  if (!r.ok || !url) { console.error('[pagamento] Mercado Pago respondeu', r.status, JSON.stringify(j)?.slice(0, 500)); throw new HttpError(502, 'Não conseguimos iniciar o pagamento agora. Tente de novo ou fale com a gente no WhatsApp.'); }
  return { url };
}

async function consultarPagamento(c, id) {
  const { r, j } = await mp(c, `/v1/payments/${encodeURIComponent(id)}`);
  if (!r.ok || !j) throw new HttpError(502, 'Falha ao consultar o pagamento.');
  return j;
}

module.exports = { criar, consultarPagamento };
