"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  Users,
  RefreshCw,
  Link2,
  MessageSquareText,
  Loader2,
  X,
  ShieldCheck,
  ShieldOff,
  Info,
} from "lucide-react";
import { toast } from "sonner";

import { Button, Card, EmptyState, Input, PageHeader, ScrollList, Skeleton } from "@/components/ui";
import { cn } from "@/lib/utils";
import {
  definirCapturaGrupo,
  listarAtletasParaVinculo,
  listarGrupos,
  listarMensagensGrupo,
  vincularGrupoFamilia,
  type AtletaOpcao,
  type GrupoItem,
  type GrupoMensagem,
} from "@/lib/actions/whatsapp-grupos";

const PANEL_HEIGHT = "h-[calc(100vh-13rem)] min-h-[24rem]";

const DATA_HORA = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});
const HORA = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});

function formatUltimaAtividade(iso: string | null): string {
  if (!iso) return "Sem atividade";
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? DATA_HORA.format(ms) : "Sem atividade";
}

const MIDIA_LABEL: Record<string, string> = {
  image: "[Foto]",
  audio: "[Áudio]",
  video: "[Vídeo]",
  document: "[Documento]",
  sticker: "[Figurinha]",
  location: "[Localização]",
  contact: "[Contato]",
  reaction: "[Reação]",
  other: "[Mídia]",
};

// ─── Modal de mensagens capturadas do grupo ──────────────────────────────

