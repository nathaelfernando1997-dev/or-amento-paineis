/**
 * Prepara o projeto para enviar à leitura automática.
 *
 * A Vercel aceita no máximo ~4,5 MB por envio. PDF pequeno vai inteiro
 * (melhor qualidade: o texto das cotas vai junto). PDF grande vira imagem
 * página a página, e o texto (cotas) é extraído aqui no navegador.
 */

const LIMITE_BYTES = 4_200_000;
const MAX_PAGINAS = 8;

export type Preparado = { arquivos: File[]; texto: string; aviso?: string };

export async function prepararArquivo(file: File): Promise<Preparado> {
  if (file.type.startsWith("image/")) {
    return { arquivos: [await reduzirImagem(file, 2400)], texto: "" };
  }
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    throw new Error("Envie o projeto em PDF, JPG ou PNG (ou DXF).");
  }
  if (file.size <= LIMITE_BYTES) {
    return { arquivos: [new File([file], file.name, { type: "application/pdf" })], texto: "" };
  }
  return pdfGrandeParaImagens(file);
}

async function pdfGrandeParaImagens(file: File): Promise<Preparado> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const paginas = Math.min(pdf.numPages, MAX_PAGINAS);

  const textos: string[] = [];
  const canvases: HTMLCanvasElement[] = [];
  for (let n = 1; n <= paginas; n++) {
    const page = await pdf.getPage(n);
    const tc = await page.getTextContent();
    const t = tc.items
      .map((i) => ("str" in i ? i.str : ""))
      .filter((s) => s.trim())
      .join(" ");
    textos.push(`--- Página ${n} ---\n${t}`);

    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: 3000 / Math.max(base.width, base.height) });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fff"; // PDF transparente viraria fundo preto
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, canvas, viewport }).promise;
    canvases.push(canvas);
  }

  // Divide o limite entre as páginas, baixando a qualidade se precisar.
  const porPagina = LIMITE_BYTES / canvases.length - 60_000;
  const arquivos: File[] = [];
  for (const [i, c] of canvases.entries()) {
    arquivos.push(await canvasParaJpeg(c, porPagina, `pagina-${i + 1}.jpg`));
  }

  return {
    arquivos,
    texto: textos.join("\n\n"),
    aviso:
      pdf.numPages > MAX_PAGINAS
        ? `O PDF tem ${pdf.numPages} páginas; só as ${MAX_PAGINAS} primeiras foram lidas. Envie só plantas, cortes e quadro de áreas.`
        : undefined,
  };
}

async function reduzirImagem(file: File, max: number): Promise<File> {
  const bmp = await createImageBitmap(file);
  const escala = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * escala);
  canvas.height = Math.round(bmp.height * escala);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return canvasParaJpeg(canvas, LIMITE_BYTES - 100_000, "projeto.jpg");
}

async function canvasParaJpeg(canvas: HTMLCanvasElement, maxBytes: number, nome: string): Promise<File> {
  let c = canvas;
  for (let tentativa = 0; tentativa < 8; tentativa++) {
    for (const q of [0.85, 0.7, 0.55]) {
      const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", q));
      if (blob && blob.size <= maxBytes) return new File([blob], nome, { type: "image/jpeg" });
    }
    // Ainda grande: reduz a resolução em 20% e tenta de novo.
    const menor = document.createElement("canvas");
    menor.width = Math.round(c.width * 0.8);
    menor.height = Math.round(c.height * 0.8);
    menor.getContext("2d")!.drawImage(c, 0, 0, menor.width, menor.height);
    c = menor;
  }
  throw new Error("O arquivo é grande demais. Envie menos páginas.");
}
