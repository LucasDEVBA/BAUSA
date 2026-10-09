"use client";

import { useId, useState } from "react";
import { Loader2, Plus, Receipt, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge, Button, useConfirm } from "@/components/ui";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { FinModal } from "@/components/financeiro/contrato/FinModal";
import { lancarCustoAluno, removerCustoAluno } from "@/lib/actions/financeiro-contrato";
import { formatarMoeda, margemAluno } from "@/lib/financeiro/calculo.mjs";
import {
  CATEGORIA_CUSTO_ALUNO_LABEL,
  CATEGORIAS_CUSTO_ALUNO,
  hojeBRT,
  type CategoriaCustoAluno,
} from "@/lib/financeiro/schemas";
import type { ContratoCompleto } from "@/types/contrato";

/**
 * T18b — custo INTERNO da BAU com este aluno (psicóloga, taxas de escola,
 * testes, tradução, viagem…). Reusa o livro-razão de despesas
 * (despesas.contrato_id): entra no DRE como saída e aqui como margem do aluno.
 * Psicóloga incluída e ainda não lançada aparece como ESTIMADA (custo_psicologa).
 */
export function CustosAlunoPanel({ dados, onAlterado }: { dados: ContratoCompleto; onAlterado: () => void }) {
  const [aberto, setAberto] = useState(false);
  const confirm = useConfirm();
  const c = dados.contrato;
  if (!c || c.plano === null) return null; // margem só faz sentido com valor do contrato definido

  const m = margemAluno({
    valorTotal: c.valor_total,
    custos: dados.custos.map((x) => ({ valor: x.valor_brl, categoria: x.categoria, status: x.status })),
    incluiPsicologa: c.inclui_psicologa,
    custoPsicologa: c.custo_psicologa ?? 0,
  });

  const remover = async (id: string) => {
    if (!(await confirm({ title: "Remover este custo?", description: "Sai do DRE e da margem do aluno.", tone: "danger", confirmLabel: "Remover" }))) return;
    const r = await removerCustoAluno(id, c.id);
    if (r.success) {
      toast.success("Custo removido");
      onAlterado();
    } else toast.error(r.error);
  };

  return (
    <section aria-labelledby="ctr-custos" className="rounded-xl border border-border/70 bg-card/60 p-3 sm:p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h3 id="ctr-custos" className="text-sm font-semibold text-foreground">Custos do aluno e margem</h3>
        <Badge tone={m.margemPct !== null && m.margemPct >= 50 ? "green" : m.margemPct !== null && m.margemPct >= 30 ? "orange" : "red"} size="sm">
          Margem {m.margemPct === null ? "—" : `${m.margemPct}%`}
        </Badge>
        <Button size="sm" variant="secondary" className="ml-auto" onClick={() => setAberto(true)}><Plus />Lançar custo</Button>
      </div>
      <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        <div><dt className="text-muted-foreground">Receita</dt><dd className="font-semibold tabular-nums">{formatarMoeda(m.receita)}</dd></div>
        <div><dt className="text-muted-foreground">Custos lançados</dt><dd className="font-semibold tabular-nums">{formatarMoeda(m.custosLancados)}</dd></div>
        <div><dt className="text-muted-foreground">Psicóloga (estimada)</dt><dd className="font-semibold tabular-nums">{formatarMoeda(m.psicologaEstimada)}</dd></div>
        <div><dt className="text-muted-foreground">Margem direta</dt><dd className="font-semibold tabular-nums text-sys-green">{formatarMoeda(m.margem)}</dd></div>
      </dl>
      <p className="mt-1 text-[10px] text-label-tertiary">Margem direta = receita contratada − custos deste aluno. Não inclui rateio de custos fixos.</p>
      {dados.custos.length > 0 && (
        <ul className="mt-2 divide-y divide-border/60 text-xs">
          {dados.custos.map((x) => (
            <li key={x.id} className="flex items-center gap-2 py-1.5">
              <span className="min-w-0 flex-1 truncate text-foreground">{x.descricao}</span>
              <Badge size="sm" tone="neutral">{CATEGORIA_CUSTO_ALUNO_LABEL[x.categoria as CategoriaCustoAluno] ?? x.categoria}</Badge>
              <span className="shrink-0 tabular-nums">{formatarMoeda(x.valor_brl)}</span>
              <span className="hidden shrink-0 text-label-tertiary sm:inline">{x.status === "pago" ? "pago" : "previsto"}</span>
              <Button size="icon" variant="ghost" aria-label={`Remover custo ${x.descricao}`} onClick={() => void remover(x.id)}><Trash2 /></Button>
            </li>
          ))}
        </ul>
      )}
      {aberto && <LancarCustoModal contratoId={c.id} athleteName={dados.atletaNome ?? ""} onFechar={() => setAberto(false)} onFeito={() => { setAberto(false); onAlterado(); }} />}
    </section>
  );
}

