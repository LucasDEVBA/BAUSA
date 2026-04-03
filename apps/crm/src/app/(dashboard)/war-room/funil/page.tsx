import { requirePapel } from "@/lib/auth";
import { fetchCommercialFunnel, fetchConversionFunnel } from "@/lib/war-room-queries";
import { CommercialFunnelSection } from "@/components/war-room/CommercialFunnelSection";
import { ConversionFunnel } from "@/components/war-room/ConversionFunnel";

export default async function WarRoomFunilPage() {
  await requirePapel("ceo");

  const [commercialFunnel, conversionFunnel] = await Promise.all([
    fetchCommercialFunnel(),
    fetchConversionFunnel(),
  ]);

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-bold text-zinc-100">Funil Comercial</h1>
        <p className="mt-0.5 text-sm text-zinc-500">
          Performance por etapa do processo de vendas — do lead ao contrato.
        </p>
      </div>

      <CommercialFunnelSection data={commercialFunnel} />

      <ConversionFunnel data={conversionFunnel} />
    </div>
  );
}
