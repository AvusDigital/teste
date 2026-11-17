'use strict';
// Servidor local sem dependências: faz o build, serve dist/ e roda /api/* como a Vercel. Uso: npm run dev
const http = require('http'), fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const RAIZ = path.join(__dirname, '..'), DIST = path.join(RAIZ, 'dist'), PORT = Number(process.env.PORT) || 3000;

// .env simples (sem dependências)
try { for (const l of fs.readFileSync(path.join(RAIZ, '.env'), 'utf8').split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ''); } } catch {}
if (!process.argv.includes('--sem-build')) execFileSync(process.execPath, [path.join(__dirname, 'build.js')], { stdio: 'inherit', env: process.env });

const headersSeg = Object.fromEntries((JSON.parse(fs.readFileSync(path.join(RAIZ, 'vercel.json'), 'utf8')).headers[0].headers).map(h => [h.key, h.value]));
delete headersSeg['Strict-Transport-Security']; delete headersSeg['upgrade-insecure-requests'];
headersSeg['Content-Security-Policy'] = headersSeg['Content-Security-Policy'].replace('; upgrade-insecure-requests', '');
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.xml': 'application/xml', '.txt': 'text/plain' };

http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://localhost');
  for (const [k, v] of Object.entries(headersSeg)) res.setHeader(k, v);
  if (u.pathname.startsWith('/api/')) {
    const f = path.join(RAIZ, 'api', u.pathname.slice(5).replace(/[^a-z0-9-]/gi, '') + '.js');
    if (!fs.existsSync(f)) { res.statusCode = 404; return res.end('{"erro":"Não encontrado."}'); }
    return require(f)(req, res);
  }
  let p = path.normalize(path.join(DIST, decodeURIComponent(u.pathname)));
  if (!p.startsWith(DIST)) { res.statusCode = 403; return res.end(); }
  if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'index.html');
  if (!fs.existsSync(p)) { res.statusCode = 404; res.setHeader('Content-Type', MIME['.html']); return res.end(fs.readFileSync(path.join(DIST, '404.html'))); }
  res.setHeader('Content-Type', MIME[path.extname(p)] || 'application/octet-stream');
  fs.createReadStream(p).pipe(res);
}).listen(PORT, () => console.log(`\nLoja em http://localhost:${PORT}  (Ctrl+C para parar)`));
