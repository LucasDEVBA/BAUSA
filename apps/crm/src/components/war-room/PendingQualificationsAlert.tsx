"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, RotateCw, Clock, ChevronDown, ChevronUp } from "lucide-react";
import { forceRequalify } from "@/lib/actions/qualify-retry";
import type { PendingQualificationSummary } from "@/lib/war-room-queries";

interface PendingQualificationsAlertProps {
  data: PendingQualificationSummary;
}

function formatRelative(iso: string | null): string {
  if (!iso) return "—";
  const diffMs = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  if (hours < 1) return "agora há pouco";
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  return `há ${days}d`;
}

export function PendingQualificationsAlert({ data }: PendingQualificationsAlertProps) {
  const [isPending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  if (data.count === 0) return null;

  function handleRetryAll() {
    setFeedback(null);
    startTransition(async () => {
      const result = await forceRequalify();
      setFeedback({
        type: result.success ? "success" : "error",
        msg: result.message,
      });
    });
  }

  function handleRetryOne(leadId: string) {
    setFeedback(null);
    startTransition(async () => {
      const result = await forceRequalify(leadId);
      setFeedback({
        type: result.success ? "success" : "error",
        msg: result.message,
      });
    });
  }

  return (
    <section className="mb-6">
      <div className="rounded-lg border border-sys-orange/30 bg-sys-orange/5 p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="rounded-md bg-sys-orange/15 p-2">
              <AlertTriangle className="h-5 w-5 text-sys-orange" />
            </div>
            <div>
              <p className="text-sm font-semibold text-sys-orange">
                {data.count} lead{data.count > 1 ? "s" : ""} pendente{data.count > 1 ? "s" : ""} de qualificação Gemini
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                <Clock className="mr-1 inline h-3 w-3" />
                Última tentativa {formatRelative(data.oldest_attempt_at)}. A rotina diária reprocessa
                automaticamente em até 6h. Você pode forçar uma nova tentativa agora.
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={handleRetryAll}
              disabled={isPending}
              className="inline-flex items-center gap-2 rounded-md border border-sys-orange/40 bg-sys-orange/10 px-3 py-1.5 text-xs font-medium text-sys-orange hover:bg-sys-orange/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RotateCw className={`h-3.5 w-3.5 ${isPending ? "animate-spin" : ""}`} />
              {isPending ? "Reprocessando…" : "Forçar retry de todos"}
            </button>
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-transparent px-2 py-1.5 text-xs text-foreground hover:bg-fill-4"
              aria-expanded={expanded}
            >
              {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              {expanded ? "Recolher" : "Ver leads"}
            </button>
          </div>
        </div>

        {feedback && (
          <div
            className={`mt-3 rounded-md border px-3 py-2 text-xs ${
              feedback.type === "success"
                ? "border-sys-green/40 bg-sys-green/10 text-sys-green"
                : "border-sys-red/40 bg-sys-red/10 text-sys-red"
            }`}
          >
            {feedback.msg}
          </div>
        )}

        {expanded && (
          <div className="mt-4 overflow-hidden rounded-md border border-sys-orange/20">
            <table className="w-full text-xs">
              <thead className="bg-sys-orange/10 text-sys-orange">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Atleta</th>
                  <th className="px-3 py-2 text-left font-medium">Email</th>
                  <th className="px-3 py-2 text-left font-medium">Tentativas</th>
                  <th className="px-3 py-2 text-left font-medium">Última tentativa</th>
                  <th className="px-3 py-2 text-left font-medium">Erro</th>
                  <th className="px-3 py-2 text-right font-medium">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sys-orange/10 bg-card text-foreground">
                {data.leads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-sys-orange/5">
                    <td className="px-3 py-2 font-medium text-foreground">{lead.athlete_name}</td>
                    <td className="px-3 py-2 text-muted-foreground">{lead.email}</td>
                    <td className="px-3 py-2 text-muted-foreground">{lead.qualification_attempts}x</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {formatRelative(lead.last_qualification_attempt_at)}
                    </td>
                    <td className="max-w-xs truncate px-3 py-2 text-label-tertiary" title={lead.last_qualification_error || ""}>
                      {lead.last_qualification_error?.substring(0, 60) || "—"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => handleRetryOne(lead.id)}
                        disabled={isPending}
                        className="inline-flex items-center gap-1 rounded border border-sys-orange/40 bg-sys-orange/10 px-2 py-1 text-[10px] font-medium text-sys-orange hover:bg-sys-orange/20 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <RotateCw className={`h-3 w-3 ${isPending ? "animate-spin" : ""}`} />
                        Retry
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
