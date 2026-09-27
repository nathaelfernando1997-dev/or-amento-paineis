"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { calculoVazio } from "@/lib/calculo";
import { hoje, useOrcamentos } from "@/lib/store";
import { Editor } from "./editor";

export default function OrcamentoPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Carregando…</p>}>
      <Conteudo />
    </Suspense>
  );
}

function Conteudo() {
  const id = useSearchParams().get("id");
  const lista = useOrcamentos();
  if (!lista) return <p className="text-sm text-muted">Carregando…</p>;

  const o = id ? lista.find((x) => x.id === id) : undefined;
  if (id && !o) {
    return (
      <p className="text-sm">
        Orçamento não encontrado neste navegador.{" "}
        <Link href="/" className="font-semibold text-primary">
          Voltar
        </Link>
      </p>
    );
  }

  return (
    <Editor
      key={o?.id ?? "novo"}
      inicial={
        o ?? {
          id: null,
          numero: null,
          cliente: "",
          referencia: "",
          telefone: "",
          data: hoje(),
          status: "pendente",
          observacoes: "",
          calculo: calculoVazio(),
        }
      }
    />
  );
}
