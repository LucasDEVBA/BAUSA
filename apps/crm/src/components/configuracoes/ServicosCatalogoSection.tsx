"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { AlertTriangle, ListPlus, Loader2, Plus, Save, Trash2 } from "lucide-react";
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

/** Linha da tela: id local estável (a chave só nasce no 1º salvamento). */
interface LinhaServico extends ServicoCatalogo {
  idLocal: string;
  valorInvalido: boolean;
}

let sequencia = 0;
const novaLinha = (s: ServicoCatalogo): LinhaServico => ({ ...s, idLocal: `srv-${++sequencia}`, valorInvalido: false });
const semMetadados = (l: LinhaServico[]): ServicoCatalogo[] =>
  l.map(({ chave, nome, valor, ativo }) => ({ chave, nome, valor, ativo }));

export function ServicosCatalogoSection() {
  const [lista, setLista] = useState<LinhaServico[] | null>(null);
  const [inicial, setInicial] = useState("[]");
  // Falha de leitura ≠ catálogo vazio: sem isso o Salvar seguinte sobrescrevia o catálogo inteiro.
  const [erroCarga, setErroCarga] = useState(false);
  const [pending, startTransition] = useTransition();

  const aplicarCarga = useCallback((l: ServicoCatalogo[]) => {
    setErroCarga(false);
    setLista(l.map(novaLinha));
    setInicial(JSON.stringify(l));
  }, []);

  const recarregar = () => {
    setErroCarga(false);
    setLista(null);
    listarCatalogoServicos()
      .then(aplicarCarga)
      .catch((err: unknown) => {
        console.error({ level: "error", action: "catalogo_servicos_carga", error: String(err) });
        setErroCarga(true);
      });
  };

  useEffect(() => {
    let vivo = true;
    listarCatalogoServicos()
      .then((l) => vivo && aplicarCarga(l))
      .catch((err: unknown) => {
        console.error({ level: "error", action: "catalogo_servicos_carga", error: String(err) });
        if (vivo) setErroCarga(true);
      });
    return () => {
      vivo = false;
    };
  }, [aplicarCarga]);

  if (erroCarga) {
    return (
      <Card>
        <div role="alert" className="flex flex-wrap items-center gap-2 text-xs text-sys-red">
          <AlertTriangle aria-hidden className="size-4" />
          Não foi possível carregar os serviços adicionais — nada foi alterado.
          <Button size="sm" variant="secondary" className="ml-auto" onClick={recarregar}>Tentar de novo</Button>
        </div>
      </Card>
    );
  }
  if (lista === null) return <Card><p className="text-xs text-muted-foreground">Carregando serviços…</p></Card>;

  const dirty = JSON.stringify(semMetadados(lista)) !== inicial;
  const invalido = lista.some((s) => s.valorInvalido);
  const motivo = invalido ? "Valor inválido em um serviço — use o formato 7.800,00." : null;
  const atualizar = (idLocal: string, p: Partial<LinhaServico>) =>
    setLista((l) => (l ?? []).map((s) => (s.idLocal === idLocal ? { ...s, ...p } : s)));

  const salvar = () =>
    startTransition(async () => {
      try {
        // chave estável: nasce do nome no 1º salvamento e não muda depois
        const normalizada = semMetadados(lista).map((s) => ({ ...s, chave: s.chave || chaveDe(s.nome) }));
        const r = await salvarCatalogoServicos(normalizada);
        if (!r.success) return void toast.error(r.error);
        toast.success("Catálogo de serviços salvo");
        aplicarCarga(normalizada);
      } catch (err) {
        console.error({ level: "error", action: "catalogo_servicos_salvar", error: String(err) });
        toast.error("Não foi possível salvar o catálogo. Tente de novo.");
      }
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
        {lista.map((s) => (
          <li key={s.idLocal} className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[1fr_10rem_auto_auto] sm:items-center">
            <input aria-label="Nome do serviço" value={s.nome} onChange={(e) => atualizar(s.idLocal, { nome: e.target.value })}
              className="h-10 rounded-lg border border-input bg-card px-3 text-base sm:h-9 sm:text-sm" />
            <MoneyInput
              aria-label={`Valor de ${s.nome || "novo serviço"}`}
              value={s.valor}
              onValueChange={(v, { invalido: inv }) =>
                // inválido não vira 0: mantém o valor anterior e trava o Salvar
                atualizar(s.idLocal, inv ? { valorInvalido: true } : { valor: v ?? 0, valorInvalido: false })
              }
            />
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <input type="checkbox" checked={s.ativo} onChange={(e) => atualizar(s.idLocal, { ativo: e.target.checked })} className="size-4" />Ativo
            </label>
            <Button variant="ghost" size="icon" aria-label={`Remover ${s.nome || "novo serviço"}`} onClick={() => setLista((l) => (l ?? []).filter((x) => x.idLocal !== s.idLocal))}><Trash2 /></Button>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <Button variant="secondary" size="sm" onClick={() => setLista((l) => [...(l ?? []), novaLinha({ chave: "", nome: "", valor: 0, ativo: true })])}><Plus />Adicionar serviço</Button>
        {motivo && <p id="catalogo-servicos-motivo" className="text-[11px] text-muted-foreground">{motivo}</p>}
        <Button size="sm" className="ml-auto" onClick={salvar} disabled={!dirty || pending || invalido}
          aria-describedby={motivo ? "catalogo-servicos-motivo" : undefined}>
          {pending ? <Loader2 className="animate-spin" /> : <Save />}Salvar
        </Button>
      </div>
    </Card>
  );
}
