"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Button, Card, Input, LinkButton } from "@/components/ui";
import { calcularPainel } from "@/lib/calculo";
import { brl, dataBR, num } from "@/lib/format";
import {
  STATUS_LABEL,
  duplicar,
  exportarJSON,
  importarJSON,
  remover,
  setStatus,
  useOrcamentos,
  type Status,
} from "@/lib/store";
import { cn } from "@/lib/cn";

const STATUS_COR: Record<Status, string> = {
  pendente: "text-warning",
  aprovado: "text-success",
  recusado: "text-danger",
};

export default function Home() {
  const lista = useOrcamentos();
  const [busca, setBusca] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const arquivo = useRef<HTMLInputElement>(null);

  const q = busca.trim().toLowerCase();
  const filtrados = (lista ?? []).filter(
    (o) =>
      !q ||
      o.cliente.toLowerCase().includes(q) ||
      o.referencia.toLowerCase().includes(q) ||
      String(o.numero) === q,
  );
  const soma = (s: Status) =>
    (lista ?? [])
      .filter((o) => o.status === s)
      .reduce((a, o) => a + calcularPainel(o.calculo).total, 0);

  function exportar() {
    const blob = new Blob([exportarJSON()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `orcamentos-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function importar(f: File) {
    try {
      const n = importarJSON(await f.text());
      setMsg(`${n} orçamento(s) importado(s).`);
    } catch {
      setMsg("Não consegui ler esse arquivo. Use um backup exportado por aqui.");
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Orçamentos de painéis</h1>
          <p className="mt-1 text-sm text-muted">
            {lista ? `${lista.length} orçamento(s)` : "Carregando…"}
          </p>
        </div>
        <LinkButton href="/orcamento">+ Novo orçamento</LinkButton>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Resumo label="Pendentes" valor={brl(soma("pendente"))} />
        <Resumo label="Aprovados" valor={brl(soma("aprovado"))} cor="text-success" />
        <Resumo
          label="Taxa de aprovação"
          valor={
            lista?.length
              ? `${Math.round((lista.filter((o) => o.status === "aprovado").length / lista.length) * 100)}%`
              : "—"
          }
        />
      </div>

      {lista && lista.length > 0 && (
        <Input
          placeholder="Buscar por cliente, obra ou nº"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="max-w-sm"
        />
      )}

      {lista && lista.length === 0 && (
        <Card className="py-12 text-center">
          <p className="text-lg font-semibold">Nenhum orçamento ainda</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted">
            Lance as paredes (metro linear × altura) e as lajes do projeto. O
            app calcula o m² de painéis, multiplica pelo preço do m² e soma a
            parte cinza.
          </p>
          <LinkButton href="/orcamento" className="mt-5">
            Fazer o primeiro orçamento
          </LinkButton>
        </Card>
      )}

      <div className="space-y-3">
        {filtrados.map((o) => {
          const r = calcularPainel(o.calculo);
          return (
            <Card key={o.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <Link href={`/orcamento?id=${o.id}`} className="min-w-0 flex-1">
                  <p className="font-semibold">
                    <span className="text-muted">#{o.numero}</span>{" "}
                    {o.cliente || o.referencia || "Sem nome"}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    {[o.cliente && o.referencia, dataBR(o.data)].filter(Boolean).join(" · ")}
                  </p>
                  <p className="mt-2 text-xl font-bold">{brl(r.total)}</p>
                  <p className="text-xs text-muted">
                    {num(r.m2Paineis)} m² de painéis · {brl(r.valorPaineis)}
                    {o.calculo.incluirCinza && ` + cinza ${brl(r.valorCinza)}`}
                  </p>
                </Link>
                <select
                  value={o.status}
                  onChange={(e) => setStatus(o.id, e.target.value as Status)}
                  aria-label="Status"
                  className={cn(
                    "rounded-full border border-border-strong bg-surface px-2.5 py-1 text-xs font-semibold",
                    STATUS_COR[o.status],
                  )}
                >
                  {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-border pt-3 text-xs font-semibold">
                <Link href={`/orcamento?id=${o.id}`} className="text-primary hover:underline">
                  Editar
                </Link>
                <Link href={`/orcamento/imprimir?id=${o.id}`} className="text-primary hover:underline">
                  Proposta / PDF
                </Link>
                <button onClick={() => duplicar(o.id)} className="text-primary hover:underline">
                  Duplicar
                </button>
                <button
                  onClick={() => confirm(`Excluir o orçamento #${o.numero}?`) && remover(o.id)}
                  className="ml-auto text-danger hover:underline"
                >
                  Excluir
                </button>
              </div>
            </Card>
          );
        })}
      </div>

      <footer className="flex flex-wrap items-center gap-2 border-t border-border pt-4 text-sm">
        <span className="mr-auto text-xs text-muted">
          Os orçamentos ficam salvos neste navegador. Faça backup de vez em quando.
        </span>
        <Button variant="secondary" size="sm" onClick={exportar} disabled={!lista?.length}>
          Exportar backup
        </Button>
        <Button variant="secondary" size="sm" onClick={() => arquivo.current?.click()}>
          Importar backup
        </Button>
        <input
          ref={arquivo}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) importar(f);
            e.target.value = "";
          }}
        />
        {msg && <p className="w-full text-xs text-muted">{msg}</p>}
      </footer>
    </div>
  );
}

function Resumo({ label, valor, cor }: { label: string; valor: string; cor?: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className={cn("mt-1 text-lg font-bold sm:text-xl", cor)}>{valor}</p>
    </Card>
  );
}
