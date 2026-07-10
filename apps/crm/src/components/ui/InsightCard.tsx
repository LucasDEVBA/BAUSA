import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge, type BadgeTone } from "./Badge";

/**
 * InsightCard — card de análise de IA (padrão "Justificativa Gemini" da tela favorita):
 * Sparkles + eyebrow → badge de classe → texto → confiança/rodapé. Tint leve do primário.
 */
export interface InsightCardProps {
  eyebrow?: string;
  badge?: { label: string; tone: BadgeTone };
  confidence?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

export function InsightCard({
  eyebrow = "Análise da IA",
  badge,
  confidence,
  children,
  footer,
  className,
}: InsightCardProps) {
  return (
    <div className={cn("rounded-2xl border border-primary/15 bg-primary/[0.04] p-4", className)}>
      <div className="mb-2.5 flex items-center gap-2">
        <Sparkles aria-hidden className="size-4 text-primary" />
        <span className="text-eyebrow text-primary">{eyebrow}</span>
        {badge && (
          <Badge tone={badge.tone} size="sm" className="ml-1">
            {badge.label}
          </Badge>
        )}
        {confidence && (
          <span className="ml-auto text-[10px] text-muted-foreground">Confiança: {confidence}</span>
        )}
      </div>
      <div className="text-sm leading-relaxed text-foreground/90">{children}</div>
      {footer && <div className="mt-2 text-xs text-muted-foreground">{footer}</div>}
    </div>
  );
}
