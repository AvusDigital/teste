'use strict';
// Baixa as imagens dos produtos para public/img/produtos/<id>.<ext> e mede o tamanho de cada uma.
// Uso: npm run imagens            (só baixa o que falta)
//      npm run imagens -- --refazer   (baixa tudo de novo)
// Para cada produto tenta também a versão sem o prefixo "cover-" (costuma ser a original, maior) e fica com a maior.
const fs = require('fs'), path = require('path');
const { parseCsv, decodificar } = require('./csv'), { dimensoes } = require('./imgsize');
const RAIZ = path.join(__dirname, '..'), DEST = path.join(RAIZ, 'public/img/produtos');
const EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' };
const MIN = 800;   // lado menor, em px, para ficar nítida na página do produto

async function baixar(url) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(20000) });
    const ext = EXT[(r.headers.get('content-type') || '').split(';')[0]];
    if (!r.ok || !ext) return null;
    const buf = Buffer.from(await r.arrayBuffer()), d = dimensoes(buf);
    return { buf, ext, d, url };
  } catch { return null; }
}

(async () => {
  fs.mkdirSync(DEST, { recursive: true });
  const refazer = process.argv.includes('--refazer');
  const prods = parseCsv(decodificar(fs.readFileSync(path.join(RAIZ, 'data/produtos.csv'))));
  const tem = new Set(fs.readdirSync(DEST).map(f => f.split('.')[0]));
  const medidas = []; let ok = 0, falhou = 0, pulou = 0;
  for (const p of prods) {
    if (!/^https:\/\/.+\.(png|jpe?g|webp|gif)(\?.*)?$/i.test(p.imagem)) continue;
    if (tem.has(p.id) && !refazer) {
      const f = fs.readdirSync(DEST).find(x => x.startsWith(p.id + '.')); const d = dimensoes(fs.readFileSync(path.join(DEST, f))); medidas.push({ p, d }); pulou++; continue;
    }
    const candidatos = [...new Set([p.imagem.replace(/\/cover-/, '/'), p.imagem])];
    let melhor = null;
    for (const c of candidatos) { const r = await baixar(c); if (r && (!melhor || (r.d ? r.d.w * r.d.h : r.buf.length) > (melhor.d ? melhor.d.w * melhor.d.h : melhor.buf.length))) melhor = r; }
    if (!melhor) { falhou++; console.error(`produto ${p.id}: não consegui baixar`); continue; }
    for (const f of fs.readdirSync(DEST)) if (f.startsWith(p.id + '.')) fs.unlinkSync(path.join(DEST, f));
    fs.writeFileSync(path.join(DEST, `${p.id}.${melhor.ext}`), melhor.buf); ok++; medidas.push({ p, d: melhor.d });
  }
  const pequenas = medidas.filter(m => !m.d || Math.min(m.d.w, m.d.h) < MIN);
  fs.writeFileSync(path.join(RAIZ, 'data/imagens-pequenas.txt'), `Imagens com lado menor abaixo de ${MIN}px (candidatas a foto nova)\n\n` + pequenas.map(m => `${m.p.id}\t${m.d ? m.d.w + 'x' + m.d.h : 'tamanho desconhecido'}\t${m.p.nome}`).join('\n') + '\n');
  const menor = medidas.filter(m => m.d).sort((a, b) => Math.min(a.d.w, a.d.h) - Math.min(b.d.w, b.d.h))[0], maior = medidas.filter(m => m.d).sort((a, b) => Math.max(b.d.w, b.d.h) - Math.max(a.d.w, a.d.h))[0];
  console.log(`\nImagens: ${ok} baixadas, ${pulou} já existiam, ${falhou} falharam.`);
  if (menor) console.log(`Menor: ${menor.d.w}x${menor.d.h} (produto ${menor.p.id}) | Maior: ${maior.d.w}x${maior.d.h} (produto ${maior.p.id})`);
  console.log(`${pequenas.length} de ${medidas.length} com menos de ${MIN}px — lista em data/imagens-pequenas.txt`);
  console.log('Agora rode "npm run build". Depois de baixar tudo, tire https://www.wimpel.com.br do img-src em vercel.json.');
})();
