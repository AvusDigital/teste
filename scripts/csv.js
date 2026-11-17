'use strict';
// Leitor de CSV (RFC 4180) compartilhado pelo build e pelo script de imagens.
function parseCsv(txt) {
  txt = txt.replace(/^\uFEFF/, '');
  const sep = (txt.split('\n')[0].match(/;/g) || []).length > (txt.split('\n')[0].match(/,/g) || []).length ? ';' : ',';   // aceita ; (Excel pt-BR)
  const linhas = []; let campo = '', linha = [], q = false;
  for (let i = 0; i < txt.length; i++) {
    const ch = txt[i];
    if (q) { if (ch === '"') { if (txt[i + 1] === '"') { campo += '"'; i++; } else q = false; } else campo += ch; }
    else if (ch === '"') q = true;
    else if (ch === sep) { linha.push(campo); campo = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && txt[i + 1] === '\n') i++; linha.push(campo); campo = ''; if (linha.some(x => x.trim())) linhas.push(linha); linha = []; }
    else campo += ch;
  }
  if (campo || linha.length) { linha.push(campo); if (linha.some(x => x.trim())) linhas.push(linha); }
  const [cab, ...resto] = linhas, nomes = cab.map(h => h.trim().toLowerCase());
  return resto.map(l => Object.fromEntries(nomes.map((n, i) => [n, (l[i] ?? '').trim()])));
}
const numero = s => { s = String(s).replace(/R\$|\s/g, ''); if (!s) return null; if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.'); const n = Number(s); return Number.isFinite(n) ? n : NaN; };

// O Excel em português costuma salvar CSV em Windows-1252 (acentos quebram se lido como UTF-8). Aceita os dois.
function decodificar(buf) {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(buf).replace(/^\uFEFF/, ''); }
  catch { return new TextDecoder('windows-1252').decode(buf); }
}

module.exports = { parseCsv, numero, decodificar };
