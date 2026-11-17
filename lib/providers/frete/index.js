'use strict';
const { cfg } = require('../../config');
const { HttpError } = require('../../http');

// Volumes enviados ao cálculo. Produto sem medidas usa a caixa/peso padrão (FRETE_CAIXA_PADRAO, FRETE_PESO_PADRAO_G).
function volumes(linhas, c) {
  const [dc, dl, da] = c.caixaPadrao;
  return linhas.map(({ produto: p, qtd }) => ({
    quantity: qtd,
    weight: (p.pesoG || c.pesoPadraoG) / 1000,
    length: p.dim?.c || dc, width: p.dim?.l || dl, height: p.dim?.a || da
  }));
}

// cotar({ cep, linhas, subtotalCent }) -> { demo, opcoes:[{ id, nome, precoCent, prazoMin, prazoMax }] }
async function cotar(args) {
  const c = cfg();
  let mod;
  if (c.modo === 'producao' && c.frete === 'demo') throw new HttpError(503, 'Frete indisponível no momento.');
  if (c.frete === 'superfrete') mod = require('./superfrete');
  else if (c.frete === 'demo') mod = require('./demo');
  else throw new HttpError(500, 'FRETE_PROVIDER inválido.');
  return mod.cotar({ ...args, c, volumes: volumes(args.linhas, c) });
}

module.exports = { cotar, volumes };
