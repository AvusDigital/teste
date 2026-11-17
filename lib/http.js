'use strict';
const crypto = require('crypto');
const { cfg } = require('./config');
const { getStore } = require('./providers/store');

class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }

function send(res, status, obj) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(JSON.stringify(obj));
}

async function lerJson(req, limite = 32_768) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body || '{}'); } catch { throw new HttpError(400, 'JSON inválido.'); } }
  const partes = []; let total = 0;
  for await (const p of req) { total += p.length; if (total > limite) throw new HttpError(413, 'Requisição grande demais.'); partes.push(p); }
  if (!partes.length) return {};
  try { return JSON.parse(Buffer.concat(partes).toString('utf8')); } catch { throw new HttpError(400, 'JSON inválido.'); }
}

const ip = req => String(req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'x').split(',')[0].trim();

// Limite de requisições por IP+rota. Usa o store (Upstash em produção = vale entre instâncias).
async function limitar(req, rota, max, janelaSeg) {
  const chave = 'rl:' + rota + ':' + crypto.createHash('sha1').update(ip(req)).digest('hex').slice(0, 16);
  const n = await getStore().incr(chave, janelaSeg);
  if (n > max) throw new HttpError(429, 'Muitas tentativas. Aguarde um instante e tente de novo.');
}

// handler({ metodos:['POST'], limite:[30, 60] }, async (req, res, ctx) => ...)
function handler(opts, fn) {
  return async (req, res) => {
    try {
      if (!opts.metodos.includes(req.method)) { res.setHeader('Allow', opts.metodos.join(', ')); throw new HttpError(405, 'Método não permitido.'); }
      if (req.method === 'POST') {
        const origem = req.headers.origin;
        const host = req.headers['x-forwarded-host'] || req.headers.host;
        if (origem && host && new URL(origem).host !== host) throw new HttpError(403, 'Origem não permitida.');
      }
      if (opts.limite) await limitar(req, opts.rota || req.url.split('?')[0], opts.limite[0], opts.limite[1]);
      await fn(req, res, { c: cfg(), url: new URL(req.url, 'http://x') });
    } catch (err) {
      if (err instanceof HttpError) return send(res, err.status, { erro: err.message });
      console.error('[api] erro inesperado:', err && err.stack || err);
      send(res, 500, { erro: 'Algo deu errado do nosso lado. Tente de novo em instantes.' });
    }
  };
}

const igualSeguro = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };

module.exports = { HttpError, send, lerJson, handler, igualSeguro, ip };
