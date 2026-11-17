'use strict';
// POST /api/demo-pagar { codigo, t, resultado } — só existe com PAGAMENTO_PROVIDER=demo e fora de produção.
const { handler, send, lerJson, HttpError, igualSeguro } = require('../lib/http');
const P = require('../lib/pedido');
module.exports = handler({ metodos: ['POST'], limite: [20, 60], rota: 'demo-pagar' }, async (req, res, { c }) => {
  if (c.pagamento !== 'demo' || c.modo === 'producao') throw new HttpError(404, 'Não encontrado.');
  const b = await lerJson(req), codigo = String(b.codigo || '');
  if (!/^ARP-[0-9A-F]{10}$/.test(codigo) || !igualSeguro(String(b.t || ''), P.tokenDe(codigo))) throw new HttpError(404, 'Pedido não encontrado.');
  const p = await P.obter(codigo); if (!p) throw new HttpError(404, 'Pedido não encontrado.');
  if (b.resultado === 'aprovado') await P.confirmarPagamento(codigo, { id: 'demo-' + Date.now(), metodo: 'demo' });
  else if (b.resultado === 'recusado') await P.marcar(codigo, 'recusado');
  else if (b.resultado !== 'pendente') throw new HttpError(400, 'Resultado inválido.');
  send(res, 200, { ok: true, status: (await P.obter(codigo)).status });
});
