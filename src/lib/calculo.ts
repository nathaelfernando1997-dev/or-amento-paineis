/**
 * Orçamento de painéis (paredes + lajes) e da parte cinza.
 *
 *   m² de paredes = Σ (metro linear × altura)
 *   m² de lajes   = Σ área (informada, ou comprimento × largura)
 *   painéis       = (m² paredes + m² lajes) × preço do m² (R$ 250 a 290)
 *   parte cinza   = área construída × R$ 700
 *   total         = painéis + parte cinza
 */

export const PRECO_PAINEL_MIN = 250;
export const PRECO_PAINEL_MAX = 290;
export const PRECO_PAINEL_PADRAO = 270;
export const PRECO_CINZA_PADRAO = 700;

export interface ParedeLinha {
  descricao: string;
  comprimento: number; // metro linear
  altura: number; // m
}

export interface LajeLinha {
  descricao: string;
  comprimento: number; // m
  largura: number; // m
  area: number; // m² — quando informada, vale no lugar de comprimento × largura
}

export interface CalculoPainel {
  paredes: ParedeLinha[];
  lajes: LajeLinha[];
  precoPainel: number; // R$/m²
  incluirCinza: boolean;
  areaConstruida: number; // m²
  precoCinza: number; // R$/m²
}

export interface ResultadoPainel {
  metroLinear: number;
  m2Paredes: number;
  m2Lajes: number;
  m2Paineis: number;
  valorPaineis: number;
  valorCinza: number;
  total: number;
}

const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

export const areaParede = (p: ParedeLinha) => n(p.comprimento) * n(p.altura);
export const areaLaje = (l: LajeLinha) =>
  n(l.area) > 0 ? n(l.area) : n(l.comprimento) * n(l.largura);

export function calcularPainel(c: CalculoPainel): ResultadoPainel {
  const metroLinear = c.paredes.reduce((a, p) => a + n(p.comprimento), 0);
  const m2Paredes = c.paredes.reduce((a, p) => a + areaParede(p), 0);
  const m2Lajes = c.lajes.reduce((a, l) => a + areaLaje(l), 0);
  const m2Paineis = m2Paredes + m2Lajes;
  const valorPaineis = m2Paineis * n(c.precoPainel);
  const valorCinza = c.incluirCinza ? n(c.areaConstruida) * n(c.precoCinza) : 0;
  return {
    metroLinear,
    m2Paredes,
    m2Lajes,
    m2Paineis,
    valorPaineis,
    valorCinza,
    total: valorPaineis + valorCinza,
  };
}

export function calculoVazio(): CalculoPainel {
  return {
    paredes: [{ descricao: "", comprimento: 0, altura: 2.8 }],
    lajes: [{ descricao: "", comprimento: 0, largura: 0, area: 0 }],
    precoPainel: PRECO_PAINEL_PADRAO,
    incluirCinza: true,
    areaConstruida: 0,
    precoCinza: PRECO_CINZA_PADRAO,
  };
}

/** Normaliza o JSON salvo no banco (tolerante a campos faltando). */
export function parseCalculo(raw: unknown): CalculoPainel | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<CalculoPainel>;
  const base = calculoVazio();
  return {
    paredes: Array.isArray(r.paredes)
      ? r.paredes.map((p) => ({
          descricao: String(p?.descricao ?? ""),
          comprimento: n(p?.comprimento),
          altura: n(p?.altura),
        }))
      : base.paredes,
    lajes: Array.isArray(r.lajes)
      ? r.lajes.map((l) => ({
          descricao: String(l?.descricao ?? ""),
          comprimento: n(l?.comprimento),
          largura: n(l?.largura),
          area: n(l?.area),
        }))
      : base.lajes,
    precoPainel: n(r.precoPainel) || base.precoPainel,
    incluirCinza: r.incluirCinza ?? base.incluirCinza,
    areaConstruida: n(r.areaConstruida),
    precoCinza: n(r.precoCinza) || base.precoCinza,
  };
}

const m2 = (v: number) =>
  v.toLocaleString("pt-BR", { maximumFractionDigits: 2 }) + " m²";
const m = (v: number) =>
  v.toLocaleString("pt-BR", { maximumFractionDigits: 2 }) + " m";
const rs = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Resumo em texto — vai para a descrição do orçamento. */
export function resumoTexto(c: CalculoPainel): string {
  const r = calcularPainel(c);
  const linhas = [
    `Paredes: ${m(r.metroLinear)} lineares = ${m2(r.m2Paredes)}`,
    `Lajes: ${m2(r.m2Lajes)}`,
    `Painéis: ${m2(r.m2Paineis)} × ${rs(c.precoPainel)}/m² = ${rs(r.valorPaineis)}`,
  ];
  if (c.incluirCinza) {
    linhas.push(
      `Parte cinza: ${m2(c.areaConstruida)} × ${rs(c.precoCinza)}/m² = ${rs(r.valorCinza)}`,
    );
  }
  linhas.push(`Total: ${rs(r.total)}`);
  return linhas.join("\n");
}
