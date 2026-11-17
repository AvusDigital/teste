'use strict';
// Regras de negócio do pedido. Tudo que importa (preço, frete, estoque, total) é decidido AQUI, no servidor.
const crypto = require('crypto');
const { cfg } = require('./config');
const catalogo = require('./catalogo');
const { getStore } = require('./providers/store');
const { notificar } = require('./providers/notificar');
const { HttpError } = require('./http');
const { limpa, soDigitos, cpfValido, cnpjValido, UFS, brl } = require('./util');

const TTL_PEDIDO = 60 * 60 * 24 * 180;     // 180 dias no store

// ---------- carrinho ----------
async function disponivel(p) {
  if (p.estoque == null) return Infinity;                                       // sem controle de estoque
  const vendidos = Number(await getStore().get(`vendidos:${p.id}:${p.estoque}`)) || 0;   // zera quando o número da planilha muda (nova contagem)
  return Math.max(0, p.estoque - vendidos);
}

async function precificar(itens) {
  if (!Array.isArray(itens) || !itens.length) throw new HttpError(400, 'Seu carrinho está vazio.');
  if (itens.length > 40) throw new HttpError(400, 'Carrinho grande demais.');
  const soma = new Map();
  for (const it of itens) {
    const id = Number(it?.id), qtd = Number(it?.qtd);
    if (!Number.isInteger(id) || !Number.isInteger(qtd) || qtd < 1 || qtd > 99) throw new HttpError(400, 'Item inválido no carrinho.');
    soma.set(id, Math.min(99, (soma.get(id) || 0) + qtd));
  }
  const linhas = [];
  for (const [id, qtd] of soma) {
    const p = catalogo.porId.get(id);
    if (!p || !p.ativo) throw new HttpError(409, 'Um item do carrinho não está mais disponível. Atualize o carrinho.');
    if (p.precoCent == null) throw new HttpError(409, `${p.nome} é vendido sob consulta. Fale com a gente no WhatsApp.`);
    const disp = await disponivel(p);
    if (qtd > disp) throw new HttpError(409, disp === 0 ? `${p.nome} está esgotado.` : `Só temos ${disp} unidade(s) de ${p.nome}.`);
    linhas.push({ produto: p, qtd, precoCent: p.precoCent, subtotalCent: p.precoCent * qtd });
  }
  return { linhas, subtotalCent: linhas.reduce((s, l) => s + l.subtotalCent, 0) };
}

