"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  BadgeCheck,
  Ban,
  CalendarClock,
  Check,
  ExternalLink,
  Flame,
  Instagram,
  Loader2,
  Sparkles,
  Thermometer,
  UserCheck,
  Video,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Badge, Button, EmptyState, Skeleton } from "@/components/ui";
import {
  aprovarLead,
  listarLeadsPendentesAprovacao,
  reprovarLead,
  type LeadPendenteAprovacao,
} from "@/lib/actions/leads";
import { cn } from "@/lib/utils";

// ─── Helpers ─────────────────────────────────────────────────────────────

const INVESTMENT_LABELS: Record<string, string> = {
  "15k-20k": "US$ 15–20 mil/ano (≈ R$ 7,5–10 mil/mês)",
  "20k-30k": "US$ 20–30 mil/ano (≈ R$ 10–15 mil/mês)",
  "30k-40k": "US$ 30–40 mil/ano (≈ R$ 15–20 mil/mês)",
  "40k-50k": "US$ 40–50 mil/ano (≈ R$ 20–25 mil/mês)",
  "50k-70k": "US$ 50–70 mil/ano (≈ R$ 25–35 mil/mês)",
  "over-70k": "Acima de US$ 70 mil/ano (≈ R$ 35 mil+/mês)",
};

function investmentLabel(range: string | null): string {
  if (!range) return "—";
  return INVESTMENT_LABELS[range] ?? range;
}

