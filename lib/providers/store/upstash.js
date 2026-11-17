'use strict';
// Upstash Redis via REST (só fetch). Crie um banco grátis em upstash.com (ou "Storage" na Vercel) e copie
// UPSTASH_REDIS_REST_URL e UPSTASH_REDIS_REST_TOKEN.
module.exports = ({ url, token }) => {
  async function cmd(...args) {
    const r = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(args.map(String)), signal: AbortSignal.timeout(6000) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.error) throw new Error('Upstash: ' + (j.error || r.status));
    return j.result;
  }
  return {
    nome: 'upstash',
    get: k => cmd('GET', k),
    set: (k, v, ttl) => ttl ? cmd('SET', k, v, 'EX', ttl) : cmd('SET', k, v),
    async setNX(k, v, ttl) { return (ttl ? await cmd('SET', k, v, 'NX', 'EX', ttl) : await cmd('SET', k, v, 'NX')) === 'OK'; },
    async incr(k, ttl) { const n = await cmd('INCR', k); if (n === 1 && ttl) await cmd('EXPIRE', k, ttl); return Number(n); },
    async incrBy(k, n) { return Number(await cmd('INCRBY', k, n)); },
    async del(k) { await cmd('DEL', k); }
  };
};
