# Orçamento de Painéis

App para fazer orçamentos de painéis a partir do projeto arquitetônico.

## Como o orçamento é calculado

| Etapa | Conta |
| --- | --- |
| Paredes | Σ (metro linear × altura) = m² de paredes |
| Lajes | Σ (comprimento × largura) = m² de lajes |
| Painéis | (m² paredes + m² lajes) × preço do m² (faixa usual R$ 250 a R$ 290) |
| Parte cinza (opcional) | área construída × R$ 700 |
| **Total** | painéis + parte cinza |

A regra está em [`src/lib/calculo.ts`](src/lib/calculo.ts) — é ali que se
muda a faixa de preço ou o valor padrão da parte cinza.

## O que tem

- Lista de orçamentos com busca, status (pendente / aprovado / recusado),
  totais e taxa de aprovação.
- Editor com paredes e lajes linha a linha, resumo ao vivo.
- Proposta pronta para imprimir ou salvar em PDF, com o nome e o contato da
  sua empresa.
- Duplicar orçamento, exportar/importar backup (arquivo `.json`).

Os orçamentos ficam salvos **no navegador** (sem login, sem servidor). Para
passar para outro aparelho ou guardar uma cópia, use **Exportar backup** e
**Importar backup**.

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