function instagramInfo(value: string | null): { handle: string; url: string } | null {
  if (!value) return null;
  const handle = value
    .trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
    .replace(/^@/, "")
    .replace(/[/?#].*$/, "");
  if (!/^[A-Za-z0-9._]{1,60}$/.test(handle)) return null;
  return { handle: `@${handle}`, url: `https://instagram.com/${handle}` };
}

function fmtData(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function idade(birthDate: string | null): string | null {
  if (!birthDate) return null;
  const nasc = new Date(birthDate);
  if (Number.isNaN(nasc.getTime())) return null;
  const diff = Date.now() - nasc.getTime();
  const anos = Math.floor(diff / (365.25 * 24 * 3600 * 1000));
  return anos > 0 && anos < 100 ? `${anos} anos` : null;
}

function classeTone(cls: string | null): "green" | "orange" | "neutral" {
  if (cls === "QUENTE") return "green";
  if (cls === "MORNO") return "orange";
  return "neutral";
}

const TIMING_LABEL: Record<string, string> = {
  muito_cedo: "Muito cedo — retoma em novembro",
  tarde_demais: "Tarde demais — vira perdido (timing)",
};

// ─── Linha de campo do preview ───────────────────────────────────────────

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-label-tertiary">{label}</p>
      <div className="mt-0.5 text-sm text-foreground">{children ?? "—"}</div>
    </div>
  );
}

// ─── Modal ───────────────────────────────────────────────────────────────

function AprovacaoLeadsModal({
  onClose,
  onDecidido,
}: {
  onClose: () => void;
  onDecidido: () => void;
}) {
  const router = useRouter();
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [leads, setLeads] = useState<LeadPendenteAprovacao[]>([]);
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  const [reprovando, setReprovando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [pending, startTransition] = useTransition();

  const selecionado = useMemo(
    () => leads.find((l) => l.id === selecionadoId) ?? null,
    [leads, selecionadoId],
  );

  useEffect(() => {
    let ativo = true;
    (async () => {
      const res = await listarLeadsPendentesAprovacao();
      if (!ativo) return;
      if (res.success) {
        setLeads(res.leads);
        setSelecionadoId(res.leads[0]?.id ?? null);
      } else {
        setErro(res.error);
      }
      setCarregando(false);
    })();
    return () => {
      ativo = false;
    };
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const removerDaFila = useCallback(
    (id: string) => {
      setLeads((prev) => {
        const proxima = prev.filter((l) => l.id !== id);
        setSelecionadoId((atual) => (atual === id ? (proxima[0]?.id ?? null) : atual));
        return proxima;
      });
      setReprovando(false);
      setMotivo("");
      onDecidido();
      router.refresh();
    },
    [onDecidido, router],
  );

  const handleAprovar = (lead: LeadPendenteAprovacao) => {
    startTransition(async () => {
      const res = await aprovarLead(lead.id);
      if (res.success) {
        toast.success(`${lead.athlete_name} aprovado — entrou no pipeline.`);
        removerDaFila(lead.id);
      } else {
        toast.error(res.error ?? "Erro ao aprovar.");
      }
    });
  };

  const handleReprovar = (lead: LeadPendenteAprovacao) => {
    startTransition(async () => {
      const res = await reprovarLead(lead.id, motivo);
      if (res.success) {
        toast.success(`${lead.athlete_name} reprovado — não receberá mensagens.`);
        removerDaFila(lead.id);
      } else {
        toast.error(res.error ?? "Erro ao reprovar.");
      }
    });
  };

  const insta = instagramInfo(selecionado?.instagram ?? null);
  const anos = idade(selecionado?.birth_date ?? null);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Fila de aprovação de leads"
          className="flex h-[86vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
        >
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-3.5">
            <div className="flex items-center gap-2.5">
              <span className="flex size-8 items-center justify-center rounded-full bg-sys-orange/12 text-sys-orange">
                <UserCheck className="size-4" />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-foreground">Aprovação de leads</h2>
                <p className="text-xs text-muted-foreground">
                  {carregando ? "Carregando fila…" : `${leads.length} lead(s) aguardando decisão — nada é enviado sem aprovação`}
                </p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Fechar">
              <X />
            </Button>
          </div>

          {/* Body */}
          <div className="flex min-h-0 flex-1">
            {carregando ? (
              <div className="flex-1 space-y-3 p-6">
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-2/3" />
              </div>
            ) : erro ? (
              <EmptyState className="flex-1" icon={Ban} title="Erro ao carregar a fila" description={erro} />
            ) : leads.length === 0 ? (
              <EmptyState
                className="flex-1"
                icon={BadgeCheck}
                title="Fila zerada"
                description="Nenhum lead aguardando aprovação. Novos leads QUENTE/MORNO aparecem aqui antes de qualquer mensagem automática."
              />
            ) : (
              <>
                {/* Lista */}
                <div className="w-[300px] shrink-0 overflow-y-auto border-r border-border">
                  {leads.map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => {
                        setSelecionadoId(l.id);
                        setReprovando(false);
                        setMotivo("");
                      }}
                      className={cn(
                        "w-full border-b border-border/60 px-4 py-3 text-left transition-colors hover:bg-accent",
                        l.id === selecionadoId && "bg-primary/5 border-l-2 border-l-primary",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-medium text-foreground">{l.athlete_name}</p>
                        <Badge tone={classeTone(l.qualification_classification)} size="sm">
                          {l.qualification_classification === "QUENTE" ? (
                            <Flame className="size-2.5" />
                          ) : (
                            <Thermometer className="size-2.5" />
                          )}
                          {l.qualification_classification ?? "—"}
                        </Badge>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {l.position ?? "—"} · {l.city_state ?? "—"}
                      </p>
                      <p className="mt-0.5 text-[11px] text-label-tertiary">Recebido {fmtData(l.submitted_at)}</p>
                    </button>
                  ))}
                </div>

                {/* Preview */}
                {selecionado && (
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
                      {/* Identidade */}
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-semibold text-foreground">{selecionado.athlete_name}</h3>
                          <Badge tone={classeTone(selecionado.qualification_classification)}>
                            {selecionado.qualification_classification} · confiança {selecionado.qualification_confidence ?? "—"}
                          </Badge>
                          {selecionado.timing_status && selecionado.timing_status !== "ideal" && (
                            <Badge tone="purple">
                              <CalendarClock className="size-3" />
                              {TIMING_LABEL[selecionado.timing_status] ?? selecionado.timing_status}
                            </Badge>
                          )}
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          {anos && <span>{anos}</span>}
                          <span>{selecionado.email}</span>
                          {insta ? (
                            <a
                              href={insta.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                            >
                              <Instagram className="size-3.5" />
                              {insta.handle}
                              <ExternalLink className="size-3" />
                            </a>
                          ) : selecionado.instagram ? (
                            <span className="inline-flex items-center gap-1">
                              <Instagram className="size-3.5" />
                              {selecionado.instagram}
                            </span>
                          ) : null}
                          {selecionado.video_link && /^https?:\/\//i.test(selecionado.video_link) && (
                            <a
                              href={selecionado.video_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                            >
                              <Video className="size-3.5" />
                              Vídeo highlights
                              <ExternalLink className="size-3" />
                            </a>
                          )}
                        </div>
                      </div>

                      {/* Pré-qualificação da IA */}
                      <div className="rounded-xl border border-primary/15 bg-primary/5 p-4">
                        <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                          <Sparkles className="size-3.5" />
                          Pré-qualificação da IA
                        </p>
                        <p className="mt-1.5 text-sm leading-relaxed text-foreground">
                          {selecionado.qualification_reason ?? "Sem justificativa registrada."}
                        </p>
                        <p className="mt-1.5 text-[11px] text-label-tertiary">
                          Qualificado em {fmtData(selecionado.qualified_at)}
                        </p>
                      </div>

                      {/* Dados */}
                      <div className="grid grid-cols-2 gap-x-6 gap-y-4 lg:grid-cols-3">
                        <Campo label="Posição">{selecionado.position ?? "—"}</Campo>
                        <Campo label="Escola atual">{selecionado.current_school ?? "—"}</Campo>
                        <Campo label="Série">{selecionado.school_year ?? "—"}</Campo>
                        <Campo label="Cidade">
                          {selecionado.city_state ?? "—"}
                          {selecionado.address_country && selecionado.address_country !== "BR"
                            ? ` · ${selecionado.address_country}`
                            : ""}
                        </Campo>
                        <Campo label="Inglês">{selecionado.english_level ?? "—"}</Campo>
                        <Campo label="Desempenho acadêmico">{selecionado.academic_performance ?? "—"}</Campo>
                        <Campo label="WhatsApp do atleta">{selecionado.athlete_whatsapp ?? "—"}</Campo>
                        <Campo label="Responsável">
                          {selecionado.guardian_name ?? "—"}
                          {selecionado.guardian_profession ? (
                            <span className="text-muted-foreground"> · {selecionado.guardian_profession}</span>
                          ) : null}
                        </Campo>
                        <Campo label="WhatsApp do responsável">{selecionado.guardian_whatsapp ?? "—"}</Campo>
                        <Campo label="Investimento declarado">{investmentLabel(selecionado.investment_range)}</Campo>
                        <Campo label="Histórico de clubes">{selecionado.club_history ?? "—"}</Campo>
                        <Campo label="Conquistas">{selecionado.achievements ?? "—"}</Campo>
                      </div>

                      {/* Origem */}
                      <div className="rounded-xl border border-border bg-secondary/50 px-4 py-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-label-tertiary">Origem</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {selecionado.utm_source ? `${selecionado.utm_source}` : "orgânico/direto"}
                          {selecionado.utm_campaign ? ` · campanha ${selecionado.utm_campaign}` : ""}
                          {selecionado.device_type ? ` · ${selecionado.device_type}` : ""}
                          {` · formulário em ${fmtData(selecionado.submitted_at)}`}
                        </p>
                      </div>
                    </div>

                    {/* Footer de decisão */}
                    <div className="shrink-0 border-t border-border p-4">
                      {reprovando ? (
                        <div className="space-y-2.5">
                          <textarea
                            value={motivo}
                            onChange={(e) => setMotivo(e.target.value)}
                            placeholder="Motivo da reprovação (opcional — fica no histórico)"
                            rows={2}
                            className="w-full resize-none rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-label-tertiary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          />
                          <div className="flex items-center justify-end gap-2">
                            <Button variant="ghost" size="sm" disabled={pending} onClick={() => setReprovando(false)}>
                              Cancelar
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              disabled={pending}
                              onClick={() => handleReprovar(selecionado)}
                            >
                              {pending ? <Loader2 className="animate-spin" /> : <Ban />}
                              Confirmar reprovação
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs text-muted-foreground">
                            Aprovar cria atleta + deal e libera o WhatsApp automático. Reprovar encerra: sem pipeline, sem mensagens.
                          </p>
                          <div className="flex shrink-0 items-center gap-2">
                            <Button variant="secondary" size="md" disabled={pending} onClick={() => setReprovando(true)}>
                              <Ban className="text-destructive" />
                              Reprovar
                            </Button>
                            <Button variant="primary" size="md" disabled={pending} onClick={() => handleAprovar(selecionado)}>
                              {pending ? <Loader2 className="animate-spin" /> : <Check />}
                              Aprovar lead
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Entradas (botão compacto / banner) ──────────────────────────────────

export function AprovacoesLeads({
  count,
  variant = "button",
}: {
  count: number;
  variant?: "button" | "banner";
}) {
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [pendentes, setPendentes] = useState(count);
  const [autoAberto, setAutoAberto] = useState(false);

  useEffect(() => setPendentes(count), [count]);

  // Deep-link da notificação: /leads?aprovacao=pendente abre o modal direto
  useEffect(() => {
    if (!autoAberto && searchParams.get("aprovacao") === "pendente" && count > 0) {
      setOpen(true);
      setAutoAberto(true);
    }
  }, [autoAberto, count, searchParams]);

  const onDecidido = useCallback(() => setPendentes((n) => Math.max(0, n - 1)), []);

  if (variant === "banner") {
    if (pendentes === 0) return null;
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center justify-between gap-3 rounded-xl border border-sys-orange/25 bg-sys-orange/8 px-4 py-3 text-left transition-colors hover:bg-sys-orange/12"
        >
          <span className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-full bg-sys-orange/15 text-sys-orange">
              <UserCheck className="size-4" />
            </span>
            <span>
              <span className="block text-sm font-semibold text-foreground">
                {pendentes} lead{pendentes > 1 ? "s" : ""} aguardando sua aprovação
              </span>
              <span className="block text-xs text-muted-foreground">
                Pré-qualificados pela IA — nada é enviado nem entra no pipeline sem o seu OK.
              </span>
            </span>
          </span>
          <span className="shrink-0 text-xs font-semibold text-sys-orange">Abrir fila →</span>
        </button>
        {open && <AprovacaoLeadsModal onClose={() => setOpen(false)} onDecidido={onDecidido} />}
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex h-9 items-center gap-2 rounded-lg border px-3.5 text-sm font-medium transition-colors",
          pendentes > 0
            ? "border-sys-orange/30 bg-sys-orange/10 text-sys-orange hover:bg-sys-orange/15"
            : "border-border bg-card text-muted-foreground hover:bg-accent",
        )}
      >
        <UserCheck className="size-4" />
        Aprovações
        {pendentes > 0 && (
          <span className="flex min-w-5 items-center justify-center rounded-full bg-sys-orange px-1.5 py-0.5 text-[11px] font-bold leading-none text-white">
            {pendentes}
          </span>
        )}
      </button>
      {open && <AprovacaoLeadsModal onClose={() => setOpen(false)} onDecidido={onDecidido} />}
    </>
  );
}
