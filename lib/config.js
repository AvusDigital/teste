'use strict';
// Toda a configuração vem de variáveis de ambiente. MODO=demo (padrão) deixa tudo simulado;
// MODO=producao EXIGE provedores reais e falha fechado se algo estiver faltando.
const loja = require('../data/loja.json');
const e = (k, d = '') => String(process.env[k] ?? d).trim();

function cfg() {
  const modo = e('MODO') === 'producao' ? 'producao' : 'demo';
  return {
    modo, loja,
    siteUrl: (e('SITE_URL') || loja.dominio || '').replace(/\/+$/, ''),
    segredo: e('SEGREDO_APP') || (modo === 'demo' ? 'segredo-somente-para-demo' : ''),
    frete: e('FRETE_PROVIDER', 'demo'),                      // demo | superfrete
    pagamento: e('PAGAMENTO_PROVIDER', 'demo'),              // demo | mercadopago
    store: e('STORE_PROVIDER') || (e('UPSTASH_REDIS_REST_URL') ? 'upstash' : 'memoria'),   // memoria | upstash
    notificar: e('NOTIFICAR_PROVIDER') || (e('TELEGRAM_BOT_TOKEN') ? 'telegram' : 'console'), // console | telegram
    cepOrigem: (e('ORIGEM_CEP') || loja.cepOrigem || '').replace(/\D/g, ''),
    caixaPadrao: (e('FRETE_CAIXA_PADRAO', '30x20x15').split('x').map(Number)),   // cm (c x l x a) quando o produto não tem medidas
    pesoPadraoG: Number(e('FRETE_PESO_PADRAO_G')) || 500,
    superfrete: { token: e('SUPERFRETE_TOKEN'), sandbox: e('SUPERFRETE_SANDBOX') === '1', contato: e('SUPERFRETE_CONTATO', 'contato@arpint.com.br') },
    mp: { token: e('MERCADOPAGO_ACCESS_TOKEN'), webhookSecret: e('MERCADOPAGO_WEBHOOK_SECRET'),
          metodos: e('MERCADOPAGO_METODOS', 'credit_card,pix').split(',').map(s => s.trim()).filter(Boolean),
          parcelas: Math.min(12, Math.max(1, Number(e('MERCADOPAGO_PARCELAS')) || 12)) },
    upstash: { url: e('UPSTASH_REDIS_REST_URL').replace(/\/+$/, ''), token: e('UPSTASH_REDIS_REST_TOKEN') },
    telegram: { token: e('TELEGRAM_BOT_TOKEN'), chat: e('TELEGRAM_CHAT_ID') },
    chaveSaude: e('SAUDE_KEY')
  };
}

// O que falta para vender de verdade? (lista vazia = pronto). Em modo demo, só avisa o que seria exigido.
function pendencias(c = cfg()) {
  const p = [];
  if (c.frete === 'demo') p.push('FRETE_PROVIDER ainda é "demo" (frete simulado)');
  if (c.frete === 'superfrete') {
    if (!c.superfrete.token) p.push('SUPERFRETE_TOKEN ausente');
    if (c.cepOrigem.length !== 8) p.push('ORIGEM_CEP (ou cepOrigem em data/loja.json) ausente ou inválido');
  }
  if (c.pagamento === 'demo') p.push('PAGAMENTO_PROVIDER ainda é "demo" (pagamento simulado)');
  if (c.pagamento === 'mercadopago') {
    if (!c.mp.token) p.push('MERCADOPAGO_ACCESS_TOKEN ausente');
    if (!c.mp.webhookSecret) p.push('MERCADOPAGO_WEBHOOK_SECRET ausente');
    if (!c.siteUrl.startsWith('https://')) p.push('SITE_URL precisa ser https://');
    if (c.mp.token.startsWith('TEST-')) p.push('MERCADOPAGO_ACCESS_TOKEN é de teste (TEST-)');
  }
  if (c.store === 'memoria') p.push('STORE_PROVIDER é "memoria": pedidos e estoque somem entre execuções (use Upstash)');
  if (c.store === 'upstash' && (!c.upstash.url || !c.upstash.token)) p.push('UPSTASH_REDIS_REST_URL/TOKEN ausentes');
  if (c.notificar === 'console') p.push('NOTIFICAR_PROVIDER é "console": ninguém será avisado de pedido pago (use Telegram)');
  if (c.notificar === 'telegram' && (!c.telegram.token || !c.telegram.chat)) p.push('TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID ausentes');
  if (c.segredo.length < 24) p.push('SEGREDO_APP ausente ou curto (mínimo 24 caracteres)');
  if (!c.loja.cnpj || !c.loja.razaoSocial || !c.loja.endereco) p.push('data/loja.json sem razaoSocial/cnpj/endereco (exigido pelo decreto do e-commerce)');
  return p;
}

// Em produção a loja só vende se NÃO houver pendências.
const vendaLiberada = (c = cfg()) => c.modo === 'demo' || pendencias(c).length === 0;

module.exports = { cfg, pendencias, vendaLiberada };
