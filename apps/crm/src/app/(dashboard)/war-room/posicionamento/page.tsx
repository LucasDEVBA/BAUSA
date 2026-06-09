import { requirePapel } from "@/lib/auth";
import { fetchPositioning } from "@/lib/war-room-queries";
import { PositioningSection } from "@/components/war-room/PositioningSection";

export default async function WarRoomPosicionamentoPage() {
  await requirePapel("ceo");

  const positioning = await fetchPositioning();

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-title-2 text-foreground">Posicionamento</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Mix de produto por tier (Legacy, Journey, Start), ticket medio e politica de desconto.
        </p>
      </div>

      <PositioningSection data={positioning} />
    </div>
  );
}
