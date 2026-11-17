# Arpint — loja

Site estático (rápido, indexável) + 7 funções de API na Vercel. **Zero dependências**: não há `npm install`, nem framework, nem build de CSS.
Frete e pagamento nascem em **modo demo** (tudo simulado, funciona de ponta a ponta) e viram reais trocando variáveis de ambiente, sem mexer em código.

```
npm run dev       # build + servidor local em http://localhost:3000 (usa .env se existir)
npm run build     # gera dist/ (páginas, sitemap, catálogo) — é o que a Vercel roda
npm test          # 13 testes (preço, frete, estoque, webhook assinado, produção bloqueando demo...)
npm run imagens   # baixa as imagens dos produtos para dentro do projeto (precisa de internet)
```

## Como o dinheiro fica seguro
- **Preço, frete, total e estoque são decididos no servidor.** O navegador só manda "id + quantidade" e a opção de frete escolhida.
- **`MODO=producao` falha fechado:** se faltar qualquer credencial, ou se frete/pagamento ainda estiver em demo, o checkout devolve 503. Demo nunca vende por acidente.
- Pagamento confirmado **só pelo webhook assinado** do Mercado Pago, que ainda é reconfirmado na API deles e conferido contra o valor do pedido. Reenvio do mesmo aviso não baixa estoque nem avisa duas vezes.
- Link do pedido assinado (HMAC) e código aleatório: não dá para ver pedido alheio. Limite de requisições por IP, checagem de origem, CSP estrito (sem script/estilo inline), HSTS, sem `innerHTML` com dados.
- Sem segredos no repositório: tudo em variáveis de ambiente (`.env.example`).

## Catálogo, estoque e imagens
- **Fonte única: `data/produtos.csv`** (abre no Excel/Google Sheets). Colunas: `id, sku, nome, categoria, subcategoria, marca, preco, estoque, peso_g, comprimento_cm, largura_cm, altura_cm, imagem, descricao, destaque, ativo`.
  - `preco` vazio = "Sob consulta" (botão de WhatsApp). `ativo` = não → some do site. `destaque` = sim → vai para a home.
  - **`estoque` vazio = sem controle (sempre disponível).** Com número, o site desconta cada venda paga. Para fazer uma nova contagem, é só trocar o número na planilha: a contagem recomeça dali.
- **Mais fácil para o Arlindo editar:** crie uma planilha no Google Sheets com essas colunas, *Arquivo > Compartilhar > Publicar na Web > CSV*, coloque o link em `CATALOGO_CSV_URL` e crie um *Deploy Hook* na Vercel. Cada deploy puxa a planilha. Se a planilha estiver quebrada, o build **aborta e o site anterior continua no ar**.
- O build valida tudo (id repetido, preço inválido...) e avisa o que falta (medidas, imagens externas).
- **Passo a passo de edição (colunas, exemplos, Excel):** `data/COMO-EDITAR.md`.
- **Medidas e peso:** hoje os 90 produtos estão sem medidas, e 63 têm peso 550 g (valor padrão da base antiga). Preencha `peso_g` (já com a embalagem) e `comprimento_cm/largura_cm/altura_cm`; senão o frete real usa a caixa padrão (`FRETE_CAIXA_PADRAO`).
- **Imagens:** `npm run imagens` baixa para `public/img/produtos/<id>.<ext>` (tenta a versão sem `cover-`, que costuma ser maior), mede cada foto e lista em `data/imagens-pequenas.txt` as que estão abaixo de 800 px, candidatas a foto nova. O build passa a usar as cópias; foto sua com o nome `<id>.jpg` (ou png/webp) em `public/img/produtos/` tem prioridade. Depois remova `https://www.wimpel.com.br` do `img-src` no `vercel.json`.

## Fim de semana: ligar o que é real (nessa ordem)
Dica: `/api/saude?key=SUA_SAUDE_KEY` lista, em português, o que ainda falta.

1. **Vercel**: crie o projeto, defina `SITE_URL`, `SEGREDO_APP` (24+ caracteres aleatórios) e `SAUDE_KEY`. O deploy já funciona em demo.
2. **Upstash (pedidos e estoque)**: Vercel > Storage > Upstash Redis (grátis). Preencha `UPSTASH_REDIS_REST_URL/TOKEN` e `STORE_PROVIDER=upstash`.
3. **Telegram (aviso de pedido pago)**: crie um bot no @BotFather, mande uma mensagem para ele e pegue o chat id. `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` e `NOTIFICAR_PROVIDER=telegram`.
4. **SuperFrete**: token em Integrações > Desenvolvedores. `FRETE_PROVIDER=superfrete`, `SUPERFRETE_TOKEN` e o CEP de origem (`ORIGEM_CEP`). Teste antes com `SUPERFRETE_SANDBOX=1`.
5. **Mercado Pago**: crie a aplicação (Checkout Pro). Com o token `TEST-...`: `PAGAMENTO_PROVIDER=mercadopago`, `MERCADOPAGO_ACCESS_TOKEN`. Cadastre o webhook `https://SEU-SITE/api/webhook-mercadopago` (evento Pagamentos) e copie a chave secreta para `MERCADOPAGO_WEBHOOK_SECRET`. Faça uma compra de teste completa.
6. **Dados legais** em `data/loja.json`: `razaoSocial`, `cnpj`, `endereco` e, se houver retirada, `retirada.endereco/horario`. Também `cepOrigem` e `email`.
7. **Virar a chave:** troque para token de produção (`APP_USR-...`) e `MODO=producao`. Confira `/api/saude?key=...` com `vendaLiberada: true` e faça uma compra real de valor baixo.

## Estrutura
```
data/            produtos.csv (catálogo) · loja.json (dados e políticas da loja)
src/             styles.css · templates.js (páginas) · client/app.js (carrinho, frete, checkout)
scripts/         build.js · dev.js · imagens.js · csv.js
api/             frete · checkout · pedido · estoque · saude · webhook-mercadopago · demo-pagar
lib/             config · pedido (regras) · http · providers/{frete,pagamento,store,notificar}
public/          logos, favicon, placeholder (copiados para dist/)
test/            testes (node:test, sem dependências)
```
Trocar de provedor = criar `lib/providers/<tipo>/<nome>.js` com a mesma interface do `demo.js` e registrar em `index.js`.

## Limites conhecidos (de propósito, para manter simples)
- Não gera etiqueta de envio nem nota fiscal: o pedido pago chega no Telegram com tudo para emitir (SuperFrete e NF-e hoje manuais).
- Estoque é descontado quando o pagamento é aprovado (não reserva durante o checkout); em corrida pode vender 1 a mais, e o aviso "ESTOQUE NEGATIVO" chega no Telegram.
- Estorno/chargeback só avisa no Telegram; não devolve estoque sozinho.