// ---------- cliente ----------
function validarCliente(cli, endereco, retirada) {
  const erro = m => { throw new HttpError(400, m); };
  const nome = limpa(cli?.nome, 80), email = limpa(cli?.email, 120).toLowerCase(), fone = soDigitos(cli?.fone).replace(/^55(?=\d{10,11}$)/, '');
  const doc = soDigitos(cli?.doc);
  if (nome.split(' ').length < 2) erro('Informe nome e sobrenome.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) erro('E-mail inválido.');
  if (!/^[1-9]\d9?\d{8}$/.test(fone)) erro('Telefone inválido. Use DDD + número.');
  const tipoDoc = doc.length === 14 ? 'CNPJ' : 'CPF';
  if (tipoDoc === 'CPF' ? !cpfValido(doc) : !cnpjValido(doc)) erro('CPF ou CNPJ inválido.');
  let end = null;
  if (!retirada) {
    const e = endereco || {};
    end = { cep: soDigitos(e.cep), rua: limpa(e.rua, 100), numero: limpa(e.numero, 12), complemento: limpa(e.complemento, 60),
            bairro: limpa(e.bairro, 60), cidade: limpa(e.cidade, 60), uf: limpa(e.uf, 2).toUpperCase() };
    if (end.cep.length !== 8) erro('CEP inválido.');
    if (!end.rua || !end.numero || !end.bairro || !end.cidade) erro('Preencha rua, número, bairro e cidade.');
    if (!UFS.includes(end.uf)) erro('UF inválida.');
  }
  return { cliente: { nome, email, fone, tipoDoc, doc }, endereco: end };
}

// ---------- pedido ----------
const novoCodigo = () => 'ARP-' + crypto.randomBytes(5).toString('hex').toUpperCase();     // 40 bits, não sequencial
const tokenDe = codigo => crypto.createHmac('sha256', cfg().segredo).update(codigo).digest('base64url').slice(0, 22);

async function salvar(p) { await getStore().set('pedido:' + p.codigo, JSON.stringify(p), TTL_PEDIDO); }
async function obter(codigo) { const j = await getStore().get('pedido:' + codigo); return j ? JSON.parse(j) : null; }

async function criar({ linhas, subtotalCent, frete, cliente, endereco, retirada }) {
  const pedido = {
    codigo: novoCodigo(), status: 'aguardando', criadoEm: new Date().toISOString(),
    itens: linhas.map(l => ({ id: l.produto.id, nome: l.produto.nome, qtd: l.qtd, precoCent: l.precoCent })),
    subtotalCent, frete, retirada, totalCent: subtotalCent + frete.precoCent, cliente, endereco, pagamento: null
  };
  await salvar(pedido);
  return pedido;
}

// Resumo público (sem dados pessoais além do que o próprio cliente digitou).
const publico = p => ({ codigo: p.codigo, status: p.status, totalCent: p.totalCent, subtotalCent: p.subtotalCent, frete: p.frete, retirada: p.retirada,
  itens: p.itens.map(i => ({ nome: i.nome, qtd: i.qtd, precoCent: i.precoCent })) });

function resumoTexto(p, titulo) {
  const linhas = p.itens.map(i => `• ${i.qtd}x ${i.nome} — ${brl(i.precoCent * i.qtd)}`).join('\n');
  const e = p.endereco;
  const entrega = p.retirada ? 'RETIRADA NA LOJA' : `${p.frete.nome} (${p.frete.precoCent ? brl(p.frete.precoCent) : 'grátis'})\n${e.rua}, ${e.numero}${e.complemento ? ' ' + e.complemento : ''} - ${e.bairro}, ${e.cidade}/${e.uf} - CEP ${e.cep}`;
  return `${titulo}\nPedido ${p.codigo}\nTotal ${brl(p.totalCent)}${p.pagamento ? ' (' + p.pagamento.metodo + ')' : ''}\n\n${linhas}\n\n${entrega}\n\n${p.cliente.nome}\n${p.cliente.tipoDoc} ${p.cliente.doc}\n${p.cliente.email}\nWhatsApp ${p.cliente.fone}`;
}

// Chamada quando o pagamento foi APROVADO (webhook ou demo). Idempotente: o mesmo aviso 2x não baixa estoque nem notifica 2x.
async function confirmarPagamento(codigo, { id, metodo, valorCent }) {
  const st = getStore(), pedido = await obter(codigo);
  if (!pedido) return { ok: false, motivo: 'pedido-desconhecido' };
  if (valorCent != null && valorCent < pedido.totalCent) {
    await notificar(`ATENÇÃO: pagamento ${id} do pedido ${codigo} tem valor MENOR (${brl(valorCent)}) que o total (${brl(pedido.totalCent)}). Não confirmado.`);
    return { ok: false, motivo: 'valor-menor' };
  }
  if (!(await st.setNX('pago:' + codigo, '1', TTL_PEDIDO))) return { ok: true, ja: true };
  try {
    pedido.status = 'pago'; pedido.pagamento = { id: String(id), metodo: metodo || '', em: new Date().toISOString() };
    await salvar(pedido);
    for (const i of pedido.itens) {
      const p = catalogo.porId.get(i.id);
      if (p && p.estoque != null) {
        const vendidos = await st.incrBy(`vendidos:${p.id}:${p.estoque}`, i.qtd);
        if (vendidos > p.estoque) await notificar(`ESTOQUE NEGATIVO: ${p.nome} vendeu ${vendidos} com estoque ${p.estoque}. Verifique.`);
      }
    }
    await notificar(resumoTexto(pedido, '✅ PEDIDO PAGO'));
  } catch (e) { await st.del('pago:' + codigo).catch(() => {}); throw e; }     // libera para o provedor tentar de novo
  return { ok: true, ja: false };
}

async function marcar(codigo, status) {
  const p = await obter(codigo); if (!p || p.status === 'pago') return;
  p.status = status; await salvar(p);
}

module.exports = { precificar, disponivel, validarCliente, criar, obter, salvar, tokenDe, publico, confirmarPagamento, marcar, resumoTexto };