function MensagensModal({
  grupo,
  onClose,
}: {
  grupo: GrupoItem;
  onClose: () => void;
}) {
  const [mensagens, setMensagens] = useState<GrupoMensagem[] | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // status inicia em "loading" (useState) — o modal é remontado por abertura,
    // então não há setState síncrono aqui (evita cascading render).
    let cancelled = false;
    void listarMensagensGrupo(grupo.grupoId)
      .then((r) => {
        if (cancelled) return;
        if (r.success) {
          setMensagens(r.mensagens);
          setStatus("ready");
        } else {
          setStatus("error");
        }
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [grupo.grupoId]);

  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [mensagens]);

  return (
    <>
      <div className="fixed inset-0 z-[90] bg-black/50 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div className="fixed inset-0 z-[95] flex items-center justify-center p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Mensagens de ${grupo.nome ?? "grupo"}`}
          className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
        >
          <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-3">
            <div className="flex min-w-0 items-center gap-2">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-brand text-white">
                <Users className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">
                  {grupo.nome ?? "Grupo sem nome"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {grupo.totalMensagens.toLocaleString("pt-BR")} mensagem(ns) capturada(s)
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </header>

          {status === "loading" ? (
            <div className="flex flex-1 items-center justify-center py-10">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : status === "error" ? (
            <div className="flex flex-1 items-center justify-center p-6">
              <EmptyState
                icon={Info}
                title="Não foi possível carregar as mensagens"
                description="Tente novamente em instantes."
              />
            </div>
          ) : mensagens && mensagens.length > 0 ? (
            <ScrollList ref={scrollRef} className="space-y-2 p-4" aria-label="Mensagens do grupo">
              {mensagens.map((m) => (
                <div key={m.id} className={cn("flex", m.fromMe ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[80%] space-y-1 rounded-2xl px-3 py-2",
                      m.fromMe ? "rounded-br-md bg-primary/10" : "rounded-bl-md bg-secondary",
                    )}
                  >
                    {!m.fromMe && m.participanteNome && (
                      <p className="text-[11px] font-semibold text-primary">{m.participanteNome}</p>
                    )}
                    <p className="whitespace-pre-wrap break-words text-sm text-foreground">
                      {m.texto ?? MIDIA_LABEL[m.tipo] ?? "[Mídia]"}
                    </p>
                    {m.timestamp !== null && (
                      <p className="text-right text-[10px] tabular-nums text-muted-foreground">
                        {HORA.format(m.timestamp)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </ScrollList>
          ) : (
            <div className="flex flex-1 items-center justify-center p-6">
              <EmptyState
                icon={MessageSquareText}
                title="Nenhuma mensagem capturada ainda"
                description="As mensagens aparecem a partir do momento em que a captura foi ligada — sem histórico retroativo."
              />
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Card de um grupo ────────────────────────────────────────────────────

function GrupoCard({
  grupo,
  atletas,
  onToggleCaptura,
  onVincular,
  onVerMensagens,
  pending,
}: {
  grupo: GrupoItem;
  atletas: AtletaOpcao[];
  onToggleCaptura: (grupo: GrupoItem) => void;
  onVincular: (grupo: GrupoItem, atletaId: string | null) => void;
  onVerMensagens: (grupo: GrupoItem) => void;
  pending: boolean;
}) {
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-brand text-white">
            <Users className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">
              {grupo.nome ?? "Grupo sem nome"}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              Última atividade: {formatUltimaAtividade(grupo.lastMessageAt)}
            </p>
          </div>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
            grupo.capturar ? "bg-sys-green/12 text-sys-green" : "bg-secondary text-muted-foreground",
          )}
        >
          {grupo.capturar
            ? `${grupo.totalMensagens.toLocaleString("pt-BR")} capturadas`
            : "captura desligada"}
        </span>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        {/* Toggle de captura (opt-in consciente) */}
        <button
          type="button"
          role="switch"
          aria-checked={grupo.capturar}
          disabled={pending}
          onClick={() => onToggleCaptura(grupo)}
          className={cn(
            "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50",
            grupo.capturar
              ? "border-sys-green/30 bg-sys-green/10 text-sys-green hover:bg-sys-green/15"
              : "border-border text-muted-foreground hover:bg-accent hover:text-foreground",
          )}
        >
          {grupo.capturar ? <ShieldCheck className="size-3.5" /> : <ShieldOff className="size-3.5" />}
          {grupo.capturar ? "Capturando histórico" : "Capturar histórico"}
        </button>

        {grupo.capturar && grupo.totalMensagens > 0 && (
          <Button variant="secondary" size="sm" onClick={() => onVerMensagens(grupo)}>
            <MessageSquareText />
            Ver mensagens
          </Button>
        )}
      </div>

      {/* Vínculo à família (atleta) */}
      <label className="flex flex-col gap-1">
        <span className="flex items-center gap-1.5 text-eyebrow text-label-tertiary">
          <Link2 className="size-3" />
          Vincular à família
        </span>
        <select
          value={grupo.atletaId ?? ""}
          disabled={pending}
          onChange={(e) => onVincular(grupo, e.target.value === "" ? null : e.target.value)}
          className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        >
          <option value="">Sem vínculo</option>
          {atletas.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nome}
            </option>
          ))}
        </select>
      </label>
    </Card>
  );
}

// ─── Tela de grupos ──────────────────────────────────────────────────────

export function GruposClient() {
  const [grupos, setGrupos] = useState<GrupoItem[]>([]);
  const [atletas, setAtletas] = useState<AtletaOpcao[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [mensagensGrupo, setMensagensGrupo] = useState<GrupoItem | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const carregar = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setStatus("loading");
    try {
      const [gruposRes, atletasRes] = await Promise.all([
        listarGrupos(),
        listarAtletasParaVinculo(),
      ]);
      if (gruposRes.success) {
        setGrupos(gruposRes.grupos);
        setStatus("ready");
      } else {
        setStatus("error");
      }
      setAtletas(atletasRes);
    } catch {
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await carregar({ silent: true });
    } finally {
      setRefreshing(false);
    }
  }, [carregar]);

  const handleToggleCaptura = useCallback((grupo: GrupoItem) => {
    const proximo = !grupo.capturar;
    // Otimista: reflete de imediato; reverte no erro.
    setGrupos((prev) =>
      prev.map((g) => (g.grupoId === grupo.grupoId ? { ...g, capturar: proximo } : g)),
    );
    setPendingId(grupo.grupoId);
    startTransition(() => {
      void definirCapturaGrupo(grupo.grupoId, proximo)
        .then((r) => {
          if (!r.success) {
            setGrupos((prev) =>
              prev.map((g) =>
                g.grupoId === grupo.grupoId ? { ...g, capturar: grupo.capturar } : g,
              ),
            );
            toast.error(r.error);
          } else {
            toast.success(proximo ? "Captura ligada para este grupo." : "Captura desligada.");
          }
        })
        .finally(() => setPendingId(null));
    });
  }, []);

  const handleVincular = useCallback(
    (grupo: GrupoItem, atletaId: string | null) => {
      const anterior = grupo.atletaId;
      const nome = atletaId ? (atletas.find((a) => a.id === atletaId)?.nome ?? null) : null;
      setGrupos((prev) =>
        prev.map((g) =>
          g.grupoId === grupo.grupoId ? { ...g, atletaId, atletaNome: nome } : g,
        ),
      );
      setPendingId(grupo.grupoId);
      startTransition(() => {
        void vincularGrupoFamilia(grupo.grupoId, atletaId)
          .then((r) => {
            if (!r.success) {
              setGrupos((prev) =>
                prev.map((g) =>
                  g.grupoId === grupo.grupoId ? { ...g, atletaId: anterior } : g,
                ),
              );
              toast.error(r.error);
            } else {
              toast.success(atletaId ? "Grupo vinculado à família." : "Vínculo removido.");
            }
          })
          .finally(() => setPendingId(null));
      });
    },
    [atletas],
  );

  const termo = search.trim().toLowerCase();
  const filtrados =
    termo.length === 0
      ? grupos
      : grupos.filter((g) => (g.nome ?? "").toLowerCase().includes(termo));

  return (
    <div className="space-y-4">
      <PageHeader
        dense
        eyebrow="Comercial"
        title="Grupos de clientes"
        description="Grupos de WhatsApp com os clientes — ligue a captura por grupo e vincule cada um à família. Fundação dos agents de WhatsApp."
        actions={
          <Button variant="secondary" size="sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={cn(refreshing && "animate-spin")} />
            Atualizar
          </Button>
        }
      />

      <div className="max-w-xs">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar grupo por nome"
          aria-label="Buscar grupo"
        />
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-border bg-secondary/40 px-3 py-2 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        <p>
          Todo grupo aparece aqui automaticamente, mas o conteúdo das mensagens só é armazenado nos
          grupos com a captura ligada (opt-in). Não há histórico retroativo — a captura vale das
          próximas mensagens em diante.
        </p>
      </div>

      {status === "loading" ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-xl" />
          ))}
        </div>
      ) : status === "error" ? (
        <Card className={cn("flex items-center justify-center", PANEL_HEIGHT)}>
          <EmptyState
            icon={Info}
            title="Não foi possível carregar os grupos"
            description="Tente novamente em instantes."
            action={
              <Button variant="secondary" size="sm" onClick={() => void carregar()}>
                <RefreshCw />
                Tentar novamente
              </Button>
            }
          />
        </Card>
      ) : filtrados.length === 0 ? (
        <Card className={cn("flex items-center justify-center", PANEL_HEIGHT)}>
          <EmptyState
            icon={Users}
            title={termo.length > 0 ? "Nenhum grupo encontrado" : "Nenhum grupo detectado ainda"}
            description={
              termo.length > 0
                ? "Ajuste a busca pelo nome do grupo."
                : "Mande ou receba uma mensagem em um grupo do WhatsApp comercial para ele aparecer aqui."
            }
          />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtrados.map((grupo) => (
            <GrupoCard
              key={grupo.grupoId}
              grupo={grupo}
              atletas={atletas}
              pending={pendingId === grupo.grupoId}
              onToggleCaptura={handleToggleCaptura}
              onVincular={handleVincular}
              onVerMensagens={setMensagensGrupo}
            />
          ))}
        </div>
      )}

      {mensagensGrupo && (
        <MensagensModal grupo={mensagensGrupo} onClose={() => setMensagensGrupo(null)} />
      )}
    </div>
  );
}
