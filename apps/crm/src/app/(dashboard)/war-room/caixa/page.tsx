import { requirePapel } from "@/lib/auth";
import { fetchCashFlow, fetchRevenueMonths } from "@/lib/war-room-queries";
import { CashFlowSection } from "@/components/war-room/CashFlowSection";
import { RevenueBarChart } from "@/components/war-room/RevenueBarChart";

export default async function WarRoomCaixaPage() {
  await requirePapel("ceo");

  const [cashFlow, revenueMonths] = await Promise.all([
    fetchCashFlow(),
    fetchRevenueMonths(),
  ]);

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-bold text-zinc-100">Caixa</h1>
        <p className="mt-0.5 text-sm text-zinc-500">
          Receita liquida recebida e projecoes de entrada nos proximos 30 e 90 dias.
        </p>
      </div>

      <CashFlowSection data={cashFlow} />

      <RevenueBarChart data={revenueMonths} />
    </div>
  );
}
