import { createServerSupabaseClient } from "@/lib/supabase-server";
import { AnalyticsClient } from "./client";
import type { RevenueMonth } from "@/types/revenue";

const MONTH_LABELS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export default async function AnalyticsPage() {
  const supabase = await createServerSupabaseClient();

  // Buscar parcelas recebidas agrupadas por mes (ultimos 24 meses para poder comparar)
  const twoYearsAgo = new Date();
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
  const twoYearsAgoStr = twoYearsAgo.toISOString().split("T")[0];

  const { data: rawParcelas } = await supabase
    .from("parcelas")
    .select("valor, vencimento, status, recebido_at")
    .is("deleted_at", null)
    .gte("vencimento", twoYearsAgoStr)
    .order("vencimento", { ascending: true });

  // Buscar contratos para contagem de familias assinadas por mes
  const { data: rawContratos } = await supabase
    .from("contratos_financeiros")
    .select("id, valor_total, created_at")
    .is("deleted_at", null)
    .gte("created_at", twoYearsAgoStr)
    .order("created_at", { ascending: true });

  // Construir RevenueMonth[] agregando por mes
  const monthMap = new Map<string, {
    contracted: number;
    received: number;
    projected: number;
    families: number;
    month: number;
    year: number;
  }>();

  // Processar contratos (receita contratada)
  for (const c of rawContratos ?? []) {
    const date = new Date(c.created_at as string);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const existing = monthMap.get(key) ?? {
      contracted: 0, received: 0, projected: 0, families: 0,
      month: date.getMonth() + 1, year: date.getFullYear(),
    };
    existing.contracted += Number(c.valor_total) || 0;
    existing.families += 1;
    monthMap.set(key, existing);
  }

  // Processar parcelas (receita recebida e projetada)
  const hoje = new Date().toISOString().split("T")[0];
  for (const p of rawParcelas ?? []) {
    const date = new Date(p.vencimento as string);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const existing = monthMap.get(key) ?? {
      contracted: 0, received: 0, projected: 0, families: 0,
      month: date.getMonth() + 1, year: date.getFullYear(),
    };

    const valor = Number(p.valor) || 0;
    if (p.status === "recebido") {
      existing.received += valor;
    } else if (p.status === "previsto" && (p.vencimento as string) >= hoje) {
      existing.projected += valor;
    }

    monthMap.set(key, existing);
  }

  // Converter para array ordenado
  const revenueMonths: RevenueMonth[] = Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, data]) => ({
      month: data.month,
      year: data.year,
      month_label: `${MONTH_LABELS[data.month - 1]}/${String(data.year).slice(2)}`,
      contracted_brl: data.contracted,
      received_brl: data.received,
      projected_brl: data.projected,
      families_signed: data.families,
    }));

  // Se nao houver dados, fornecer array vazio
  return <AnalyticsClient revenueMonths={revenueMonths} />;
}
