import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { timingSafeEqual } from "node:crypto";
import { LeituraSchema } from "@/lib/leitura";

// Projetos grandes podem levar alguns minutos para serem lidos.
export const maxDuration = 300;

const SYSTEM = `Você é orçamentista de uma empresa que fabrica painéis para paredes e lajes.
Recebe o projeto arquitetônico (plantas, cortes, quadro de áreas) e levanta as quantidades para o orçamento.

Método do orçamento (siga exatamente):
- Paredes: metro linear de cada parede × altura (pé-direito) = m² de painel. Não desconte portas e janelas.
- Conte cada parede uma vez só, pelo eixo — não some as duas faces nem as duas linhas do desenho.
- Some paredes externas e internas. Agrupe por pavimento e por tipo (externas / internas) quando der; se o pé-direito mudar, separe em linhas diferentes.
- Altura: use o pé-direito dos cortes/fachadas. Se não houver, use 2,80 m e avise.
- Lajes: área de cada laje em m² (por pavimento / cobertura). Use o quadro de áreas ou as cotas.
- Área construída: a área total do quadro de áreas. Se não houver, calcule pelas cotas externas e avise.

Regras:
- Use as cotas escritas no desenho. Só estime por escala quando não houver cota, e diga isso na origem.
- Todos os números em metros / m², com ponto decimal.
- Em "avisos", liste tudo que o orçamentista precisa conferir: paredes sem cota, trechos ilegíveis, suposições, pavimentos repetidos, muros, platibandas.
- Se o arquivo não for um projeto arquitetônico, devolva listas vazias, confiança baixa e explique em avisos.`;

const TIPOS_IMAGEM = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
type TipoImagem = (typeof TIPOS_IMAGEM)[number];

function senhaConfere(recebida: string | null): boolean {
  const esperada = process.env.APP_SENHA;
  if (!esperada || !recebida) return false;
  const a = Buffer.from(recebida);
  const b = Buffer.from(esperada);
  return a.length === b.length && timingSafeEqual(a, b);
}

function erro(mensagem: string, status: number) {
  return Response.json({ error: mensagem }, { status });
}

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY || !process.env.APP_SENHA) {
    return erro(
      "Leitura automática não configurada. Cadastre ANTHROPIC_API_KEY e APP_SENHA na Vercel (veja o README).",
      503,
    );
  }
  if (!senhaConfere(req.headers.get("x-senha"))) {
    return erro("Senha incorreta.", 401);
  }

  const fd = await req.formData();
  const arquivos = fd.getAll("arquivo").filter((f): f is File => f instanceof File);
  const texto = String(fd.get("texto") ?? "").slice(0, 200_000);
  if (arquivos.length === 0) return erro("Nenhum arquivo enviado.", 400);

  const conteudo: Anthropic.Beta.BetaContentBlockParam[] = [];
  for (const f of arquivos) {
    const data = Buffer.from(await f.arrayBuffer()).toString("base64");
    if (f.type === "application/pdf") {
      conteudo.push({
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data },
      });
    } else if ((TIPOS_IMAGEM as readonly string[]).includes(f.type)) {
      conteudo.push({
        type: "image",
        source: { type: "base64", media_type: f.type as TipoImagem, data },
      });
    } else {
      return erro(`Tipo de arquivo não suportado: ${f.name}`, 400);
    }
  }
  conteudo.push({
    type: "text",
    text:
      (texto
        ? `Texto extraído do PDF original (inclui as cotas, use para conferir os números):\n<texto_pdf>\n${texto}\n</texto_pdf>\n\n`
        : "") + "Faça o levantamento de paredes, lajes e área construída deste projeto.",
  });

  const client = new Anthropic();
  try {
    const resposta = await client.beta.messages.parse({
      model: "claude-opus-5",
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      thinking: { type: "adaptive" },
      output_config: { effort: "high", format: betaZodOutputFormat(LeituraSchema) },
      system: SYSTEM,
      messages: [{ role: "user", content: conteudo }],
    });

    if (resposta.stop_reason === "refusal") {
      return erro("A leitura foi recusada. Tente outro arquivo.", 422);
    }
    if (resposta.stop_reason === "max_tokens" || !resposta.parsed_output) {
      return erro("Não consegui terminar a leitura. Tente enviar só as plantas e cortes.", 422);
    }
    return Response.json(resposta.parsed_output);
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) {
      return erro("A chave ANTHROPIC_API_KEY cadastrada na Vercel é inválida.", 500);
    }
    if (e instanceof Anthropic.RateLimitError) {
      return erro("Muitas leituras seguidas. Espere um minuto e tente de novo.", 429);
    }
    if (e instanceof Anthropic.BadRequestError) {
      return erro(`O arquivo não pôde ser lido: ${e.message}`, 400);
    }
    if (e instanceof Anthropic.APIError) {
      return erro(`Erro no serviço de leitura (${e.status}). Tente de novo.`, 502);
    }
    throw e;
  }
}
