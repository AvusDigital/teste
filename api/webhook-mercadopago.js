'use strict';
// Webhook do Mercado Pago. Cadastre em Suas integrações > Webhooks: https://SEU-SITE/api/webhook-mercadopago (evento "Pagamentos")
// e copie a chave secreta para MERCADOPAGO_WEBHOOK_SECRET. Segurança em 2 camadas: assinatura HMAC (x-signature) e
// consulta do pagamento direto na API do Mercado Pago (o corpo do aviso nunca é confiado).
const crypto = require('crypto');
const { handler, send, lerJson, HttpError, igualSeguro } = require('../lib/http');
const { consultarPagamento } = require('../lib/providers/pagamento/mercadopago');
const P = require('../lib/pedido');
const { notificar } = require('../lib/providers/notificar');
const { brl } = require('../lib/util');

function assinaturaOk(req, dataId, segredo) {
  const partes = Object.fromEntries(String(req.headers['x-signature'] || '').split(',').map(p => p.trim().split('=').map(x => x.trim())).filter(p => p.length === 2));
  if (!partes.ts || !partes.v1) return false;
  let manifesto = '';
  if (dataId) manifesto += `id:${String(dataId).toLowerCase()};`;
  if (req.headers['x-request-id']) manifesto += `request-id:${req.headers['x-request-id']};`;
  manifesto += `ts:${partes.ts};`;
  return igualSeguro(partes.v1, crypto.createHmac('sha256', segredo).update(manifesto).digest('hex'));
}

module.exports = handler({ metodos: ['POST'], limite: [300, 60], rota: 'webhook-mp' }, async (req, res, { c, url }) => {
  if (c.pagamento !== 'mercadopago') throw new HttpError(404, 'Não encontrado.');
  const ev = await lerJson(req).catch(() => ({}));
  const tipo = String(ev?.type || url.searchParams.get('type') || url.searchParams.get('topic') || '');
  const id = String(ev?.data?.id || url.searchParams.get('data.id') || url.searchParams.get('id') || '');
  if (c.mp.webhookSecret) { if (!assinaturaOk(req, url.searchParams.get('data.id') || ev?.data?.id, c.mp.webhookSecret)) throw new HttpError(401, 'Não autorizado.'); }
  else if (c.modo === 'producao') throw new HttpError(503, 'Webhook sem chave secreta configurada.');

  if (tipo === 'payment' && /^\d{3,20}$/.test(id)) {
    const pg = await consultarPagamento(c, id);                      // erro 5xx aqui = o Mercado Pago tenta de novo
    const codigo = String(pg.external_reference || '');
    if (/^ARP-[0-9A-F]{10}$/.test(codigo)) {
      if (pg.status === 'approved') await P.confirmarPagamento(codigo, { id: pg.id, metodo: pg.payment_type_id, valorCent: Math.round(Number(pg.transaction_amount) * 100) });
      else if (pg.status === 'rejected' || pg.status === 'cancelled') await P.marcar(codigo, 'recusado');
      else if (pg.status === 'refunded' || pg.status === 'charged_back') await notificar(`⚠️ Pagamento ${pg.id} do pedido ${codigo} foi ${pg.status} (${brl(Math.round(Number(pg.transaction_amount) * 100))}). Verifique no painel.`);
    }
    console.log('[webhook-mp]', id, pg.status, codigo);
  }
  send(res, 200, { ok: true });
});
