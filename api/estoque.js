'use strict';
// GET /api/estoque?ids=3,4,5 -> { "3": 12, "4": null }   (null = sem controle de estoque)
const { handler, send } = require('../lib/http');
const catalogo = require('../lib/catalogo');
const { disponivel } = require('../lib/pedido');
module.exports = handler({ metodos: ['GET'], limite: [120, 60], rota: 'estoque' }, async (req, res, { url }) => {
  const ids = String(url.searchParams.get('ids') || '').split(',').map(Number).filter(Number.isInteger).slice(0, 40);
  const out = {};
  for (const id of ids) { const p = catalogo.porId.get(id); if (p) { const d = await disponivel(p); out[id] = Number.isFinite(d) ? d : null; } }
  send(res, 200, out);
});
