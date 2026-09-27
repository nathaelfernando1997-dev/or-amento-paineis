/**
 * Leitor simples de DXF (AutoCAD) — roda no navegador, sem IA.
 *
 * Soma o comprimento das linhas (LINE, LWPOLYLINE, POLYLINE) de cada camada
 * (layer) e a área das polilinhas fechadas. O orçamentista escolhe quais
 * camadas são paredes e quais são lajes.
 *
 * Não entra: linhas dentro de blocos (INSERT), arcos e splines.
 */

export interface CamadaDxf {
  nome: string;
  comprimento: number; // m
  areaFechada: number; // m² (polilinhas fechadas)
  entidades: number;
}

export interface LeituraDxf {
  camadas: CamadaDxf[];
  unidade: string;
  blocosIgnorados: number;
}

// $INSUNITS → fator para metros
const UNIDADES: Record<number, [string, number]> = {
  1: ["polegadas", 0.0254],
  2: ["pés", 0.3048],
  4: ["milímetros", 0.001],
  5: ["centímetros", 0.01],
  6: ["metros", 1],
};

type Par = [number, string];

function pares(texto: string): Par[] {
  const linhas = texto.split(/\r?\n/);
  const out: Par[] = [];
  for (let i = 0; i + 1 < linhas.length; i += 2) {
    out.push([parseInt(linhas[i].trim(), 10), linhas[i + 1].trim()]);
  }
  return out;
}

const dist = (a: number[], b: number[]) => Math.hypot(b[0] - a[0], b[1] - a[1]);

function comprimentoEArea(pts: number[][], fechada: boolean) {
  let c = 0;
  for (let i = 1; i < pts.length; i++) c += dist(pts[i - 1], pts[i]);
  let area = 0;
  if (fechada && pts.length >= 3) {
    c += dist(pts[pts.length - 1], pts[0]);
    for (let i = 0; i < pts.length; i++) {
      const [x1, y1] = pts[i];
      const [x2, y2] = pts[(i + 1) % pts.length];
      area += x1 * y2 - x2 * y1;
    }
    area = Math.abs(area) / 2;
  }
  return { c, area };
}

/** Palpite de unidade quando o arquivo não informa: desenhos em mm têm números enormes. */
function palpiteFator(maiorCoord: number): [string, number] {
  if (maiorCoord > 2000) return ["milímetros (estimado)", 0.001];
  if (maiorCoord > 200) return ["centímetros (estimado)", 0.01];
  return ["metros (estimado)", 1];
}

export function lerDxf(texto: string): LeituraDxf {
  const ps = pares(texto);
  if (!ps.some(([c, v]) => c === 0 && v === "SECTION")) {
    throw new Error("Esse arquivo não parece um DXF em texto. No AutoCAD, use Salvar como → DXF (ASCII).");
  }

  let insunits = 0;
  for (let i = 0; i < ps.length - 1; i++) {
    if (ps[i][0] === 9 && ps[i][1] === "$INSUNITS") {
      insunits = parseInt(ps[i + 1][1], 10);
      break;
    }
  }

  // Só a seção ENTITIES (as linhas do desenho principal).
  const ini = ps.findIndex((p, i) => p[0] === 0 && p[1] === "SECTION" && ps[i + 1]?.[1] === "ENTITIES");
  if (ini < 0) throw new Error("O DXF não tem desenho (seção ENTITIES vazia).");

  type Bruto = { camada: string; c: number; area: number };
  const brutos: Bruto[] = [];
  let blocosIgnorados = 0;
  let maiorCoord = 0;

  let i = ini + 2;
  let polyAberta: { camada: string; pts: number[][]; fechada: boolean } | null = null;

  while (i < ps.length && !(ps[i][0] === 0 && ps[i][1] === "ENDSEC")) {
    const tipo = ps[i][1];
    // Lê os grupos desta entidade até o próximo código 0.
    let j = i + 1;
    const grupos: Par[] = [];
    while (j < ps.length && ps[j][0] !== 0) grupos.push(ps[j++]);
    const camada = grupos.find((g) => g[0] === 8)?.[1] ?? "0";
    const num = (cod: number) => grupos.filter((g) => g[0] === cod).map((g) => parseFloat(g[1]));
    const marca = (v: number) => (maiorCoord = Math.max(maiorCoord, Math.abs(v)));

    if (tipo === "LINE") {
      const [x1] = num(10), [y1] = num(20), [x2] = num(11), [y2] = num(21);
      [x1, y1, x2, y2].forEach(marca);
      brutos.push({ camada, c: dist([x1, y1], [x2, y2]), area: 0 });
    } else if (tipo === "LWPOLYLINE") {
      const xs = num(10), ys = num(20);
      const pts = xs.map((x, k) => [x, ys[k]]);
      pts.flat().forEach(marca);
      const fechada = ((num(70)[0] ?? 0) & 1) === 1;
      const r = comprimentoEArea(pts, fechada);
      brutos.push({ camada, c: r.c, area: r.area });
    } else if (tipo === "POLYLINE") {
      polyAberta = { camada, pts: [], fechada: ((num(70)[0] ?? 0) & 1) === 1 };
    } else if (tipo === "VERTEX" && polyAberta) {
      const [x] = num(10), [y] = num(20);
      marca(x); marca(y);
      polyAberta.pts.push([x, y]);
    } else if (tipo === "SEQEND" && polyAberta) {
      const r = comprimentoEArea(polyAberta.pts, polyAberta.fechada);
      brutos.push({ camada: polyAberta.camada, c: r.c, area: r.area });
      polyAberta = null;
    } else if (tipo === "INSERT") {
      blocosIgnorados++;
    }
    i = j;
  }

  const [unidade, fator] = UNIDADES[insunits] ?? palpiteFator(maiorCoord);
  const mapa = new Map<string, CamadaDxf>();
  for (const b of brutos) {
    const cam = mapa.get(b.camada) ?? { nome: b.camada, comprimento: 0, areaFechada: 0, entidades: 0 };
    cam.comprimento += b.c * fator;
    cam.areaFechada += b.area * fator * fator;
    cam.entidades++;
    mapa.set(b.camada, cam);
  }

  return {
    camadas: [...mapa.values()].sort((a, b) => b.comprimento - a.comprimento),
    unidade,
    blocosIgnorados,
  };
}
