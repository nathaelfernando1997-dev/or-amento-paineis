"use client";

import { useRef, useState } from "react";
import { Button, Card, Input } from "@/components/ui";
import { num } from "@/lib/format";
import { lerDxf, type LeituraDxf } from "@/lib/dxf";
import type { Leitura } from "@/lib/leitura";
import type { LajeLinha, ParedeLinha } from "@/lib/calculo";
import { cn } from "@/lib/cn";

export type Levantamento = {
  paredes: ParedeLinha[];
  lajes: LajeLinha[];
  areaConstruida: number | null;
};

const KEY_SENHA = "orcamentos-paineis:senha";

function lerSenha() {
  try {
    return localStorage.getItem(KEY_SENHA) ?? "";
  } catch {
    return "";
  }
}
function gravarSenha(s: string) {
  try {
    if (s) localStorage.setItem(KEY_SENHA, s);
    else localStorage.removeItem(KEY_SENHA);
  } catch {}
}

const CONFIANCA: Record<Leitura["confianca"], [string, string]> = {
  alta: ["Confiança alta", "text-success"],
  media: ["Confiança média — confira", "text-warning"],
  baixa: ["Confiança baixa — confira tudo", "text-danger"],
};

export function LeitorProjeto({ onAplicar }: { onAplicar: (l: Levantamento) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [etapa, setEtapa] = useState<"inicio" | "senha" | "lendo" | "ia" | "dxf">("inicio");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [leitura, setLeitura] = useState<Leitura | null>(null);
  const [dxf, setDxf] = useState<LeituraDxf | null>(null);

  function reiniciar() {
    setEtapa("inicio");
    setArquivo(null);
    setLeitura(null);
    setDxf(null);
    setErro(null);
    setAviso(null);
  }

  async function escolher(f: File) {
    setErro(null);
    setArquivo(f);
    if (f.name.toLowerCase().endsWith(".dxf")) {
      try {
        setDxf(lerDxf(await f.text()));
        setEtapa("dxf");
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Não consegui ler o DXF.");
      }
      return;
    }
    if (f.name.toLowerCase().endsWith(".dwg")) {
      setErro("Arquivo DWG não abre no navegador. No AutoCAD, use Salvar como → DXF, ou exporte em PDF.");
      return;
    }
    const s = lerSenha();
    if (!s) {
      setEtapa("senha");
      return;
    }
    await enviar(f, s);
  }

  async function enviar(f: File, s: string) {
    setEtapa("lendo");
    setErro(null);
    try {
      const { prepararArquivo } = await import("@/lib/preparar-arquivo");
      const prep = await prepararArquivo(f);
      setAviso(prep.aviso ?? null);
      const fd = new FormData();
      prep.arquivos.forEach((a) => fd.append("arquivo", a));
      if (prep.texto) fd.append("texto", prep.texto);

      const res = await fetch("/api/ler-projeto", {
        method: "POST",
        headers: { "x-senha": s },
        body: fd,
      });
      const corpo = await res.json().catch(() => null);
      if (res.status === 401) {
        gravarSenha("");
        setEtapa("senha");
        setErro("Senha incorreta. Digite de novo.");
        return;
      }
      if (!res.ok) {
        throw new Error(
          corpo?.error ??
            (res.status === 413
              ? "Arquivo grande demais para enviar."
              : res.status === 504
                ? "A leitura demorou demais. Envie só as plantas e os cortes."
                : `Erro ${res.status} na leitura.`),
        );
      }
      gravarSenha(s);
      setLeitura(corpo as Leitura);
      setEtapa("ia");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao ler o projeto.");
      setEtapa("inicio");
    }
  }

  return (
    <Card className="border-primary/40 bg-primary-soft/40">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Ler o projeto automaticamente</h2>
          <p className="mt-0.5 text-sm text-muted">
            Anexe o projeto (PDF, imagem ou DXF). O sistema levanta paredes, lajes e área
            construída — você confere antes de usar.
          </p>
        </div>
        {etapa !== "inicio" && etapa !== "lendo" && (
          <Button variant="ghost" size="sm" onClick={reiniciar}>
            Cancelar
          </Button>
        )}
      </div>

      <input
        ref={input}
        type="file"
        accept=".pdf,.dxf,.dwg,image/*,application/pdf"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) escolher(f);
          e.target.value = "";
        }}
      />

      {etapa === "inicio" && (
        <Button className="mt-4" onClick={() => input.current?.click()}>
          Anexar projeto
        </Button>
      )}

      {etapa === "senha" && (
        <form
          className="mt-4 flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (arquivo && senha) enviar(arquivo, senha);
          }}
        >
          <label className="grow">
            <span className="mb-1.5 block text-sm font-medium">Senha da leitura automática</span>
            <Input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              autoFocus
            />
          </label>
          <Button type="submit" disabled={!senha}>
            Ler projeto
          </Button>
          <p className="w-full text-xs text-muted">
            É a APP_SENHA cadastrada na Vercel. Fica salva neste navegador.
          </p>
        </form>
      )}

      {etapa === "lendo" && (
        <div className="mt-4 flex items-center gap-3 text-sm">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          Lendo <strong className="truncate">{arquivo?.name}</strong>… pode levar de 1 a 3 minutos.
        </div>
      )}

      {etapa === "ia" && leitura && (
        <ResultadoIA
          leitura={leitura}
          aviso={aviso}
          onAplicar={() => {
            onAplicar({
              paredes: leitura.paredes.map((p) => ({
                descricao: p.descricao,
                comprimento: arred(p.metro_linear),
                altura: arred(p.altura),
              })),
              lajes: leitura.lajes.map((l) => ({
                descricao: l.descricao,
                comprimento: 0,
                largura: 0,
                area: arred(l.area_m2),
              })),
              areaConstruida: leitura.area_construida_m2,
            });
            reiniciar();
          }}
        />
      )}

      {etapa === "dxf" && dxf && (
        <ResultadoDxf
          dxf={dxf}
          onAplicar={(l) => {
            onAplicar(l);
            reiniciar();
          }}
        />
      )}

      {erro && <p className="mt-3 text-sm text-danger">{erro}</p>}
    </Card>
  );
}

