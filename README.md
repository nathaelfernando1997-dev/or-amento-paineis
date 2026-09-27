# Orçamento de Painéis

App para fazer orçamentos de painéis a partir do projeto arquitetônico.

## Como o orçamento é calculado

| Etapa | Conta |
| --- | --- |
| Paredes | Σ (metro linear × altura) = m² de paredes |
| Lajes | Σ área de cada laje (digitada, ou comprimento × largura) = m² de lajes |
| Painéis | (m² paredes + m² lajes) × preço do m² (faixa usual R$ 250 a R$ 290) |
| Parte cinza (opcional) | área construída × R$ 700 |
| **Total** | painéis + parte cinza |

A regra está em [`src/lib/calculo.ts`](src/lib/calculo.ts) — é ali que se
muda a faixa de preço ou o valor padrão da parte cinza.

## O que tem

- **Leitura automática do projeto:** anexe o PDF, a imagem ou o DXF e o
  sistema preenche paredes, lajes e área construída. Você confere e corrige
  antes de salvar.
- Lista de orçamentos com busca, status (pendente / aprovado / recusado),
  totais e taxa de aprovação.
- Editor com paredes e lajes linha a linha, resumo ao vivo.
- Proposta pronta para imprimir ou salvar em PDF, com o nome e o contato da
  sua empresa.
- Duplicar orçamento, exportar/importar backup (arquivo `.json`).

Os orçamentos ficam salvos **no navegador** (sem login, sem servidor). Para
passar para outro aparelho ou guardar uma cópia, use **Exportar backup** e
**Importar backup**.

## Leitura automática do projeto

| Arquivo | Como é lido | Precisão |
| --- | --- | --- |
| **DXF** (AutoCAD → Salvar como → DXF) | No próprio navegador, sem IA. Soma as linhas de cada camada (layer); você marca quais são paredes e lajes. | Alta — medidas exatas do desenho |
| **PDF / imagem** | Enviado ao Claude (API da Anthropic), que lê as cotas, os cortes e o quadro de áreas. | Média — sempre confira os avisos |

DWG não abre no navegador: salve como DXF ou exporte em PDF.

Para PDF/imagem, cadastre na Vercel (**Settings → Environment Variables**) e
faça um novo deploy:

- `ANTHROPIC_API_KEY` — crie em <https://console.anthropic.com> (**API Keys**).
  Cada projeto lido custa alguns centavos de dólar, cobrados na sua conta da
  Anthropic.
- `APP_SENHA` — uma senha à sua escolha. O app pede essa senha antes de ler
  um projeto, para ninguém usar seus créditos pelo link público.

PDF acima de ~4 MB é convertido em imagens no navegador (até 8 páginas) e o
texto das cotas vai junto. Para melhor resultado, envie só plantas, cortes e
quadro de áreas.

A leitura do DXF não entra nas linhas de dentro de blocos, arcos e splines.

## Rodar

```bash
npm install
npm run dev
```

Abra <http://localhost:3000>.

## Publicar na Vercel

Importe este repositório em <https://vercel.com/new> e clique em Deploy.
Não precisa de variável de ambiente.

---

Feito com Next.js 16, React 19 e Tailwind CSS v4.
