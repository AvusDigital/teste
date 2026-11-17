'use strict';
// POST /api/checkout -> recalcula tudo, cria o pedido e devolve a URL de pagamento.
const { handler, send, lerJson, HttpError } = require('../lib/http');
const { vendaLiberada } = require('../lib/config');
const P = require('../lib/pedido');
const { cotar } = require('../lib/providers/frete');
const { criar: criarPagamento } = require('../lib/providers/pagamento');

module.exports = handler({ metodos: ['POST'], limite: [8, 60], rota: 'checkout' }, async (req, res, { c }) => {
  if (!vendaLiberada(c)) throw new HttpError(503, 'Os pedidos online estão pausados. Fale com a gente no WhatsApp.');
  const b = await lerJson(req);
  const { linhas, subtotalCent } = await P.precificar(b.itens);
  const retirada = b.freteId === 'retirada';
  if (retirada && !c.loja.retirada.ativa) throw new HttpError(400, 'Retirada indisponível.');
  const { cliente, endereco } = P.validarCliente(b.cliente, b.endereco, retirada);

  let frete;
  if (retirada) frete = { id: 'retirada', nome: 'Retirada na loja', precoCent: 0, prazoMin: 0, prazoMax: 0 };
  else {
    const r = await cotar({ cep: endereco.cep, linhas, subtotalCent });
    const o = r.opcoes.find(x => x.id === String(b.freteId));
    if (!o) throw new HttpError(409, 'A opção de frete escolhida não está mais disponível. Escolha de novo.');
    frete = { id: o.id, nome: o.nome, precoCent: o.precoCent, prazoMin: o.prazoMin, prazoMax: o.prazoMax };
  }

  const pedido = await P.criar({ linhas, subtotalCent, frete, cliente, endereco, retirada });
  const { url } = await criarPagamento({ pedido });
  console.log(`[checkout] ${pedido.codigo} total=${pedido.totalCent} frete=${frete.id}`);
  send(res, 200, { codigo: pedido.codigo, url, totalCent: pedido.totalCent });
});
