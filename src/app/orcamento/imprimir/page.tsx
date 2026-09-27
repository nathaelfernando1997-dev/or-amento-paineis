"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button, Card, Field, Input } from "@/components/ui";
import { areaLaje, areaParede, calcularPainel } from "@/lib/calculo";
import { brl, dataBR, num } from "@/lib/format";
import { salvarEmpresa, useEmpresa, useOrcamentos } from "@/lib/store";

export default function ImprimirPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Carregando…</p>}>
      <Proposta />
    </Suspense>
  );
}

function Proposta() {
  const id = useSearchParams().get("id");
  const lista = useOrcamentos();
  const empresa = useEmpresa();
  if (!lista) return <p className="text-sm text-muted">Carregando…</p>;

  const o = lista.find((x) => x.id === id);
  if (!o) {
    return (
      <p className="text-sm">
        Orçamento não encontrado.{" "}
        <Link href="/" className="font-semibold text-primary">
          Voltar
        </Link>
      </p>
    );
  }

  const c = o.calculo;
  const r = calcularPainel(c);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="no-print space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Link href={`/orcamento?id=${o.id}`} className="text-sm font-semibold text-primary hover:underline">
            ← Editar orçamento
          </Link>
          <Button className="ml-auto" onClick={() => window.print()}>
            Imprimir / salvar PDF
          </Button>
        </div>
        <Card className="grid gap-3 sm:grid-cols-2">
          <Field label="Nome da sua empresa" htmlFor="empresa_nome">
            <Input
              id="empresa_nome"
              value={empresa.nome}
              onChange={(e) => salvarEmpresa({ ...empresa, nome: e.target.value })}
            />
          </Field>
          <Field label="Contato (telefone, e-mail, CNPJ…)" htmlFor="empresa_contato">
            <Input
              id="empresa_contato"
              value={empresa.contato}
              onChange={(e) => salvarEmpresa({ ...empresa, contato: e.target.value })}
            />
          </Field>
        </Card>
      </div>

      <article className="rounded-xl border border-border bg-surface p-6 text-sm sm:p-10 print:border-0 print:p-0">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-4">
          <div>
            <p className="text-xl font-bold">{empresa.nome || "Orçamento"}</p>
            {empresa.contato && <p className="text-muted">{empresa.contato}</p>}
          </div>
          <div className="text-right">
            <p className="font-semibold">Orçamento nº {o.numero}</p>
            <p className="text-muted">{dataBR(o.data)}</p>
          </div>
        </header>

        <section className="mt-4 grid gap-1">
          {o.cliente && (
            <p>
              <span className="text-muted">Cliente:</span> {o.cliente}
              {o.telefone && ` · ${o.telefone}`}
            </p>
          )}
          {o.referencia && (
            <p>
              <span className="text-muted">Obra:</span> {o.referencia}
            </p>
          )}
        </section>

        <h2 className="mt-6 mb-2 font-semibold">Painéis</h2>
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted">
              <th className="py-1.5 font-medium">Item</th>
              <th className="py-1.5 text-right font-medium">Medidas</th>
              <th className="py-1.5 text-right font-medium">Área</th>
            </tr>
          </thead>
          <tbody>
            {c.paredes.map((p, i) => (
              <tr key={`p${i}`} className="border-b border-border">
                <td className="py-1.5">Parede{p.descricao && ` — ${p.descricao}`}</td>
                <td className="py-1.5 text-right tabular-nums">
                  {num(p.comprimento)} m × {num(p.altura)} m
                </td>
                <td className="py-1.5 text-right tabular-nums">{num(areaParede(p))} m²</td>
              </tr>
            ))}
            {c.lajes.map((l, i) => (
              <tr key={`l${i}`} className="border-b border-border">
                <td className="py-1.5">Laje{l.descricao && ` — ${l.descricao}`}</td>
                <td className="py-1.5 text-right tabular-nums">
                  {num(l.comprimento)} m × {num(l.largura)} m
                </td>
                <td className="py-1.5 text-right tabular-nums">{num(areaLaje(l))} m²</td>
              </tr>
            ))}
            <tr className="font-semibold">
              <td className="py-2" colSpan={2}>
                Total de painéis
              </td>
              <td className="py-2 text-right tabular-nums">{num(r.m2Paineis)} m²</td>
            </tr>
          </tbody>
        </table>

        <h2 className="mt-6 mb-2 font-semibold">Valores</h2>
        <dl className="space-y-1.5">
          <Linha
            label={`Painéis: ${num(r.m2Paineis)} m² × ${brl(c.precoPainel)}/m²`}
            valor={brl(r.valorPaineis)}
          />
          {c.incluirCinza && (
            <Linha
              label={`Parte cinza: ${num(c.areaConstruida)} m² × ${brl(c.precoCinza)}/m²`}
              valor={brl(r.valorCinza)}
            />
          )}
        </dl>
        <div className="mt-3 flex items-baseline justify-between border-t-2 border-foreground pt-3 text-lg font-bold">
          <span>Total</span>
          <span className="tabular-nums">{brl(r.total)}</span>
        </div>

        {o.observacoes && (
          <>
            <h2 className="mt-6 mb-2 font-semibold">Observações</h2>
            <p className="whitespace-pre-wrap">{o.observacoes}</p>
          </>
        )}
      </article>
    </div>
  );
}

function Linha({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt>{label}</dt>
      <dd className="tabular-nums">{valor}</dd>
    </div>
  );
}
