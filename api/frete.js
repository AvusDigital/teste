'use strict';
// POST /api/frete { cep, itens:[{id,qtd}] } -> opções de entrega (preço e prazo vêm do servidor).
const { handler, send, lerJson, HttpError } = require('../lib/http');
const { precificar } = require('../lib/pedido');
const { cotar } = require('../lib/providers/frete');
const { soDigitos } = require('../lib/util');

module.exports = handler({ metodos: ['POST'], limite: [30, 60], rota: 'frete' }, async (req, res, { c }) => {
  const b = await lerJson(req);
  const cep = soDigitos(b.cep);
  if (cep.length !== 8) throw new HttpError(400, 'CEP inválido.');
  const { linhas, subtotalCent } = await precificar(b.itens);
  const r = await cotar({ cep, linhas, subtotalCent });
  const opcoes = r.opcoes.sort((a, b2) => a.precoCent - b2.precoCent);
  if (c.loja.retirada.ativa) opcoes.push({ id: 'retirada', nome: 'Retirada na loja', precoCent: 0, prazoMin: 0, prazoMax: 0, endereco: c.loja.retirada.endereco, horario: c.loja.retirada.horario });
  if (!opcoes.length) throw new HttpError(404, 'Não encontramos entrega para esse CEP. Fale com a gente no WhatsApp.');
  send(res, 200, { demo: !!r.demo, subtotalCent, opcoes });
});
