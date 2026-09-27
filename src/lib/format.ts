export function brl(v: number | null | undefined): string {
  return (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function num(v: number, casas = 2): string {
  return v.toLocaleString("pt-BR", { maximumFractionDigits: casas });
}

export function dataBR(v: string | null | undefined): string {
  if (!v) return "—";
  const d = new Date(v.length <= 10 ? v + "T00:00:00" : v);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR");
}
