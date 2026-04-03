import { createServerSupabaseClient } from "@/lib/crm/supabase-server";
import { requirePapel } from "@/lib/crm/auth";
import { MetricCard } from "@/components/crm/shared/MetricCard";
import { DollarSign, TrendingUp, AlertTriangle, FileText } from "lucide-react";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function FinanceiroPage({ params }: PageProps) {
  const { locale } = await params;
  await requirePapel("ceo", locale);
  const supabase = await createServerSupabaseClient();
  const mesAtual = new Date().toISOString().slice(0, 7);
  const hoje = new Date().toISOString().split("T")[0];

  // Receita recebida no mês
  const { data: parcelasRecebidasMes } = await supabase
    .from("parcelas").select("valor").eq("status", "recebido").is("deleted_at", null).gte("recebido_at", `${mesAtual}-01`);
  const receitaRecebida = (parcelasRecebidasMes || []).reduce((s, p) => s + Number(p.valor), 0);

  // Total de recebíveis
  const { data: todasParcelas } = await supabase
    .from("parcelas").select("id, valor, vencimento, status, metodo, numero_parcela, contrato_id").is("deleted_at", null).order("vencimento", { ascending: true });

  const previstas = (todasParcelas || []).filter((p) => p.status === "previsto");
  const atrasadas = (todasParcelas || []).filter((p) => p.status === "atrasado");
  const totalPrevisto = previstas.reduce((s, p) => s + Number(p.valor), 0);
  const totalAtrasado = atrasadas.reduce((s, p) => s + Number(p.valor), 0);

  // NFs pendentes
  const { data: contratos } = await supabase
    .from("contratos_financeiros").select("id, deal_id, plano, valor_total, nf_status, entrada_paga")
    .is("deleted_at", null).order("created_at", { ascending: false });
  const nfPendentes = (contratos || []).filter((c) => c.nf_status === "pendente" && c.entrada_paga).length;

  // Margem (simplificada)
  const margemPct = receitaRecebida > 0 ? Math.round(((receitaRecebida - totalAtrasado) / receitaRecebida) * 100) : 100;

  const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR")}`;

  const statusColor = (s: string) => {
    if (s === "recebido") return "text-[var(--crm-success)] bg-[var(--crm-success-tint)]";
    if (s === "atrasado") return "text-[var(--crm-error)] bg-[var(--crm-error-tint)]";
    return "text-[var(--crm-text-secondary)] bg-[var(--crm-neutral-100)]";
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="crm-page-title">Financeiro</h1>
        <p className="crm-page-subtitle">Contratos, parcelas e recebiveis</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Recebido (mes)" value={fmt(receitaRecebida)} icon={DollarSign} variant="hot" />
        <MetricCard title="Recebiveis" value={fmt(totalPrevisto)} subtitle={`${previstas.length} parcelas`} icon={TrendingUp} variant="cold" />
        <MetricCard title="Inadimplencia" value={fmt(totalAtrasado)} subtitle={`${atrasadas.length} parcelas`} icon={AlertTriangle} variant={totalAtrasado > 0 ? "danger" : "default"} />
        <MetricCard title="NFs Pendentes" value={String(nfPendentes)} icon={FileText} variant={nfPendentes > 0 ? "warm" : "default"} />
      </div>

      {/* Contratos */}
      <div className="crm-card">
        <p className="text-[var(--crm-text-xs)] font-[var(--crm-weight-semibold)] uppercase tracking-[var(--crm-tracking-widest)] text-[var(--crm-text-secondary)] mb-4">
          Contratos Ativos ({contratos?.length || 0})
        </p>
        {!contratos?.length ? (
          <p className="text-[var(--crm-text-sm)] text-[var(--crm-text-tertiary)]">Nenhum contrato registrado.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--crm-border)] text-left">
                  <th className="pb-2 font-[var(--crm-weight-medium)] text-[var(--crm-text-secondary)]">Plano</th>
                  <th className="pb-2 font-[var(--crm-weight-medium)] text-[var(--crm-text-secondary)] text-right">Valor</th>
                  <th className="pb-2 font-[var(--crm-weight-medium)] text-[var(--crm-text-secondary)] text-center">Entrada</th>
                  <th className="pb-2 font-[var(--crm-weight-medium)] text-[var(--crm-text-secondary)] text-center">NF</th>
                </tr>
              </thead>
              <tbody>
                {contratos.map((c: any) => (
                  <tr key={c.id} className="border-b border-[var(--crm-border)]/50 last:border-0">
                    <td className="py-2.5">
                      <span className={`text-[var(--crm-text-xs)] font-[var(--crm-weight-semibold)] px-2 py-0.5 rounded-full ${
                        c.plano === "legacy" ? "text-[var(--crm-info)] bg-[var(--crm-info-tint)]" :
                        c.plano === "journey" ? "text-[var(--crm-accent-text)] bg-[var(--crm-accent-50)]" :
                        "text-[var(--crm-text-secondary)] bg-[var(--crm-neutral-100)]"
                      }`}>{c.plano}</span>
                    </td>
                    <td className="py-2.5 text-[var(--crm-text-primary)] text-right font-[var(--crm-weight-medium)]">{fmt(Number(c.valor_total))}</td>
                    <td className="py-2.5 text-center">
                      <span className={`text-[var(--crm-text-xs)] font-[var(--crm-weight-semibold)] px-2 py-0.5 rounded-full ${c.entrada_paga ? "text-[var(--crm-success)] bg-[var(--crm-success-tint)]" : "text-[var(--crm-warning)] bg-[var(--crm-warning-tint)]"}`}>
                        {c.entrada_paga ? "Pago" : "Pendente"}
                      </span>
                    </td>
                    <td className="py-2.5 text-center">
                      <span className={`text-[var(--crm-text-xs)] px-2 py-0.5 rounded-full ${c.nf_status === "emitida" ? "text-[var(--crm-success)] bg-[var(--crm-success-tint)]" : "text-[var(--crm-text-tertiary)] bg-[var(--crm-neutral-100)]"}`}>
                        {c.nf_status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Parcelas */}
      <div className="crm-card">
        <p className="text-[var(--crm-text-xs)] font-[var(--crm-weight-semibold)] uppercase tracking-[var(--crm-tracking-widest)] text-[var(--crm-text-secondary)] mb-4">
          Recebiveis ({(todasParcelas || []).length} parcelas)
        </p>
        {!(todasParcelas || []).length ? (
          <p className="text-[var(--crm-text-sm)] text-[var(--crm-text-tertiary)]">Nenhuma parcela.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--crm-border)] text-left">
                  <th className="pb-2 font-[var(--crm-weight-medium)] text-[var(--crm-text-secondary)]">Parcela</th>
                  <th className="pb-2 font-[var(--crm-weight-medium)] text-[var(--crm-text-secondary)] text-right">Valor</th>
                  <th className="pb-2 font-[var(--crm-weight-medium)] text-[var(--crm-text-secondary)]">Vencimento</th>
                  <th className="pb-2 font-[var(--crm-weight-medium)] text-[var(--crm-text-secondary)]">Metodo</th>
                  <th className="pb-2 font-[var(--crm-weight-medium)] text-[var(--crm-text-secondary)]">Status</th>
                </tr>
              </thead>
              <tbody>
                {(todasParcelas || []).slice(0, 20).map((p: any) => {
                  const vencida = p.vencimento < hoje && p.status === "previsto";
                  return (
                    <tr key={p.id} className={`border-b border-[var(--crm-border)]/50 last:border-0 ${vencida ? "bg-[var(--crm-error-tint)]" : ""}`}>
                      <td className="py-2 text-[var(--crm-text-primary)]">{p.numero_parcela}</td>
                      <td className="py-2 text-[var(--crm-text-primary)] text-right font-[var(--crm-weight-medium)]">{fmt(Number(p.valor))}</td>
                      <td className={`py-2 ${vencida ? "text-[var(--crm-error)] font-[var(--crm-weight-medium)]" : "text-[var(--crm-text-secondary)]"}`}>
                        {new Date(p.vencimento).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="py-2 text-[var(--crm-text-tertiary)] uppercase text-[var(--crm-text-xs)]">{p.metodo}</td>
                      <td className="py-2">
                        <span className={`text-[var(--crm-text-xs)] font-[var(--crm-weight-semibold)] px-2 py-0.5 rounded-full ${statusColor(vencida ? "atrasado" : p.status)}`}>
                          {vencida ? "VENCIDA" : p.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
