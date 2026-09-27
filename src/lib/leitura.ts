import { z } from "zod";

/**
 * Formato da resposta da leitura automática do projeto (PDF/imagem → Claude).
 * Usado no servidor (saída estruturada) e no navegador (tipos).
 */
export const LeituraSchema = z.object({
  paredes: z.array(
    z.object({
      descricao: z.string().describe("Ex.: 'Paredes externas — térreo'"),
      metro_linear: z.number().describe("Soma dos comprimentos, em metros"),
      altura: z.number().describe("Altura da parede (pé-direito), em metros"),
      origem: z.string().describe("De onde saiu o número: cotas, prancha, estimativa"),
    }),
  ),
  lajes: z.array(
    z.object({
      descricao: z.string(),
      area_m2: z.number(),
      origem: z.string(),
    }),
  ),
  area_construida_m2: z
    .number()
    .nullable()
    .describe("Área construída total, de preferência do quadro de áreas; null se não achar"),
  confianca: z.enum(["alta", "media", "baixa"]),
  avisos: z
    .array(z.string())
    .describe("Dúvidas, paredes sem cota, suposições feitas — o que o orçamentista deve conferir"),
});

export type Leitura = z.infer<typeof LeituraSchema>;
