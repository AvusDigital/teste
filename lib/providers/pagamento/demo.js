'use strict';
// Pagamento SIMULADO: leva a uma página que deixa escolher "aprovado / pendente / recusado".
// Usa exatamente o mesmo caminho (confirmarPagamento) que o webhook real usa. Desligado em produção.
const { tokenDe } = require('../../pedido');
async function criar({ pedido }) {
  return { url: `/pagamento-demo/?pedido=${pedido.codigo}&t=${tokenDe(pedido.codigo)}` };
}
module.exports = { criar };
