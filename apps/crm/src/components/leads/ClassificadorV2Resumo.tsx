import { AlertTriangle, CheckCircle2, Trophy, Zap } from "lucide-react";

import { Badge } from "@/components/ui";
import {
  parseSinaisV2,
  temDadosClassificadorV2,
  TIER_PROFISSAO_LABEL,
  type ClassificadorV2Dados,
} from "@/lib/classificador-v2";
import { cn } from "@/lib/utils";

/**
 * Bloco de exibição do Classificador v2 (score financeiro, tier, sinais,
 * prioridade estratégica esportiva e ação recomendada). Reusado na fila de
 * aprovação, no detalhe do lead (/leads) e no detalhe do deal (Pipeline).
 *
 * Campos NULL (leads pré-v2) → o bloco inteiro (ou o item ausente) some.
 * `prioridade_estrategica` é o eixo ESPORTIVO — independente do score
 * financeiro e distinto da prioridade P1/P2 por engajamento.
 */
export function ClassificadorV2Resumo({
  dados,
  compact = false,
}: {
  dados: ClassificadorV2Dados;
  compact?: boolean;
}) {
  const reforco = parseSinaisV2(dados.sinais_reforco);
  const alerta = parseSinaisV2(dados.sinais_alerta);
  const normalizado: ClassificadorV2Dados = {
    ...dados,
    sinais_reforco: reforco,
    sinais_alerta: alerta,
  };
  if (!temDadosClassificadorV2(normalizado)) return null;

  const score = dados.score_financeiro;
  const scoreValido = typeof score === "number" && Number.isFinite(score);
  const scorePct = scoreValido ? Math.min(100, Math.max(0, score)) : 0;
  const tier = dados.tier_profissao;
  const prioridade = dados.prioridade_estrategica;

  return (
    <div className={cn("space-y-2.5", compact ? "mt-2" : "mt-3")}>
      {/* Score + tier + prioridade + ação — linha de destaque */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {scoreValido && (
          <div className="min-w-32">
            <div className="flex items-baseline gap-1.5">
              <span
                className={cn(
                  "font-bold tabular-nums text-foreground",
                  compact ? "text-xl" : "text-2xl",
                )}
              >
                {score}
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-label-tertiary">
                Score financeiro
              </span>
            </div>
            <div
              className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-secondary"
              role="progressbar"
              aria-label="Score financeiro"
              aria-valuenow={scorePct}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div className="h-full rounded-full bg-primary" style={{ width: `${scorePct}%` }} />
            </div>
          </div>
        )}
        {tier && (
          <Badge tone={tier === "A" ? "green" : tier === "B" ? "blue" : tier === "C" ? "orange" : "neutral"} size="sm">
            {TIER_PROFISSAO_LABEL[tier] ?? `Tier ${tier}`}
          </Badge>
        )}
        {/* Eixo esportivo (independente do financeiro): PADRAO = sem badge */}
        {prioridade === "ALTA" && (
          <Badge tone="purple" size="sm">
            <Trophy className="size-3" />
            Prioridade esportiva ALTA
          </Badge>
        )}
        {prioridade === "MEDIA" && (
          <Badge tone="blue" size="sm">
            <Trophy className="size-3" />
            Prioridade esportiva média
          </Badge>
        )}
      </div>

      {dados.acao_recomendada && (
        <p className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
          <Zap className="size-3.5" />
          Ação recomendada: {dados.acao_recomendada}
        </p>
      )}

      {(reforco || alerta) && (
        <div className={cn("grid grid-cols-1 gap-2.5", !compact && "sm:grid-cols-2")}>
          {reforco && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-sys-green">
                Sinais de reforço
              </p>
              <ul className="mt-1 space-y-0.5">
                {reforco.map((s) => (
                  <li key={s} className="flex items-start gap-1.5 text-xs leading-relaxed text-foreground/90">
                    <CheckCircle2 className="mt-0.5 size-3 shrink-0 text-sys-green" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {alerta && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-sys-orange">
                Sinais de alerta
              </p>
              <ul className="mt-1 space-y-0.5">
                {alerta.map((s) => (
                  <li key={s} className="flex items-start gap-1.5 text-xs leading-relaxed text-foreground/90">
                    <AlertTriangle className="mt-0.5 size-3 shrink-0 text-sys-orange" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
