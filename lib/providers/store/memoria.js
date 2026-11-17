'use strict';
// Só para demo e testes: some quando o processo reinicia (e não é compartilhado entre instâncias serverless).
const mem = new Map();
const vivo = k => { const x = mem.get(k); if (!x) return null; if (x.exp && x.exp < Date.now()) { mem.delete(k); return null; } return x; };
module.exports = () => ({
  nome: 'memoria',
  async get(k) { const x = vivo(k); return x ? x.v : null; },
  async set(k, v, ttl) { mem.set(k, { v: String(v), exp: ttl ? Date.now() + ttl * 1000 : 0 }); },
  async setNX(k, v, ttl) { if (vivo(k)) return false; mem.set(k, { v: String(v), exp: ttl ? Date.now() + ttl * 1000 : 0 }); return true; },
  async incr(k, ttl) { const x = vivo(k); const n = (x ? Number(x.v) : 0) + 1; mem.set(k, { v: String(n), exp: x ? x.exp : (ttl ? Date.now() + ttl * 1000 : 0) }); return n; },
  async incrBy(k, n) { const x = vivo(k); const v = (x ? Number(x.v) : 0) + n; mem.set(k, { v: String(v), exp: x ? x.exp : 0 }); return v; },
  async del(k) { mem.delete(k); },
  _limpar() { mem.clear(); }
});
