import { requirePapel } from "@/lib/auth";
import { fetchRevenueAtRisk, fetchAlerts, fetchBottlenecks } from "@/lib/war-room-queries";
import { RiskRevenueSection } from "@/components/war-room/RiskRevenueSection";
import { AlertsPanel } from "@/components/war-room/AlertsPanel";

export default async function WarRoomRiscoPage() {
  await requirePapel("ceo");

  const [revenueAtRisk, alerts, bottlenecks] = await Promise.all([
    fetchRevenueAtRisk(),
    fetchAlerts(),
    fetchBottlenecks(),
  ]);

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-bold text-zinc-100">Receita em Risco</h1>
        <p className="mt-0.5 text-sm text-zinc-500">
          Contratos sem assinatura, sinais nao pagos, remanescentes e alertas criticos.
        </p>
      </div>

      <RiskRevenueSection data={revenueAtRisk} />

      <AlertsPanel alerts={alerts} bottlenecks={bottlenecks} />
    </div>
  );
}