function LancarCustoModal({ contratoId, athleteName, onFechar, onFeito }: {
  contratoId: string; athleteName: string; onFechar: () => void; onFeito: () => void;
}) {
  const id = useId();
  const [descricao, setDescricao] = useState("");
  const [categoria, setCategoria] = useState<CategoriaCustoAluno | "">("");
  const [valor, setValor] = useState<number | null>(null);
  const [data, setData] = useState(hojeBRT());
  const [pago, setPago] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const bloqueio = !categoria ? "Escolha a categoria." : descricao.trim().length < 2 ? "Descreva o custo." : !valor ? "Informe o valor." : null;

  const salvar = async () => {
    if (!categoria || !valor) return;
    setSalvando(true);
    try {
      const r = await lancarCustoAluno({ contratoId, descricao, categoria, valor, data, pago });
      if (!r.success) return void toast.error(r.error);
      toast.success("Custo lançado", { description: athleteName });
      onFeito();
    } finally {
      setSalvando(false);
    }
  };

  return (
    <FinModal aberto onFechar={onFechar} bloqueado={salvando} titulo="Lançar custo do aluno" descricao={athleteName} icone={<Receipt className="size-4" />}
      rodape={<>
        <Button variant="ghost" onClick={onFechar} disabled={salvando}>Cancelar</Button>
        <Button onClick={salvar} disabled={salvando || bloqueio !== null} title={bloqueio ?? undefined}>{salvando && <Loader2 className="animate-spin" />}Lançar</Button>
      </>}>
      <div className="space-y-3">
        <div>
          <label htmlFor={`${id}-c`} className="block text-xs font-medium text-muted-foreground">Categoria *</label>
          <select id={`${id}-c`} value={categoria} onChange={(e) => setCategoria(e.target.value as CategoriaCustoAluno | "")}
            className="h-10 w-full rounded-lg border border-input bg-card px-3 text-base sm:h-9 sm:text-sm">
            <option value="">Escolha…</option>
            {CATEGORIAS_CUSTO_ALUNO.map((k) => <option key={k} value={k}>{CATEGORIA_CUSTO_ALUNO_LABEL[k]}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor={`${id}-d`} className="block text-xs font-medium text-muted-foreground">Descrição *</label>
          <input id={`${id}-d`} value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: Application fee IMG Academy"
            className="h-10 w-full rounded-lg border border-input bg-card px-3 text-base sm:h-9 sm:text-sm" />
        </div>
        <MoneyInput label="Valor (R$) *" value={valor} onValueChange={setValor} />
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor={`${id}-dt`} className="block text-xs font-medium text-muted-foreground">Data *</label>
            <input id={`${id}-dt`} type="date" value={data} onChange={(e) => setData(e.target.value)}
              className="h-10 w-full rounded-lg border border-input bg-card px-3 text-base sm:h-9 sm:text-sm" />
          </div>
          <label className="flex items-center gap-2 pt-5 text-xs text-foreground">
            <input type="checkbox" checked={pago} onChange={(e) => setPago(e.target.checked)} className="size-4" />
            Já foi pago (entra no caixa nesta data)
          </label>
        </div>
      </div>
    </FinModal>
  );
}
