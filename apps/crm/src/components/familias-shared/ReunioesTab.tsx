"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Plus,
  Video,
  X,
  CheckCircle2,
  Ban,
  ExternalLink,
} from "lucide-react";
import {
  listarReunioesFamilia,
  criarReuniao,
  confirmarReuniaoRealizada,
  cancelarReuniao,
  type ReuniaoFamilia,
} from "@/lib/actions/reunioes";
import {
  getOnboardingByExperiencia,
  type OnboardingEtapaEstado,
} from "@/lib/actions/onboarding";
import { cn } from "@/lib/utils";
import { ScrollList } from "@/components/ui";
import { toast } from "sonner";

interface ReunioesTabProps {
  experienciaId: string;
  athleteName: string;
}

export function ReunioesTab({ experienciaId, athleteName }: ReunioesTabProps) {
  const router = useRouter();
  const [loadPending, startLoadTransition] = useTransition();
  const [reunioes, setReunioes] = useState<ReuniaoFamilia[]>([]);
  const [etapasOnboarding, setEtapasOnboarding] = useState<
    OnboardingEtapaEstado[]
  >([]);
  const [showCreate, setShowCreate] = useState(false);

  const load = () => {
    startLoadTransition(async () => {
      const [data, onboarding] = await Promise.all([
        listarReunioesFamilia(experienciaId),
        getOnboardingByExperiencia(experienciaId),
      ]);
      setReunioes(data);
      setEtapasOnboarding(onboarding.etapas);
    });
  };

  useEffect(() => {
    let cancelled = false;
    startLoadTransition(async () => {
      const [data, onboarding] = await Promise.all([
        listarReunioesFamilia(experienciaId),
        getOnboardingByExperiencia(experienciaId),
      ]);
      if (!cancelled) {
        setReunioes(data);
        setEtapasOnboarding(onboarding.etapas);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [experienciaId]);

  const etapaTituloById = new Map(
    etapasOnboarding.map((e) => [e.id, `Etapa ${e.ordem} — ${e.titulo}`]),
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Reuniões da família
        </p>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary/90"
        >
          <Plus className="h-3 w-3" />
          Agendar reunião
        </button>
      </div>

      {showCreate && (
        <CreateReuniaoForm
          experienciaId={experienciaId}
          athleteName={athleteName}
          etapasOnboarding={etapasOnboarding}
          onSaved={() => {
            setShowCreate(false);
            load();
            router.refresh();
          }}
          onCancel={() => setShowCreate(false)}
        />
      )}

      {loadPending ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
          Carregando...
        </div>
      ) : reunioes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-10 text-center">
          <Video className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            Nenhuma reunião registrada ainda.
          </p>
        </div>
      ) : (
        <ScrollList className="h-[18rem] space-y-2">
          {reunioes.map((r) => (
            <ReuniaoCard
              key={r.id}
              reuniao={r}
              athleteName={athleteName}
              etapaTitulo={
                r.etapa_estado_id
                  ? etapaTituloById.get(r.etapa_estado_id) ?? null
                  : null
              }
              onChanged={() => {
                load();
                router.refresh();
              }}
            />
          ))}
        </ScrollList>
      )}
    </div>
  );
}

function CreateReuniaoForm({
  experienciaId,
  athleteName,
  etapasOnboarding,
  onSaved,
  onCancel,
}: {
  experienciaId: string;
  athleteName: string;
  etapasOnboarding: OnboardingEtapaEstado[];
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [titulo, setTitulo] = useState(`Call com ${athleteName.split(" ")[0]}`);
  const [data, setData] = useState(() => {
    const d = new Date(Date.now() + 86400000); // amanhã
    d.setHours(10, 0, 0, 0);
    return d.toISOString().slice(0, 16);
  });
  const [duracao, setDuracao] = useState(30);
  const [link, setLink] = useState("");
  const [etapaId, setEtapaId] = useState("");
  const [assuntoNovo, setAssuntoNovo] = useState("");
  const [assuntos, setAssuntos] = useState<string[]>([]);

  const etapasAbertas = etapasOnboarding.filter(
    (e) => e.status === "pendente" || e.status === "em_andamento",
  );

  const addAssunto = () => {
    if (!assuntoNovo.trim()) return;
    setAssuntos((prev) => [...prev, assuntoNovo.trim()]);
    setAssuntoNovo("");
  };
  const removeAssunto = (idx: number) => {
    setAssuntos((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = () => {
    if (!titulo.trim()) {
      toast.error("Título obrigatório");
      return;
    }
    if (!data) {
      toast.error("Data e hora obrigatórias");
      return;
    }
    startTransition(async () => {
      const result = await criarReuniao(experienciaId, {
        titulo,
        assuntos,
        data_hora: new Date(data).toISOString(),
        duracao_minutos: duracao,
        link_reuniao: link || undefined,
        etapa_estado_id: etapaId || undefined,
      });
      if (result.success) {
        toast.success("Reunião agendada", { description: athleteName });
        onSaved();
      } else {
        toast.error(result.error ?? "Falha");
      }
    });
  };

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">
          Nova reunião
        </p>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md p-1 text-muted-foreground hover:text-foreground"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      <div>
        <label className="block text-[10px] text-muted-foreground mb-1">
          Título *
        </label>
        <input
          type="text"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          className="w-full rounded-md border border-border bg-card px-2.5 py-2 text-xs text-foreground outline-none focus:border-primary/40"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] text-muted-foreground mb-1">
            Data e hora *
          </label>
          <input
            type="datetime-local"
            value={data}
            onChange={(e) => setData(e.target.value)}
            className="w-full rounded-md border border-border bg-card px-2.5 py-2 text-xs text-foreground outline-none focus:border-primary/40"
          />
        </div>
        <div>
          <label className="block text-[10px] text-muted-foreground mb-1">
            Duração (min)
          </label>
          <input
            type="number"
            value={duracao}
            onChange={(e) => setDuracao(Number(e.target.value))}
            min={5}
            step={5}
            className="w-full rounded-md border border-border bg-card px-2.5 py-2 text-xs text-foreground outline-none focus:border-primary/40"
          />
        </div>
      </div>

      <div>
        <label className="block text-[10px] text-muted-foreground mb-1">
          Link da reunião (Google Meet, Zoom, etc.)
        </label>
        <input
          type="url"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="https://meet.google.com/..."
          className="w-full rounded-md border border-border bg-card px-2.5 py-2 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/40"
        />
      </div>

      {etapasAbertas.length > 0 && (
        <div>
          <label className="block text-[10px] text-muted-foreground mb-1">
            Vincular a etapa do onboarding (opcional)
          </label>
          <select
            value={etapaId}
            onChange={(e) => setEtapaId(e.target.value)}
            className="w-full rounded-md border border-border bg-card px-2.5 py-2 text-xs text-foreground outline-none focus:border-primary/40"
          >
            <option value="">Sem vínculo</option>
            {etapasAbertas.map((e) => (
              <option key={e.id} value={e.id}>
                Etapa {e.ordem} — {e.titulo}
                {e.requer_reuniao ? " (exige reunião)" : ""}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[9px] text-muted-foreground">
            Etapas que exigem reunião só podem ser concluídas com uma reunião
            vinculada.
          </p>
        </div>
      )}

      <div>
        <label className="block text-[10px] text-muted-foreground mb-1">
          Assuntos / pauta
        </label>
        <div className="flex gap-1.5 mb-1.5">
          <input
            type="text"
            value={assuntoNovo}
            onChange={(e) => setAssuntoNovo(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addAssunto();
              }
            }}
            placeholder="Ex: Alinhar próximos passos"
            className="flex-1 rounded-md border border-border bg-card px-2.5 py-2 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/40"
          />
          <button
            type="button"
            onClick={addAssunto}
            className="rounded-md border border-border bg-card px-3 py-2 text-xs font-medium text-foreground hover:bg-accent"
          >
            +
          </button>
        </div>
        {assuntos.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {assuntos.map((a, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-1.5 py-0.5 text-[10px] text-foreground"
              >
                {a}
                <button
                  type="button"
                  onClick={() => removeAssunto(i)}
                  className="text-muted-foreground hover:text-sys-red"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={handleSubmit}
        disabled={isPending}
        className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
      >
        {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        Agendar reunião (notifica CEO)
      </button>
    </div>
  );
}

function ReuniaoCard({
  reuniao,
  athleteName,
  etapaTitulo,
  onChanged,
}: {
  reuniao: ReuniaoFamilia;
  athleteName: string;
  etapaTitulo: string | null;
  onChanged: () => void;
}) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [notas, setNotas] = useState("");
  const [assuntoDiscutido, setAssuntoDiscutido] = useState("");
  const [assuntosDiscutidos, setAssuntosDiscutidos] = useState<string[]>([]);
  const [motivo, setMotivo] = useState("");
  const [isPending, startTransition] = useTransition();

  const data = new Date(reuniao.data_hora);
  const isAgendada = reuniao.status === "agendada";
  const isRealizada = reuniao.status === "realizada";
  const isCancelada = reuniao.status === "cancelada";
  const isFuture = data > new Date();

  const handleConfirm = () => {
    if (!notas.trim()) {
      toast.error("Notas obrigatórias");
      return;
    }
    startTransition(async () => {
      const result = await confirmarReuniaoRealizada(reuniao.id, {
        notas_realizacao: notas,
        assuntos_discutidos: assuntosDiscutidos,
      });
      if (result.success) {
        toast.success("Reunião confirmada", { description: athleteName });
        setShowConfirm(false);
        onChanged();
      } else {
        toast.error(result.error ?? "Falha");
      }
    });
  };

  const handleCancel = () => {
    if (!motivo.trim()) {
      toast.error("Motivo obrigatório");
      return;
    }
    startTransition(async () => {
      const result = await cancelarReuniao(reuniao.id, motivo);
      if (result.success) {
        toast.success("Reunião cancelada");
        setShowCancel(false);
        onChanged();
      } else {
        toast.error(result.error ?? "Falha");
      }
    });
  };

  return (
    <div
      className={cn(
        "rounded-xl border p-4 transition-colors",
        isRealizada && "border-sys-green/30 bg-sys-green/5",
        isCancelada && "border-border bg-card opacity-60",
        isAgendada && isFuture && "border-primary/30 bg-primary/5",
        isAgendada && !isFuture && "border-sys-orange/40 bg-sys-orange/5",
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 flex-col items-center justify-center rounded-lg bg-card border border-border text-foreground shrink-0">
          <span className="text-[9px] font-semibold uppercase text-muted-foreground">
            {data.toLocaleDateString("pt-BR", { month: "short" })}
          </span>
          <span className="text-sm font-bold leading-none">
            {data.getDate()}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="text-sm font-semibold text-foreground truncate">
              {reuniao.titulo}
            </p>
            <span
              className={cn(
                "text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full",
                isRealizada && "bg-sys-green/15 text-sys-green",
                isCancelada && "bg-card text-muted-foreground border border-border",
                isAgendada && "bg-primary/15 text-primary",
              )}
            >
              {reuniao.status}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {data.toLocaleString("pt-BR", {
              dateStyle: "short",
              timeStyle: "short",
            })}{" "}
            · {reuniao.duracao_minutos}min
          </p>

          {etapaTitulo && (
            <span className="mt-1 inline-flex items-center gap-1 rounded-md bg-sys-purple/10 px-1.5 py-0.5 text-[9px] font-semibold text-sys-purple">
              Onboarding: {etapaTitulo}
            </span>
          )}

          {reuniao.assuntos.length > 0 && (
            <div className="mt-2">
              <p className="text-[9px] font-semibold uppercase text-muted-foreground mb-1">
                Pauta
              </p>
              <ul className="space-y-0.5">
                {reuniao.assuntos.map((a, i) => (
                  <li
                    key={i}
                    className="text-[11px] text-foreground"
                  >
                    • {a}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {reuniao.link_reuniao && (
            <a
              href={reuniao.link_reuniao}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-sys-blue hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              Abrir reunião
            </a>
          )}

          {isRealizada && reuniao.notas_realizacao && (
            <div className="mt-3 rounded-md bg-card border border-border p-2.5">
              <p className="text-[9px] font-semibold uppercase text-muted-foreground mb-1">
                Notas
              </p>
              <p className="text-[11px] text-foreground whitespace-pre-wrap">
                {reuniao.notas_realizacao}
              </p>
              {reuniao.assuntos_discutidos.length > 0 && (
                <>
                  <p className="text-[9px] font-semibold uppercase text-muted-foreground mt-2 mb-1">
                    Assuntos discutidos
                  </p>
                  <p className="text-[11px] text-foreground">
                    {reuniao.assuntos_discutidos.join(" · ")}
                  </p>
                </>
              )}
            </div>
          )}

          {isCancelada && reuniao.cancelada_motivo && (
            <p className="mt-2 text-[10px] text-muted-foreground italic">
              Motivo: {reuniao.cancelada_motivo}
            </p>
          )}
        </div>
      </div>

      {isAgendada && (
        <div className="mt-3 pt-3 border-t border-border flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowConfirm(!showConfirm)}
            className="flex items-center gap-1 rounded-md border border-sys-green/30 bg-sys-green/10 px-2 py-1 text-[10px] font-semibold text-sys-green hover:bg-sys-green/20"
          >
            <CheckCircle2 className="h-3 w-3" />
            Confirmar realizada
          </button>
          <button
            type="button"
            onClick={() => setShowCancel(!showCancel)}
            className="flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-[10px] font-semibold text-muted-foreground hover:bg-accent"
          >
            <Ban className="h-3 w-3" />
            Cancelar
          </button>

          {showConfirm && (
            <div className="basis-full mt-2 space-y-2">
              <textarea
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                rows={3}
                placeholder="Notas da reunião — o que foi discutido, decisões, próximos passos *"
                className="w-full rounded-md border border-border bg-card px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-sys-green/40"
              />
              <div>
                <label className="block text-[9px] font-semibold uppercase text-muted-foreground mb-1">
                  Assuntos discutidos (opcional)
                </label>
                <div className="flex gap-1.5 mb-1.5">
                  <input
                    type="text"
                    value={assuntoDiscutido}
                    onChange={(e) => setAssuntoDiscutido(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && assuntoDiscutido.trim()) {
                        e.preventDefault();
                        setAssuntosDiscutidos((p) => [...p, assuntoDiscutido.trim()]);
                        setAssuntoDiscutido("");
                      }
                    }}
                    placeholder="Adicione e tecle Enter"
                    className="flex-1 rounded-md border border-border bg-card px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-sys-green/40"
                  />
                </div>
                {assuntosDiscutidos.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {assuntosDiscutidos.map((a, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-1.5 py-0.5 text-[10px] text-foreground"
                      >
                        {a}
                        <button
                          type="button"
                          onClick={() =>
                            setAssuntosDiscutidos((p) => p.filter((_, idx) => idx !== i))
                          }
                          className="text-muted-foreground hover:text-sys-red"
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={isPending}
                className="flex items-center justify-center gap-1 rounded-md bg-sys-green px-3 py-1.5 text-[10px] font-semibold text-white hover:bg-sys-green/90 disabled:opacity-50"
              >
                {isPending && <Loader2 className="h-3 w-3 animate-spin" />}
                Confirmar (notifica CEO)
              </button>
            </div>
          )}

          {showCancel && (
            <div className="basis-full mt-2 space-y-2">
              <textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                rows={2}
                placeholder="Motivo do cancelamento *"
                className="w-full rounded-md border border-border bg-card px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-sys-red/40"
              />
              <button
                type="button"
                onClick={handleCancel}
                disabled={isPending}
                className="flex items-center justify-center gap-1 rounded-md bg-sys-red px-3 py-1.5 text-[10px] font-semibold text-white hover:bg-sys-red/90 disabled:opacity-50"
              >
                {isPending && <Loader2 className="h-3 w-3 animate-spin" />}
                Confirmar cancelamento
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
