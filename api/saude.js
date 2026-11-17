'use strict';
// GET /api/saude            -> { ok, modo }
// GET /api/saude?key=SAUDE_KEY -> o que falta configurar para vender de verdade (nunca mostra segredos).
const { handler, send, igualSeguro } = require('../lib/http');
const { pendencias, vendaLiberada } = require('../lib/config');
const catalogo = require('../lib/catalogo');
module.exports = handler({ metodos: ['GET'], limite: [30, 60], rota: 'saude' }, async (req, res, { c, url }) => {
  const base = { ok: true, modo: c.modo };
  const k = String(url.searchParams.get('key') || '');
  if (!c.chaveSaude || !k || !igualSeguro(k, c.chaveSaude)) return send(res, 200, base);
  send(res, 200, { ...base, vendaLiberada: vendaLiberada(c), provedores: { frete: c.frete, pagamento: c.pagamento, store: c.store, notificar: c.notificar },
    produtos: catalogo.lista.length, catalogoGeradoEm: catalogo.geradoEm, pendencias: pendencias(c) });
});
