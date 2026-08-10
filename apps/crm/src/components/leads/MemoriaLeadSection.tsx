"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Brain, FileText, Loader2, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge, Button, Card, EmptyState, type BadgeTone } from "@/components/ui";
import { cn } from "@/lib/utils";
import { cleanPhone, isValidPhone } from "@/lib/whatsapp-espelho";
import {
  dispensarMemoriaItem,
  extrairMemoriaLeadCompleta,
  listarMemoriaLead,
  type MemoriaItem,
} from "@/lib/actions/lead-memoria";

// ════════════════════════════════════════════════════════════════════════
// Memória & Insights do lead — seção do detalhe do lead/deal (CEO).
// Aciona SOB DEMANDA o Agent de Memória & Documentos sobre a conversa 1:1 do
// lead: extrai fatos/insights (→ lista abaixo) e captura documentos (→ seção
// Documentos). A IA nunca envia nada; só analisa e grava. Idempotente.
// ════════════════════════════════════════════════════════════════════════

interface MemoriaLeadSectionProps {
  atletaId?: string | null;
  experienciaId?: string | null;
  formSubmissionId?: string | null;
  /** Telefone 1:1 do lead (guardian/atleta/deal.whatsapp). */
  telefone?: string | null;
  lid?: string | null;
}

const TIPO_LABEL: Record<MemoriaItem["tipo"], string> = {
  fato: "Fato",
  preferencia: "Preferência",
  insight: "Insight",
  resumo: "Resumo",
  alerta: "Alerta",
};

const TIPO_TONE: Record<MemoriaItem["tipo"], BadgeTone> = {
  fato: "blue",
  preferencia: "purple",
  insight: "green",
  resumo: "neutral",
  alerta: "orange",
};

