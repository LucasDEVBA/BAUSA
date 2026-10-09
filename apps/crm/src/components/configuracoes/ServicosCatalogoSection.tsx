"use client";

import { useEffect, useState, useTransition } from "react";
import { ListPlus, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button, Card } from "@/components/ui";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { listarCatalogoServicos, salvarCatalogoServicos } from "@/lib/actions/financeiro-contrato";
import type { ServicoCatalogo } from "@/lib/financeiro/schemas";

/**
 * T18a — catálogo de serviços adicionais (antes: array fixo SERVICOS_AVULSOS no
 * código). Alimenta os atalhos "+ TOEFL…" do contrato e do modal de valor do
 * deal. Editar aqui NÃO muda contratos existentes (o item grava o valor do dia).
 */
const chaveDe = (nome: string) =>
  nome.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40) || "servico";

export function ServicosCatalogoSection() {
  const [lista, setLista] = useState<ServicoCatalogo[] | null>(null);
  const [inicial, setInicial] = useState("[]");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let vivo = true;
    listarCatalogoServicos()
      .then((l) => {
        if (!vivo) return;
        setLista(l);
        setInicial(JSON.stringify(l));
      })
      .catch(() => vivo && setLista([]));
    return () => {
      vivo = false;
    };
  }, []);

  if (lista === null) return <Card><p className="text-xs text-muted-foreground">Carregando serviços…</p></Card>;
  const dirty = JSON.stringify(lista) !== inicial;
  const atualizar = (i: number, p: Partial<ServicoCatalogo>) =>
    setLista((l) => (l ?? []).map((s, j) => (j === i ? { ...s, ...p } : s)));

  const salvar = () =>
    startTransition(async () => {
      // chave estável: nasce do nome no 1º salvamento e não muda depois
      const normalizada = lista.map((s) => ({ ...s, chave: s.chave || chaveDe(s.nome) }));
      const r = await salvarCatalogoServicos(normalizada);
      if (!r.success) return void toast.error(r.error);
      toast.success("Catálogo de serviços salvo");
      setLista(normalizada);
      setInicial(JSON.stringify(normalizada));
    });

  return (
    <Card>
      <div className="mb-3 flex items-start gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><ListPlus aria-hidden className="size-4" /></span>
        <div>
          <h3 className="text-sm font-semibold text-foreground">Serviços adicionais sugeridos</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">Atalhos ao montar o contrato de cada aluno (TOEFL, inglês, tradução…). Mudar aqui não altera contratos já feitos.</p>
        </div>
      </div>
      <ul className="space-y-2">
        {lista.map((s, i) => (
          <li key={s.chave || `novo-${i}`} className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[1fr_10rem_auto_auto] sm:items-center">
            <input aria-label="Nome do serviço" value={s.nome} onChange={(e) => atualizar(i, { nome: e.target.value })}
              className="h-10 rounded-lg border border-input bg-card px-3 text-base sm:h-9 sm:text-sm" />
            <MoneyInput aria-label={`Valor de ${s.nome}`} value={s.valor} onValueChange={(v) => atualizar(i, { valor: v ?? 0 })} />
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <input type="checkbox" checked={s.ativo} onChange={(e) => atualizar(i, { ativo: e.target.checked })} className="size-4" />Ativo
            </label>
            <Button variant="ghost" size="icon" aria-label={`Remover ${s.nome}`} onClick={() => setLista((l) => (l ?? []).filter((_, j) => j !== i))}><Trash2 /></Button>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <Button variant="secondary" size="sm" onClick={() => setLista((l) => [...(l ?? []), { chave: "", nome: "", valor: 0, ativo: true }])}><Plus />Adicionar serviço</Button>
        <Button size="sm" className="ml-auto" onClick={salvar} disabled={!dirty || pending}>{pending ? <Loader2 className="animate-spin" /> : <Save />}Salvar</Button>
      </div>
    </Card>
  );
}
