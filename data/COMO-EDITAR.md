# Como editar produtos, preços, peso, medidas e descrição

Tudo fica em **`data/produtos.csv`** (uma linha por produto). Abra no Excel ou no Google Sheets, edite e salve.
Depois rode `npm run build` (ou só envie para o GitHub: a Vercel gera o site sozinha).

| Coluna | O que colocar | Exemplo |
|---|---|---|
| `id` | número único do produto (não repita, não mude depois de publicado) | `3` |
| `sku` | código do fabricante | `MP-18` |
| `nome` | nome que aparece no site | `Pistola MP-18 Emborrachamento` |
| `categoria` / `subcategoria` | agrupam o catálogo e o menu | `Pistolas` / `Emborrachamento` |
| `marca` | marca | `Wimpel` |
| `preco` | em reais, com vírgula ou ponto. **Vazio = "Sob consulta"** | `189,90` |
| `estoque` | número = o site controla e desconta cada venda paga. **Vazio = sem controle** | `12` |
| `peso_g` | peso em **gramas, já com a embalagem** | `850` |
| `comprimento_cm`, `largura_cm`, `altura_cm` | medidas da **caixa de envio**, em cm | `30`, `20`, `15` |
| `imagem` | endereço (https) da foto. Se existir `public/img/produtos/<id>.jpg/png/webp`, essa tem prioridade | |
| `descricao` | texto simples (sem HTML); aparece na página do produto | |
| `destaque` | `sim` para aparecer na home | `sim` |
| `ativo` | `não` esconde o produto do site | |

Dicas
- **Excel:** salve como *CSV UTF-8*. O build também aceita o "CSV" comum do Excel em português (`;` como separador, vírgula nos decimais e acentos em Windows-1252).
- **Peso e medidas** são o que define o preço do frete real. Sem eles, o site usa a caixa/peso padrão (30x20x15 cm, 500 g).
- O build **valida tudo** e para com a lista de erros (id repetido, preço inválido...). Se parar, o site que já está no ar não é afetado.
- Quer editar online, sem tocar em arquivo? Use uma planilha do Google (veja `CATALOGO_CSV_URL` no `.env.example`).
