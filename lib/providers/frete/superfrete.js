'use strict';
// SuperFrete (cotação). Docs: https://docs.superfrete.com — token em Integrações > Desenvolvedores.
// Serviços: 1 = PAC, 2 = SEDEX, 17 = Mini Envios. Sandbox: SUPERFRETE_SANDBOX=1.
const { HttpError } = require('../../http');
const NOMES = { 1: ['pac', 'PAC'], 2: ['sedex', 'SEDEX'], 17: ['mini', 'Mini Envios'] };

async function cotar({ cep, volumes, subtotalCent, c }) {
  if (!c.superfrete.token || c.cepOrigem.length !== 8) throw new HttpError(503, 'Frete indisponível no momento.');
  const base = c.superfrete.sandbox ? 'https://sandbox.superfrete.com' : 'https://api.superfrete.com';
  let r, j;
  try {
    r = await fetch(`${base}/api/v0/calculator`, {
      method: 'POST', signal: AbortSignal.timeout(9000),
      headers: { Authorization: `Bearer ${c.superfrete.token}`, 'Content-Type': 'application/json', Accept: 'application/json', 'User-Agent': `Arpint (${c.superfrete.contato})` },
      body: JSON.stringify({
        from: { postal_code: c.cepOrigem }, to: { postal_code: cep }, services: '1,2,17',
        options: { own_hand: false, receipt: false, insurance_value: +(subtotalCent / 100).toFixed(2), use_insurance_value: true },
        products: volumes.map(v => ({ quantity: v.quantity, weight: v.weight, length: v.length, width: v.width, height: v.height }))
      })
    });
    j = await r.json().catch(() => null);
  } catch (e) { console.error('[frete] SuperFrete fora do ar:', e.name); throw new HttpError(502, 'Não conseguimos calcular o frete agora. Tente de novo ou fale com a gente no WhatsApp.'); }
  if (!r.ok || !Array.isArray(j)) { console.error('[frete] SuperFrete respondeu', r.status, JSON.stringify(j)?.slice(0, 300)); throw new HttpError(502, 'Não conseguimos calcular o frete agora. Tente de novo ou fale com a gente no WhatsApp.'); }
  const opcoes = j.filter(o => o && !o.has_error && NOMES[o.id] && Number(o.price) > 0).map(o => {
    const rng = o.delivery_range || {};
    return { id: NOMES[o.id][0], nome: `${o.company?.name || 'Correios'} ${NOMES[o.id][1]}`, precoCent: Math.round(Number(o.price) * 100),
             prazoMin: Number(rng.min) || Number(o.delivery_time) || 0, prazoMax: Number(rng.max) || Number(o.delivery_time) || 0 };
  });
  return { demo: false, opcoes };
}
module.exports = { cotar };
