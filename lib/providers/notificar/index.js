'use strict';
// Avisa a loja. Nunca derruba o fluxo: se o aviso falhar, só registra no log.
const { cfg } = require('../../config');
async function notificar(texto) {
  const c = cfg();
  try {
    if (c.notificar === 'telegram' && c.telegram.token && c.telegram.chat) {
      const r = await fetch(`https://api.telegram.org/bot${c.telegram.token}/sendMessage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(6000),
        body: JSON.stringify({ chat_id: c.telegram.chat, text: texto, disable_web_page_preview: true })
      });
      if (!r.ok) console.error('[notificar] telegram respondeu', r.status);
      return;
    }
    console.log('[notificar]\n' + texto);
  } catch (e) { console.error('[notificar] falhou:', e.message); }
}
module.exports = { notificar };
