import { useSyncExternalStore } from "react";
import { parseCalculo, type CalculoPainel } from "./calculo";

/**
 * Orçamentos guardados no próprio navegador (localStorage).
 * Sem login e sem servidor — use Exportar/Importar pra fazer backup ou
 * levar os orçamentos pra outro aparelho.
 */

export type Status = "pendente" | "aprovado" | "recusado";

export const STATUS_LABEL: Record<Status, string> = {
  pendente: "Pendente",
  aprovado: "Aprovado",
  recusado: "Recusado",
};

export interface Orcamento {
  id: string;
  numero: number;
  cliente: string;
  referencia: string; // obra / endereço
  telefone: string;
  data: string; // YYYY-MM-DD
  status: Status;
  observacoes: string;
  calculo: CalculoPainel;
  atualizadoEm: string;
}

const KEY = "orcamentos-paineis:v1";
const listeners = new Set<() => void>();
let cache: Orcamento[] | null = null;

function ler(): Orcamento[] {
  if (cache) return cache;
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    cache = Array.isArray(raw) ? raw.map(normalizar).filter(Boolean) as Orcamento[] : [];
  } catch {
    cache = [];
  }
  return cache;
}

function gravar(lista: Orcamento[]) {
  cache = lista;
  try {
    localStorage.setItem(KEY, JSON.stringify(lista));
  } catch {
    // Armazenamento cheio/bloqueado: mantém em memória nesta aba.
  }
  listeners.forEach((l) => l());
}

function normalizar(o: unknown): Orcamento | null {
  if (!o || typeof o !== "object") return null;
  const r = o as Partial<Orcamento>;
  const calculo = parseCalculo(r.calculo);
  if (!r.id || !calculo) return null;
  return {
    id: String(r.id),
    numero: Number(r.numero) || 0,
    cliente: String(r.cliente ?? ""),
    referencia: String(r.referencia ?? ""),
    telefone: String(r.telefone ?? ""),
    data: String(r.data ?? hoje()),
    status: r.status && r.status in STATUS_LABEL ? r.status : "pendente",
    observacoes: String(r.observacoes ?? ""),
    calculo,
    atualizadoEm: String(r.atualizadoEm ?? new Date().toISOString()),
  };
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null;
      cb();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

/** Lista de orçamentos; `null` enquanto renderiza no servidor. */
export function useOrcamentos(): Orcamento[] | null {
  return useSyncExternalStore(subscribe, ler, () => null);
}

export function hoje() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

export function salvar(o: Omit<Orcamento, "id" | "numero" | "atualizadoEm"> & { id?: string | null }): string {
  const lista = ler();
  const agora = new Date().toISOString();
  if (o.id && lista.some((x) => x.id === o.id)) {
    gravar(lista.map((x) => (x.id === o.id ? { ...x, ...o, id: x.id, atualizadoEm: agora } : x)));
    return o.id;
  }
  const id = crypto.randomUUID();
  const numero = lista.reduce((m, x) => Math.max(m, x.numero), 0) + 1;
  gravar([{ ...o, id, numero, atualizadoEm: agora }, ...lista]);
  return id;
}

export function setStatus(id: string, status: Status) {
  gravar(ler().map((x) => (x.id === id ? { ...x, status } : x)));
}

export function remover(id: string) {
  gravar(ler().filter((x) => x.id !== id));
}

export function duplicar(id: string): string | null {
  const o = ler().find((x) => x.id === id);
  if (!o) return null;
  return salvar({
    ...o,
    id: null,
    referencia: o.referencia ? `${o.referencia} (cópia)` : "",
    status: "pendente",
    data: hoje(),
  });
}

export function exportarJSON(): string {
  return JSON.stringify(ler(), null, 2);
}

/** Junta os orçamentos do arquivo com os atuais (mesmo id = substitui). */
export function importarJSON(texto: string): number {
  const raw = JSON.parse(texto);
  if (!Array.isArray(raw)) throw new Error("Arquivo inválido.");
  const novos = raw.map(normalizar).filter(Boolean) as Orcamento[];
  const ids = new Set(novos.map((o) => o.id));
  gravar([...novos, ...ler().filter((o) => !ids.has(o.id))]);
  return novos.length;
}

/* ------------------------------------------------ Dados da empresa --- */
/* Cabeçalho da proposta impressa. */

export interface Empresa {
  nome: string;
  contato: string;
}

const KEY_EMPRESA = "orcamentos-paineis:empresa";
const VAZIA: Empresa = { nome: "", contato: "" };
let cacheEmpresa: Empresa | null = null;

function lerEmpresa(): Empresa {
  if (cacheEmpresa) return cacheEmpresa;
  try {
    const r = JSON.parse(localStorage.getItem(KEY_EMPRESA) ?? "{}");
    cacheEmpresa = { nome: String(r.nome ?? ""), contato: String(r.contato ?? "") };
  } catch {
    cacheEmpresa = VAZIA;
  }
  return cacheEmpresa;
}

export function useEmpresa(): Empresa {
  return useSyncExternalStore(subscribe, lerEmpresa, () => VAZIA);
}

export function salvarEmpresa(e: Empresa) {
  cacheEmpresa = e;
  try {
    localStorage.setItem(KEY_EMPRESA, JSON.stringify(e));
  } catch {}
  listeners.forEach((l) => l());
}
