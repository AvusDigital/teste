'use strict';
// Catálogo do servidor: gerado pelo build a partir de data/produtos.csv (ou da planilha). Não edite o .json.
const dados = require('./catalogo.generated.json');
const lista = dados.produtos;
const porId = new Map(lista.map(p => [p.id, p]));
module.exports = { lista, porId, geradoEm: dados.geradoEm };
