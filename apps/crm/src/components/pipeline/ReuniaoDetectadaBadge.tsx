import { CalendarCheck } from "lucide-react";

import { Badge } from "@/components/ui";
import { cn } from "@/lib/utils";

/**
 * "Reunião detectada" — átomo ÚNICO (contrato B4 do PLANO de 08/10).
 *
 * O Google Calendar achou uma reunião deste lead. Antes havia uma cópia do
 * badge em cada tela, com textos divergentes — e a fila chegou a dizer "sem
 * deal" para lead que tinha deal. Por isso o "sem deal" só aparece quando
 * quem usa GARANTE que não há deal ativo (`semDeal`).
 *
 * Só sinaliza: a decisão (aprovar, resgatar, reprovar) continua humana. Quem
 * ordena "reunião primeiro" é o SERVIDOR, não este componente.
 */
export interface ReuniaoDetectadaBadgeProps {
  /** form_submissions.meeting_scheduled_at — quando o Calendar detectou. */
  detectadaEm?: string | null;
  /** true só onde é garantido que o lead não tem deal ativo. */
  semDeal?: boolean;
  /** "card": pílula compacta dos cards de 252px; "padrao": listas, tabela e dossiê. */
  variante?: "card" | "padrao";
  className?: string;
}

// Data ABSOLUTA e fuso fixo: texto relativo ("há 3d") ou o fuso do servidor
// (UTC) renderizariam diferente no SSR e na hidratação.
const FORMATO_DATA_DETECCAO = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "America/Sao_Paulo",
});

function formatarDeteccao(iso: string | null): string | null {
  if (!iso) return null;
  const data = new Date(iso);
  return Number.isNaN(data.getTime()) ? null : FORMATO_DATA_DETECCAO.format(data);
}

export function ReuniaoDetectadaBadge({
  detectadaEm = null,
  semDeal = false,
  variante = "padrao",
  className,
}: ReuniaoDetectadaBadgeProps) {
  const data = formatarDeteccao(detectadaEm);
  const detalhe =
    `no Google Calendar${data ? ` em ${data}` : ""}` +
    (semDeal ? " — o lead ainda não tem deal no pipeline" : "");
  const compacto = variante === "card";

  return (
    <Badge
      tone="green"
      size="sm"
      title={`Reunião detectada ${detalhe}`}
      className={cn(
        "shrink-0",
        // Mesma pílula dos badges vizinhos do card (classe, timing) — altura alinhada na linha.
        compacto && "gap-0.5 rounded border-0 px-1 py-px text-[9px] font-medium leading-normal",
        className,
      )}
    >
      <CalendarCheck aria-hidden className={compacto ? "size-2" : "size-2.5"} />
      Reunião detectada
      <span className="sr-only">{` ${detalhe}`}</span>
    </Badge>
  );
}