const arred = (v: number) => Math.round(v * 100) / 100;

function ResultadoIA({
  leitura,
  aviso,
  onAplicar,
}: {
  leitura: Leitura;
  aviso: string | null;
  onAplicar: () => void;
}) {
  const [rotulo, cor] = CONFIANCA[leitura.confianca];
  const vazio = leitura.paredes.length === 0 && leitura.lajes.length === 0;
  return (
    <div className="mt-4 space-y-4 text-sm">
      <p className={cn("font-semibold", cor)}>{rotulo}</p>

      {leitura.paredes.length > 0 && (
        <Tabela
          titulo="Paredes"
          linhas={leitura.paredes.map((p) => [
            p.descricao,
            `${num(p.metro_linear)} m × ${num(p.altura)} m`,
            `${num(p.metro_linear * p.altura)} m²`,
            p.origem,
          ])}
        />
      )}
      {leitura.lajes.length > 0 && (
        <Tabela
          titulo="Lajes"
          linhas={leitura.lajes.map((l) => [l.descricao, "", `${num(l.area_m2)} m²`, l.origem])}
        />
      )}
      <p>
        <span className="text-muted">Área construída:</span>{" "}
        <strong>
          {leitura.area_construida_m2 != null ? `${num(leitura.area_construida_m2)} m²` : "não encontrada"}
        </strong>
      </p>

      {(leitura.avisos.length > 0 || aviso) && (
        <div className="rounded-xl border border-warning/40 bg-surface p-3">
          <p className="mb-1 font-semibold text-warning">Confira</p>
          <ul className="list-disc space-y-0.5 pl-5">
            {aviso && <li>{aviso}</li>}
            {leitura.avisos.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </div>
      )}

      {!vazio && (
        <div>
          <Button onClick={onAplicar}>Usar no orçamento</Button>
          <p className="mt-1.5 text-xs text-muted">
            Substitui as paredes e lajes que estão na tela. Dá para corrigir tudo depois.
          </p>
        </div>
      )}
    </div>
  );
}

function Tabela({ titulo, linhas }: { titulo: string; linhas: string[][] }) {
  return (
    <div>
      <p className="mb-1 font-semibold">{titulo}</p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] border-collapse">
          <tbody>
            {linhas.map((l, i) => (
              <tr key={i} className="border-b border-border align-top">
                <td className="py-1.5 pr-2">{l[0]}</td>
                <td className="py-1.5 pr-2 text-right tabular-nums text-muted">{l[1]}</td>
                <td className="py-1.5 pr-2 text-right font-semibold tabular-nums">{l[2]}</td>
                <td className="py-1.5 text-xs text-muted">{l[3]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type Uso = "" | "parede" | "laje";

function ResultadoDxf({
  dxf,
  onAplicar,
}: {
  dxf: LeituraDxf;
  onAplicar: (l: Levantamento) => void;
}) {
  // Palpite: camadas com "PAR"/"WALL"/"ALV" no nome são paredes; "LAJE"/"SLAB", lajes.
  const [uso, setUso] = useState<Record<string, Uso>>(() =>
    Object.fromEntries(
      dxf.camadas.map((c) => [
        c.nome,
        /par|wall|alv/i.test(c.nome) ? "parede" : /laje|slab/i.test(c.nome) ? "laje" : "",
      ]),
    ),
  );
  const [altura, setAltura] = useState("2,8");
  const [duasLinhas, setDuasLinhas] = useState(true);
  const alturaNum = Number(altura.replace(",", ".")) || 0;
  const fatorLinhas = duasLinhas ? 0.5 : 1;

  const paredes = dxf.camadas.filter((c) => uso[c.nome] === "parede");
  const lajes = dxf.camadas.filter((c) => uso[c.nome] === "laje");

  if (dxf.camadas.length === 0) {
    return (
      <p className="mt-4 text-sm text-danger">
        Não achei linhas no desenho.
        {dxf.blocosIgnorados > 0 && " Parece que o desenho está todo dentro de blocos — explode os blocos no AutoCAD e salve o DXF de novo."}
      </p>
    );
  }

  return (
    <div className="mt-4 space-y-4 text-sm">
      <p className="text-muted">
        Unidade do desenho: <strong className="text-foreground">{dxf.unidade}</strong>. Marque
        quais camadas (layers) são paredes e quais são lajes.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] border-collapse">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted">
              <th className="py-1.5 font-medium">Camada</th>
              <th className="py-1.5 text-right font-medium">Linhas</th>
              <th className="py-1.5 text-right font-medium">Áreas fechadas</th>
              <th className="py-1.5 pl-3 font-medium">Usar como</th>
            </tr>
          </thead>
          <tbody>
            {dxf.camadas.map((c) => (
              <tr key={c.nome} className="border-b border-border">
                <td className="py-1.5">{c.nome}</td>
                <td className="py-1.5 text-right tabular-nums">{num(c.comprimento)} m</td>
                <td className="py-1.5 text-right tabular-nums">
                  {c.areaFechada ? `${num(c.areaFechada)} m²` : "—"}
                </td>
                <td className="py-1.5 pl-3">
                  <select
                    value={uso[c.nome]}
                    onChange={(e) => setUso({ ...uso, [c.nome]: e.target.value as Uso })}
                    className="rounded-lg border border-border-strong bg-surface px-2 py-1"
                    aria-label={`Uso da camada ${c.nome}`}
                  >
                    <option value="">—</option>
                    <option value="parede">Parede</option>
                    <option value="laje">Laje</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <label>
          <span className="mb-1.5 block font-medium">Altura das paredes (m)</span>
          <Input
            inputMode="decimal"
            value={altura}
            onChange={(e) => setAltura(e.target.value)}
            className="w-28"
          />
        </label>
        <label className="flex items-center gap-2 pb-3">
          <input
            type="checkbox"
            checked={duasLinhas}
            onChange={(e) => setDuasLinhas(e.target.checked)}
            className="h-4 w-4 accent-[var(--primary)]"
          />
          Paredes desenhadas com duas linhas (conta metade)
        </label>
      </div>

      {dxf.blocosIgnorados > 0 && (
        <p className="text-xs text-muted">
          {dxf.blocosIgnorados} bloco(s) do desenho não entram na soma (portas, janelas, móveis…).
          Se alguma parede estiver dentro de bloco, ela ficou de fora.
        </p>
      )}

      <div>
        <Button
          disabled={paredes.length === 0 && lajes.length === 0}
          onClick={() =>
            onAplicar({
              paredes: paredes.map((c) => ({
                descricao: `Camada ${c.nome}`,
                comprimento: arred(c.comprimento * fatorLinhas),
                altura: alturaNum,
              })),
              lajes: lajes.map((c) => ({
                descricao: `Camada ${c.nome}`,
                comprimento: 0,
                largura: 0,
                area: arred(c.areaFechada),
              })),
              areaConstruida: null,
            })
          }
        >
          Usar no orçamento
        </Button>
        <p className="mt-1.5 text-xs text-muted">
          Paredes: {num(paredes.reduce((a, c) => a + c.comprimento, 0) * fatorLinhas)} m lineares ·
          Lajes: {num(lajes.reduce((a, c) => a + c.areaFechada, 0))} m²
        </p>
      </div>
    </div>
  );
}
