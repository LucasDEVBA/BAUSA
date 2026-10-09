"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CalendarClock, CheckCircle2, FileText, Receipt, User, Wallet } from "lucide-react";
import { toast } from "sonner";

import { Badge, BrandTabs, Card, PageHeader, StatCard } from "@/components/ui";
import { ContratoPainel } from "@/components/financeiro/contrato/ContratoPainel";
import { NfEditRow } from "@/components/financeiro/NfEditRow";
import type { ContratoDetalhe } from "@/lib/actions/contratos";
import { carregarContrato } from "@/lib/actions/financeiro-contrato";
import { formatarMoeda } from "@/lib/financeiro/calculo.mjs";
import { PLANO_LABEL } from "@/lib/financeiro/schemas";
import type { ContratoCompleto } from "@/types/contrato";

const ABAS = [
  { id: "financeiro", label: "Financeiro", icon: Wallet },
  { id: "contratante", label: "Contratante", icon: User },
  { id: "fiscal", label: "Nota fiscal", icon: Receipt },
] as const;
type Aba = (typeof ABAS)[number]["id"];
const ehAba = (id: string): id is Aba => ABAS.some((a) => a.id === id);

/**
 * /contratos/[id] — antes 100% somente leitura ("a baixa continua na aba do
 * lead"). Agora o MESMO ContratoPainel da aba Contrato: editar, dar baixa com
 * data/método reais, estornar, quitar, itens, custos do aluno e histórico (T9/T18).
 */
export function ContratoDetalheClient({ detalhe, inicial }: { detalhe: ContratoDetalhe; inicial: ContratoCompleto }) {
  const router = useRouter();
  const [aba, setAba] = useState<Aba>("financeiro");
  const [dados, setDados] = useState(inicial);
  const c = dados.contrato;
  const r = dados.resumo;

  const recarregar = async () => {
    if (!c) return;
    try {
      const novo = await carregarContrato(c.id);
      if (novo?.contrato) setDados(novo);
      else router.push("/contratos"); // descartado
      router.refresh();
    } catch (err) {
      console.error({ level: "error", action: "contrato_detalhe_recarregar", contratoId: c.id, error: String(err) });
      toast.error("Não foi possível recarregar o contrato. Atualize a página.");
    }
  };

  return (
    <div className="space-y-4">
      <Link href="/contratos" className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground">
        <ArrowLeft className="size-3.5" aria-hidden />Contratos
      </Link>

      <PageHeader
        dense
        eyebrow={c?.plano ? PLANO_LABEL[c.plano] : "PLANO A DEFINIR"}
        title={detalhe.atleta?.nome ?? "Contrato"}
        actions={detalhe.dealId ? (
          <Link href={`/pipeline?deal=${detalhe.dealId}`} className="rounded-lg bg-secondary px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-accent">
            Abrir no pipeline
          </Link>
        ) : undefined}
      />

      {r && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label={c?.plano ? "Valor do contrato" : "Sinal recebido"} value={formatarMoeda(c?.plano ? r.valorTotal : r.sinalRecebido)} icon={FileText} accent="brand" />
          <StatCard label="Recebido" value={formatarMoeda(r.recebido)} icon={CheckCircle2} accent="green" context={`${r.pctRecebido ?? 0}% · ${r.pagas}/${r.totalParcelas} parcelas`} />
          <StatCard label="A receber" value={formatarMoeda(r.aReceber)} icon={Wallet} accent="blue" context={r.semCronograma > 0 ? `+ ${formatarMoeda(r.semCronograma)} sem parcelas` : undefined} />
          <StatCard label="Em atraso" value={formatarMoeda(r.emAtraso)} icon={CalendarClock} accent={r.qtdAtrasadas > 0 ? "red" : "green"} context={r.qtdAtrasadas > 0 ? `${r.qtdAtrasadas} parcela(s)` : "nada vencido"} />
        </div>
      )}

      <BrandTabs
        items={[...ABAS]}
        activeId={aba}
        onSelect={(id) => ehAba(id) && setAba(id)}
        ariaLabel="Seções do contrato"
      />

      {aba === "financeiro" && (
        <div role="tabpanel" aria-label="Financeiro">
          <ContratoPainel dados={dados} onAlterado={() => void recarregar()} linkContratoCompleto={false} />
        </div>
      )}

      {aba === "contratante" && (
        <div role="tabpanel" aria-label="Contratante" className="grid gap-4 lg:grid-cols-2">
          <Card>
            <h3 className="mb-2 text-sm font-semibold text-foreground">Atleta</h3>
            <Linha rotulo="Nome" valor={detalhe.atleta?.nome ?? "—"} />
            <Linha rotulo="E-mail" valor={detalhe.atleta?.email ?? "—"} />
            <Linha rotulo="WhatsApp" valor={detalhe.atleta?.whatsapp ?? "—"} />
          </Card>
          <Card>
            <h3 className="mb-2 text-sm font-semibold text-foreground">Responsável financeiro</h3>
            <Linha rotulo="Nome" valor={detalhe.responsavel?.nome ?? "—"} />
            <Linha rotulo="E-mail" valor={detalhe.responsavel?.email ?? "—"} />
            <Linha rotulo="WhatsApp" valor={detalhe.responsavel?.whatsapp ?? "—"} />
          </Card>
        </div>
      )}

      {aba === "fiscal" && c && (
        <Card role="tabpanel" aria-label="Nota fiscal">
          <h3 className="mb-2 text-sm font-semibold text-foreground">Nota fiscal</h3>
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone={c.nf_status === "emitida" ? "green" : c.nf_status === "nao_aplicavel" ? "neutral" : "orange"} size="sm">
              {c.nf_status === "emitida" ? "Emitida" : c.nf_status === "nao_aplicavel" ? "Não aplicável" : "Pendente"}
            </Badge>
            <NfEditRow contractId={c.id} nfStatus={c.nf_status} nfNumero={c.nf_numero} nfEmitidaAt={c.nf_emitida_at} nfValor={c.nf_valor} onSalvo={() => void recarregar()} />
          </div>
        </Card>
      )}
    </div>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border/60 py-2 last:border-0">
      <span className="shrink-0 text-xs text-muted-foreground">{rotulo}</span>
      <span className="min-w-0 truncate text-right text-xs font-medium text-foreground">{valor}</span>
    </div>
  );
}