const ORIGEM_LABEL: Record<string, string> = {
  whatsapp_1a1: "WhatsApp 1:1",
  whatsapp_grupo: "Grupo",
  manual: "Manual",
  reuniao: "Reunião",
};

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function MemoriaItemRow({
  item,
  onDispensar,
  dispensando,
}: {
  item: MemoriaItem;
  onDispensar: (id: string) => void;
  dispensando: boolean;
}) {
  return (
    <li className="flex items-start gap-2 rounded-lg border border-border/70 bg-card/60 px-3 py-2">
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-1.5">
          <Badge tone={TIPO_TONE[item.tipo]} size="sm">
            {TIPO_LABEL[item.tipo]}
          </Badge>
          <span className="text-[10px] text-muted-foreground">
            {ORIGEM_LABEL[item.origem] ?? item.origem}
          </span>
          {item.confianca && (
            <span className="text-[10px] text-muted-foreground">· confiança {item.confianca}</span>
          )}
          <span className="ml-auto text-[10px] tabular-nums text-muted-foreground">
            {fmtDateTime(item.createdAt)}
          </span>
        </div>
        <p className="whitespace-pre-wrap text-xs leading-relaxed text-foreground/90">
          {item.conteudo}
        </p>
      </div>
      <button
        type="button"
        onClick={() => onDispensar(item.id)}
        disabled={dispensando}
        aria-label="Dispensar item da memória"
        title="Dispensar (remove da memória)"
        className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground/60 transition-colors hover:bg-sys-red/10 hover:text-sys-red disabled:opacity-50"
      >
        {dispensando ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" />}
      </button>
    </li>
  );
}

export function MemoriaLeadSection({
  atletaId,
  experienciaId,
  formSubmissionId,
  telefone,
  lid,
}: MemoriaLeadSectionProps) {
  const [itens, setItens] = useState<MemoriaItem[] | null>(null);
  const [extraindo, setExtraindo] = useState(false);
  const [dispensandoId, setDispensandoId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const digits = telefone ? cleanPhone(telefone) : "";
  const telefoneValido = isValidPhone(digits);

  const ancoraAtleta = atletaId ?? undefined;
  const ancoraExperiencia = experienciaId ?? undefined;
  const ancoraForm = formSubmissionId ?? undefined;
  const temAncora = Boolean(ancoraAtleta || ancoraExperiencia || ancoraForm);

  // Refetch usado por eventos (após extrair). Fora de efeito → sem cascata.
  const carregar = useCallback(async () => {
    if (!temAncora) return;
    try {
      const data = await listarMemoriaLead({
        atletaId: ancoraAtleta,
        experienciaId: ancoraExperiencia,
        formSubmissionId: ancoraForm,
      });
      setItens(data);
    } catch {
      setItens([]);
    }
  }, [ancoraAtleta, ancoraExperiencia, ancoraForm, temAncora]);

  // Carga inicial: setState só no callback assíncrono (.then), com cancelamento.
  useEffect(() => {
    if (!temAncora) return;
    let cancelado = false;
    listarMemoriaLead({
      atletaId: ancoraAtleta,
      experienciaId: ancoraExperiencia,
      formSubmissionId: ancoraForm,
    })
      .then((data) => {
        if (!cancelado) setItens(data);
      })
      .catch(() => {
        if (!cancelado) setItens([]);
      });
    return () => {
      cancelado = true;
    };
  }, [temAncora, ancoraAtleta, ancoraExperiencia, ancoraForm]);

  // Sem âncora não há o que buscar — trata como lista vazia (sem spinner eterno).
  const lista = temAncora ? itens : [];

  const handleExtrair = useCallback(() => {
    if ((!telefoneValido && !temAncora) || extraindo) return;
    setExtraindo(true);
    startTransition(() => {
      // Multi-fonte: privado do responsável + privado do atleta + grupo(s) da
      // família — as fontes são resolvidas server-side pela âncora.
      void extrairMemoriaLeadCompleta({
        phone: telefoneValido ? digits : undefined,
        lid: lid ?? undefined,
        atletaId: ancoraAtleta,
        experienciaId: ancoraExperiencia,
        formSubmissionId: ancoraForm,
      })
        .then((r) => {
          if (!r.success) {
            toast.error(r.notConfigured ? "IA não configurada neste ambiente." : r.error);
            return;
          }
          const partes = [
            `${r.fatosNovos} ${r.fatosNovos === 1 ? "fato" : "fatos"}`,
            `${r.documentosNovos} ${r.documentosNovos === 1 ? "documento" : "documentos"}`,
          ];
          toast.success(`Memória atualizada: ${partes.join(", ")}.`, {
            description: [
              `${r.fontesAnalisadas} de ${r.fontes} conversa(s) analisada(s) (privados + grupos).`,
              r.documentosPendentesSemAtleta > 0
                ? `${r.documentosPendentesSemAtleta} mídia(s) aguardando o lead virar atleta para anexar.`
                : r.documentosNovos > 0
                  ? "Os documentos capturados aparecem na seção Documentos."
                  : null,
            ]
              .filter(Boolean)
              .join(" "),
          });
          void carregar();
        })
        .catch(() => toast.error("Não foi possível extrair a memória agora."))
        .finally(() => setExtraindo(false));
    });
  }, [
    telefoneValido,
    temAncora,
    extraindo,
    digits,
    lid,
    ancoraAtleta,
    ancoraExperiencia,
    ancoraForm,
    carregar,
  ]);

  const handleDispensar = useCallback(
    (id: string) => {
      setDispensandoId(id);
      startTransition(() => {
        void dispensarMemoriaItem(id)
          .then((r) => {
            if (!r.success) {
              toast.error(r.error ?? "Não foi possível dispensar o item.");
              return;
            }
            setItens((prev) => (prev ? prev.filter((i) => i.id !== id) : prev));
          })
          .catch(() => toast.error("Erro ao dispensar o item."))
          .finally(() => setDispensandoId(null));
      });
    },
    [],
  );

  return (
    <div className="space-y-3">
      <Card accent="brand" className="flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Brain aria-hidden className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-foreground">Memória & Insights</h3>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              A IA lê TODAS as conversas do lead — privado do responsável, privado do atleta e
              grupo(s) da família — extrai fatos e insights duradouros e captura documentos.
              Sob demanda; ela nunca envia nada.
            </p>
          </div>
        </div>

        <Button
          size="sm"
          disabled={(!telefoneValido && !temAncora) || extraindo}
          onClick={handleExtrair}
          className="w-full"
        >
          {extraindo ? <Loader2 className="animate-spin" /> : <Sparkles />}
          Extrair memória de todas as conversas do lead
        </Button>

        {!telefoneValido && (
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Sem WhatsApp válido registrado para este lead — não há conversa 1:1 para analisar.
          </p>
        )}
        <p className="flex items-center gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
          <FileText aria-hidden className="size-3.5 shrink-0 text-primary" />
          Documentos identificados aparecem na seção Documentos. Edite os prompts em Agents.
        </p>
      </Card>

      <div className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Memória do lead {lista && lista.length > 0 ? `(${lista.length})` : ""}
        </p>
        {lista === null ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        ) : lista.length === 0 ? (
          <Card className={cn("py-6")}>
            <EmptyState
              icon={Brain}
              title="Nenhuma memória ainda"
              description={
                temAncora
                  ? "Use o botão acima para a IA extrair fatos e insights da conversa deste lead."
                  : "A memória fica disponível quando o lead tem uma âncora (atleta, experiência ou submissão)."
              }
            />
          </Card>
        ) : (
          <ul className="space-y-2">
            {lista.map((item) => (
              <MemoriaItemRow
                key={item.id}
                item={item}
                onDispensar={handleDispensar}
                dispensando={dispensandoId === item.id}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
