'use strict';
// Baixa as imagens dos produtos para public/img/produtos/<id>.<ext> (o build passa a usar a cópia local).
// Uso: npm run imagens   (precisa de internet; é seguro rodar de novo: só baixa o que falta)
const fs = require('fs'), path = require('path');
const RAIZ = path.join(__dirname, '..'), DEST = path.join(RAIZ, 'public/img/produtos');
const EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' };

(async () => {
  fs.mkdirSync(DEST, { recursive: true });
  const prods = require('./csv').parseCsv(fs.readFileSync(path.join(RAIZ, 'data/produtos.csv'), 'utf8'));
  const tem = new Set(fs.readdirSync(DEST).map(f => f.split('.')[0]));
  let ok = 0, falhou = 0, pulou = 0;
  for (const p of prods) {
    const id = p.id, url = /^https:\/\/.+\.(png|jpe?g|webp|gif)(\?.*)?$/i.test(p.imagem) ? p.imagem : null;
    if (!id || !url) continue;
    if (tem.has(id)) { pulou++; continue; }
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(20000) });
      const ext = EXT[(r.headers.get('content-type') || '').split(';')[0]];
      if (!r.ok || !ext) throw new Error(r.status + ' ' + r.headers.get('content-type'));
      fs.writeFileSync(path.join(DEST, `${id}.${ext}`), Buffer.from(await r.arrayBuffer())); ok++;
    } catch (e) { falhou++; console.error(`produto ${id}: ${e.message}`); }
  }
  console.log(`\nImagens: ${ok} baixadas, ${pulou} já existiam, ${falhou} falharam.\nAgora rode "npm run build" (o site passa a usar as cópias locais).`);
  console.log('Dica: depois de baixar tudo, tire https://www.wimpel.com.br da diretiva img-src em vercel.json.');
})();
