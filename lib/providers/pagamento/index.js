'use strict';
const { cfg } = require('../../config');
const { HttpError } = require('../../http');

// criar({ pedido }) -> { url }   (URL para onde o cliente é enviado para pagar)
async function criar(args) {
  const c = cfg();
  if (c.modo === 'producao' && c.pagamento === 'demo') throw new HttpError(503, 'Pagamento indisponível no momento.');
  if (c.pagamento === 'mercadopago') return require('./mercadopago').criar({ ...args, c });
  if (c.pagamento === 'demo') return require('./demo').criar({ ...args, c });
  throw new HttpError(500, 'PAGAMENTO_PROVIDER inválido.');
}
module.exports = { criar };
