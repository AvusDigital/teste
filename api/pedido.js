'use strict';
// GET /api/pedido?codigo=ARP-...&t=TOKEN -> status do pedido (o token só existe na URL que o cliente recebeu).
const { handler, send, HttpError, igualSeguro } = require('../lib/http');
const P = require('../lib/pedido');
module.exports = handler({ metodos: ['GET'], limite: [60, 60], rota: 'pedido' }, async (req, res, { url }) => {
  const codigo = String(url.searchParams.get('codigo') || ''), t = String(url.searchParams.get('t') || '');
  if (!/^ARP-[0-9A-F]{10}$/.test(codigo) || !igualSeguro(t, P.tokenDe(codigo))) throw new HttpError(404, 'Pedido não encontrado.');
  const p = await P.obter(codigo);
  if (!p) throw new HttpError(404, 'Pedido não encontrado.');
  send(res, 200, P.publico(p));
});
