"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Field, Input, Textarea } from "@/components/ui";
import { brl, num } from "@/lib/format";
import {
  PRECO_PAINEL_MAX,
  PRECO_PAINEL_MIN,
  calcularPainel,
  type CalculoPainel,
} from "@/lib/calculo";
import { salvar, type Status } from "@/lib/store";

/* Os campos numéricos ficam como texto enquanto o usuário digita ("2,8"). */
type ParedeUI = { descricao: string; comprimento: string; altura: string };
type LajeUI = { descricao: string; comprimento: string; largura: string };

const toNum = (s: string) => {
  const t = s.trim();
  if (!t) return 0;
  const v = Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
  return Number.isFinite(v) ? v : 0;
};
const toStr = (v: number) => (v ? String(v).replace(".", ",") : "");

export type EditorInicial = {
  id: string | null;
  numero: number | null;
  cliente: string;
  referencia: string;
  telefone: string;
  data: string;
  status: Status;
  observacoes: string;
  calculo: CalculoPainel;
};

export function Editor({ inicial }: { inicial: EditorInicial }) {
  const router = useRouter();
  const c0 = inicial.calculo;

  const [cliente, setCliente] = useState(inicial.cliente);
  const [referencia, setReferencia] = useState(inicial.referencia);
  const [telefone, setTelefone] = useState(inicial.telefone);
  const [data, setData] = useState(inicial.data);
  const [observacoes, setObservacoes] = useState(inicial.observacoes);

  const [paredes, setParedes] = useState<ParedeUI[]>(
    c0.paredes.map((p) => ({
      descricao: p.descricao,
      comprimento: toStr(p.comprimento),
      altura: toStr(p.altura),
    })),
  );
  const [lajes, setLajes] = useState<LajeUI[]>(
    c0.lajes.map((l) => ({
      descricao: l.descricao,
      comprimento: toStr(l.comprimento),
      largura: toStr(l.largura),
    })),
  );
  const [precoPainel, setPrecoPainel] = useState(toStr(c0.precoPainel));
  const [incluirCinza, setIncluirCinza] = useState(c0.incluirCinza);
  const [areaConstruida, setAreaConstruida] = useState(toStr(c0.areaConstruida));
  const [precoCinza, setPrecoCinza] = useState(toStr(c0.precoCinza));
  const [error, setError] = useState<string | null>(null);

  const calculo: CalculoPainel = {
    paredes: paredes.map((p) => ({
      descricao: p.descricao.trim(),
      comprimento: toNum(p.comprimento),
      altura: toNum(p.altura),
    })),
    lajes: lajes.map((l) => ({
      descricao: l.descricao.trim(),
      comprimento: toNum(l.comprimento),
      largura: toNum(l.largura),
    })),
    precoPainel: toNum(precoPainel),
    incluirCinza,
    areaConstruida: toNum(areaConstruida),
    precoCinza: toNum(precoCinza),
  };
  const r = calcularPainel(calculo);
  const preco = calculo.precoPainel;
  const precoForaDaFaixa =
    preco > 0 && (preco < PRECO_PAINEL_MIN || preco > PRECO_PAINEL_MAX);

  function onSalvar(depois: "lista" | "proposta") {
    if (!cliente.trim() && !referencia.trim()) {
      setError("Informe o cliente ou a obra.");
      return;
    }
    const id = salvar({
      id: inicial.id,
      cliente: cliente.trim(),
      referencia: referencia.trim(),
      telefone: telefone.trim(),
      data,
      status: inicial.status,
      observacoes: observacoes.trim(),
      // Linhas totalmente vazias não são guardadas.
      calculo: {
        ...calculo,
        paredes: calculo.paredes.filter((p) => p.descricao || p.comprimento),
        lajes: calculo.lajes.filter((l) => l.descricao || l.comprimento || l.largura),
      },
    });
    router.push(depois === "proposta" ? `/orcamento/imprimir?id=${id}` : "/");
  }

  return (
    <div className="space-y-6">
      <header>
        <Link href="/" className="text-sm font-semibold text-primary hover:underline">
          ← Orçamentos
        </Link>
        <h1 className="mt-2 text-2xl font-bold">
          {inicial.numero ? `Orçamento #${inicial.numero}` : "Novo orçamento"}
        </h1>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          {/* ------------------------------------------------- Cliente */}
          <Card className="grid gap-3 sm:grid-cols-2">
            <Field label="Cliente" htmlFor="cliente">
              <Input id="cliente" value={cliente} onChange={(e) => setCliente(e.target.value)} />
            </Field>
            <Field label="Telefone" htmlFor="telefone">
              <Input
                id="telefone"
                inputMode="tel"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
              />
            </Field>
            <Field label="Obra / endereço" htmlFor="referencia">
              <Input
                id="referencia"
                value={referencia}
                onChange={(e) => setReferencia(e.target.value)}
                placeholder="Ex.: Casa térrea — Lote 12"
              />
            </Field>
            <Field label="Data" htmlFor="data">
              <Input id="data" type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </Field>
          </Card>

          {/* ------------------------------------------------- Paredes */}
          <Card>
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h2 className="text-lg font-semibold">Paredes</h2>
              <p className="text-sm text-muted">
                {num(r.metroLinear)} m lineares ·{" "}
                <strong className="text-foreground">{num(r.m2Paredes)} m²</strong>
              </p>
            </div>
            <div className="space-y-2">
              <div className="hidden grid-cols-[1fr_110px_90px_90px_32px] gap-2 text-xs font-medium text-muted sm:grid">
                <span>Descrição</span>
                <span>Metro linear (m)</span>
                <span>Altura (m)</span>
                <span className="text-right">Área</span>
                <span />
              </div>
              {paredes.map((p, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[1fr_1fr_auto] items-center gap-2 border-b border-border pb-2 sm:grid-cols-[1fr_110px_90px_90px_32px] sm:border-0 sm:pb-0"
                >
                  <Input
                    aria-label="Descrição da parede"
                    placeholder="Ex.: Paredes externas"
                    value={p.descricao}
                    onChange={(e) => setParedes(set(paredes, i, { descricao: e.target.value }))}
                    className="col-span-2 sm:col-span-1"
                  />
                  <RemoveBtn
                    onClick={() => setParedes(paredes.filter((_, j) => j !== i))}
                    className="sm:order-last"
                  />
                  <Input
                    aria-label="Metro linear"
                    inputMode="decimal"
                    placeholder="m linear"
                    value={p.comprimento}
                    onChange={(e) => setParedes(set(paredes, i, { comprimento: e.target.value }))}
                  />
                  <Input
                    aria-label="Altura"
                    inputMode="decimal"
                    placeholder="altura"
                    value={p.altura}
                    onChange={(e) => setParedes(set(paredes, i, { altura: e.target.value }))}
                  />
                  <span className="text-right text-sm font-semibold tabular-nums">
                    {num(toNum(p.comprimento) * toNum(p.altura))} m²
                  </span>
                </div>
              ))}
            </div>
            <Button
              variant="secondary"
              size="sm"
              className="mt-3"
              onClick={() =>
                setParedes([
                  ...paredes,
                  // Repete a altura da última parede — normalmente é a mesma.
                  { descricao: "", comprimento: "", altura: paredes.at(-1)?.altura ?? "" },
                ])
              }
            >
              + Parede
            </Button>
          </Card>

          {/* --------------------------------------------------- Lajes */}
          <Card>
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h2 className="text-lg font-semibold">Lajes</h2>
              <p className="text-sm">
                <strong>{num(r.m2Lajes)} m²</strong>
              </p>
            </div>
            <div className="space-y-2">
              <div className="hidden grid-cols-[1fr_100px_100px_90px_32px] gap-2 text-xs font-medium text-muted sm:grid">
                <span>Descrição</span>
                <span>Comprimento (m)</span>
                <span>Largura (m)</span>
                <span className="text-right">Área</span>
                <span />
              </div>
              {lajes.map((l, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[1fr_1fr_auto] items-center gap-2 border-b border-border pb-2 sm:grid-cols-[1fr_100px_100px_90px_32px] sm:border-0 sm:pb-0"
                >
                  <Input
                    aria-label="Descrição da laje"
                    placeholder="Ex.: Laje térreo"
                    value={l.descricao}
                    onChange={(e) => setLajes(set(lajes, i, { descricao: e.target.value }))}
                    className="col-span-2 sm:col-span-1"
                  />
                  <RemoveBtn
                    onClick={() => setLajes(lajes.filter((_, j) => j !== i))}
                    className="sm:order-last"
                  />
                  <Input
                    aria-label="Comprimento"
                    inputMode="decimal"
                    placeholder="comprimento"
                    value={l.comprimento}
                    onChange={(e) => setLajes(set(lajes, i, { comprimento: e.target.value }))}
                  />
                  <Input
                    aria-label="Largura"
                    inputMode="decimal"
                    placeholder="largura"
                    value={l.largura}
                    onChange={(e) => setLajes(set(lajes, i, { largura: e.target.value }))}
                  />
                  <span className="text-right text-sm font-semibold tabular-nums">
                    {num(toNum(l.comprimento) * toNum(l.largura))} m²
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted">
              Já tem a área da laje? Coloque a área no comprimento e 1 na largura.
            </p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-3"
              onClick={() => setLajes([...lajes, { descricao: "", comprimento: "", largura: "" }])}
            >
              + Laje
            </Button>
          </Card>

          {/* -------------------------------------------- Preço painel */}
          <Card>
            <h2 className="mb-3 text-lg font-semibold">Preço do m² de painel</h2>
            <div className="flex flex-wrap items-center gap-4">
              <input
                type="range"
                min={PRECO_PAINEL_MIN}
                max={PRECO_PAINEL_MAX}
                step={5}
                value={Math.min(Math.max(preco, PRECO_PAINEL_MIN), PRECO_PAINEL_MAX)}
                onChange={(e) => setPrecoPainel(e.target.value)}
                className="min-w-40 flex-1 accent-[var(--primary)]"
                aria-label="Preço do m² de painel"
              />
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted">R$</span>
                <Input
                  inputMode="decimal"
                  value={precoPainel}
                  onChange={(e) => setPrecoPainel(e.target.value)}
                  className="w-24"
                  aria-label="Preço do m² de painel (R$)"
                />
                <span className="text-sm text-muted">/m²</span>
              </div>
            </div>
            <p className="mt-2 text-xs text-muted">
              Faixa usual: {brl(PRECO_PAINEL_MIN)} a {brl(PRECO_PAINEL_MAX)}.
              {precoForaDaFaixa && (
                <span className="font-semibold text-warning"> Valor fora da faixa.</span>
              )}
            </p>
          </Card>

          {/* --------------------------------------------- Parte cinza */}
          <Card>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={incluirCinza}
                onChange={(e) => setIncluirCinza(e.target.checked)}
                className="h-4 w-4 accent-[var(--primary)]"
              />
              <span className="text-lg font-semibold">Incluir parte cinza</span>
            </label>
            {incluirCinza && (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <Field label="Área construída (m²)" htmlFor="area_construida">
                  <Input
                    id="area_construida"
                    inputMode="decimal"
                    value={areaConstruida}
                    onChange={(e) => setAreaConstruida(e.target.value)}
                    placeholder="0"
                  />
                </Field>
                <Field label="Valor por m² (R$)" htmlFor="preco_cinza">
                  <Input
                    id="preco_cinza"
                    inputMode="decimal"
                    value={precoCinza}
                    onChange={(e) => setPrecoCinza(e.target.value)}
                  />
                </Field>
              </div>
            )}
          </Card>

          <Card>
            <Field
              label="Observações"
              htmlFor="observacoes"
              hint="Aparecem na proposta (prazo, forma de pagamento, o que não está incluso…)."
            >
              <Textarea
                id="observacoes"
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
              />
            </Field>
          </Card>
        </div>

        {/* --------------------------------------------------- Resumo */}
        <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <Card>
            <h2 className="mb-3 text-lg font-semibold">Resumo</h2>
            <dl className="space-y-1.5 text-sm">
              <Linha label="Paredes" valor={`${num(r.m2Paredes)} m²`} />
              <Linha label="Lajes" valor={`${num(r.m2Lajes)} m²`} />
              <Linha label="Total de painéis" valor={`${num(r.m2Paineis)} m²`} forte />
              <Linha label={`× ${brl(preco)}/m²`} valor={brl(r.valorPaineis)} forte />
              {incluirCinza && (
                <>
                  <div className="my-2 border-t border-border" />
                  <Linha
                    label={`Parte cinza (${num(calculo.areaConstruida)} m² × ${brl(calculo.precoCinza)})`}
                    valor={brl(r.valorCinza)}
                    forte
                  />
                </>
              )}
            </dl>
            <div className="mt-4 rounded-xl bg-primary p-4 text-primary-foreground">
              <p className="text-xs opacity-80">Total do orçamento</p>
              <p className="text-2xl font-bold">{brl(r.total)}</p>
            </div>
          </Card>
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="grid gap-2">
            <Button onClick={() => onSalvar("lista")}>Salvar orçamento</Button>
            <Button variant="secondary" onClick={() => onSalvar("proposta")}>
              Salvar e gerar proposta
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function set<T>(arr: T[], i: number, patch: Partial<T>): T[] {
  return arr.map((x, j) => (j === i ? { ...x, ...patch } : x));
}

function RemoveBtn({ onClick, className }: { onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Remover linha"
      className={`grid h-8 w-8 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-danger ${className ?? ""}`}
    >
      ✕
    </button>
  );
}

function Linha({ label, valor, forte }: { label: string; valor: string; forte?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className={forte ? "font-semibold tabular-nums" : "tabular-nums"}>{valor}</dd>
    </div>
  );
}
