"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Sparkles, Trophy } from "lucide-react";

import { useGamificacaoStore, type Celebracao } from "@/lib/gamificacao-store";
import { cn } from "@/lib/utils";

/**
 * Celebrações globais de gamificação — montado uma vez no layout do dashboard.
 *
 * Três camadas independentes, alimentadas pela fila do store:
 *  - Toast de +XP (pílula flutuante, base da tela, micro-animação de subida)
 *  - Overlay de level-up (nome do nível com spring + brilho radial + confetti
 *    leve em CSS/framer — auto-fecha em ~4s, clique ou Esc)
 *  - Card de conquista (selo girando em flip 3D + nome + descrição)
 *
 * A11y: containers com role="status"/aria-live (não roubam foco);
 * prefers-reduced-motion troca springs/partículas por fades simples.
 */

const VIDA_XP_MS = 3000;
const VIDA_LEVELUP_MS = 4200;
const VIDA_CONQUISTA_MS = 6200;

const CONFETTI_CORES = [
  "var(--bau-blue)",
  "var(--bau-blue-2)",
  "var(--bau-burgundy)",
  "var(--bau-burgundy-2)",
  "var(--sys-orange)",
] as const;

interface Particula {
  x: number;
  y: number;
  queda: number;
  rotacao: number;
  atraso: number;
  tamanho: number;
  cor: string;
  redonda: boolean;
}

function gerarParticulas(quantidade: number): Particula[] {
  return Array.from({ length: quantidade }, (_, i) => {
    const angulo = (i / quantidade) * Math.PI * 2 + Math.random() * 0.5;
    const raio = 90 + Math.random() * 150;
    return {
      x: Math.cos(angulo) * raio,
      y: Math.sin(angulo) * raio * 0.7 - 40,
      queda: 120 + Math.random() * 80,
      rotacao: (Math.random() - 0.5) * 540,
      atraso: Math.random() * 0.25,
      tamanho: 5 + Math.random() * 5,
      cor: CONFETTI_CORES[i % CONFETTI_CORES.length],
      redonda: i % 3 === 0,
    };
  });
}

// ─── Toast de +XP ────────────────────────────────────────────────────────

function XpToast({ celebracao, reduzido }: { celebracao: Celebracao; reduzido: boolean }) {
  const [visivel, setVisivel] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setVisivel(false), VIDA_XP_MS);
    return () => clearTimeout(t);
  }, []);

  return (
    <AnimatePresence>
      {visivel && (
        <motion.div
          initial={reduzido ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.9 }}
          animate={reduzido ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
          exit={reduzido ? { opacity: 0 } : { opacity: 0, y: -16, scale: 0.96 }}
          transition={
            reduzido ? { duration: 0.15 } : { type: "spring", stiffness: 420, damping: 28 }
          }
          className="pointer-events-none flex items-center gap-2.5 rounded-full border border-border bg-popover py-2 pl-2 pr-4 shadow-lg"
        >
          <span className="flex size-7 items-center justify-center rounded-full bg-gradient-brand text-white">
            <Sparkles aria-hidden className="size-3.5" />
          </span>
          <span className="text-sm font-bold tabular-nums text-foreground">
            +{celebracao.resultado.pontos} XP
          </span>
          <span aria-hidden className="text-label-tertiary">
            ·
          </span>
          <span className="text-sm text-muted-foreground">{celebracao.rotulo}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Overlay de level-up ─────────────────────────────────────────────────

function LevelUpOverlay({
  celebracao,
  reduzido,
  onFechar,
}: {
  celebracao: Celebracao;
  reduzido: boolean;
  onFechar: () => void;
}) {
  const particulas = useMemo(() => (reduzido ? [] : gerarParticulas(26)), [reduzido]);
  const { resultado } = celebracao;

  useEffect(() => {
    const t = setTimeout(onFechar, VIDA_LEVELUP_MS);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFechar();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [onFechar]);

  return (
    <motion.div
      role="status"
      aria-live="assertive"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduzido ? 0.15 : 0.25 }}
      onClick={onFechar}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background/60 backdrop-blur-sm"
    >
      {/* Brilho radial nas cores da marca */}
      {!reduzido && (
        <>
          <motion.span
            aria-hidden
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1.15, opacity: 1 }}
            transition={{ duration: 0.9, ease: "easeOut" }}
            className="pointer-events-none absolute size-[26rem] rounded-full bg-primary/20 blur-3xl"
          />
          <motion.span
            aria-hidden
            initial={{ scale: 0.3, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 1.1, ease: "easeOut", delay: 0.1 }}
            className="pointer-events-none absolute size-72 translate-x-24 rounded-full bg-bau-burgundy/15 blur-3xl"
          />
        </>
      )}

      {/* Confetti leve (CSS/framer — sem lib nova) */}
      {particulas.map((p, i) => (
        <motion.span
          key={i}
          aria-hidden
          initial={{ x: 0, y: 0, opacity: 1, scale: 0, rotate: 0 }}
          animate={{
            x: p.x,
            y: [0, p.y, p.y + p.queda],
            opacity: [1, 1, 0],
            scale: [0, 1, 0.85],
            rotate: p.rotacao,
          }}
          transition={{ duration: 1.7, delay: p.atraso, ease: "easeOut" }}
          className={cn("pointer-events-none absolute", p.redonda ? "rounded-full" : "rounded-[2px]")}
          style={{ width: p.tamanho, height: p.tamanho, backgroundColor: p.cor }}
        />
      ))}

      <div className="relative flex flex-col items-center px-6 text-center">
        <motion.span
          initial={reduzido ? { opacity: 0 } : { opacity: 0, scale: 0.5, y: 12 }}
          animate={reduzido ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
          transition={
            reduzido ? { duration: 0.15 } : { type: "spring", stiffness: 320, damping: 20 }
          }
          className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-gradient-brand text-white shadow-lg"
        >
          <Trophy aria-hidden className="size-7" />
        </motion.span>

        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduzido ? 0.15 : 0.3, delay: reduzido ? 0 : 0.15 }}
          className="text-eyebrow text-primary"
        >
          Subiu de nível
        </motion.p>

        <motion.h2
          initial={reduzido ? { opacity: 0 } : { opacity: 0, scale: 0.6, y: 20 }}
          animate={reduzido ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
          transition={
            reduzido
              ? { duration: 0.15 }
              : { type: "spring", stiffness: 260, damping: 18, delay: 0.2 }
          }
          className="mt-1 bg-gradient-brand bg-clip-text text-5xl font-black tracking-tight text-transparent sm:text-6xl"
        >
          {resultado.nivelNome}
        </motion.h2>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: reduzido ? 0.15 : 0.3, delay: reduzido ? 0 : 0.4 }}
          className="mt-3 text-sm text-muted-foreground"
        >
          Nível {resultado.nivel} · {resultado.xpTotal.toLocaleString("pt-BR")} XP acumulado
        </motion.p>

        <motion.button
          type="button"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: reduzido ? 0.15 : 0.3, delay: reduzido ? 0 : 0.6 }}
          onClick={onFechar}
          className="mt-6 rounded-full border border-border bg-popover px-4 py-1.5 text-xs font-semibold text-muted-foreground shadow-sm transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Continuar
        </motion.button>
      </div>
    </motion.div>
  );
}

// ─── Card de conquista ───────────────────────────────────────────────────

function ConquistaToast({
  conquista,
  reduzido,
}: {
  conquista: { id: string; nome: string; descricao: string; selo: string };
  reduzido: boolean;
}) {
  return (
    <motion.div
      layout
      initial={reduzido ? { opacity: 0 } : { opacity: 0, x: 48, scale: 0.95 }}
      animate={reduzido ? { opacity: 1 } : { opacity: 1, x: 0, scale: 1 }}
      exit={reduzido ? { opacity: 0 } : { opacity: 0, x: 32, scale: 0.96 }}
      transition={reduzido ? { duration: 0.15 } : { type: "spring", stiffness: 320, damping: 26 }}
      className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-primary/20 bg-popover p-3.5 shadow-xl"
      style={{ perspective: 600 }}
    >
      <motion.span
        aria-hidden
        initial={reduzido ? undefined : { rotateY: 180 }}
        animate={reduzido ? undefined : { rotateY: 540 }}
        transition={reduzido ? undefined : { duration: 1.1, ease: "easeOut", delay: 0.15 }}
        style={{ transformStyle: "preserve-3d" }}
        className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-2xl ring-2 ring-primary/25"
      >
        {conquista.selo}
      </motion.span>
      <div className="min-w-0">
        <p className="text-eyebrow text-primary">Conquista desbloqueada</p>
        <p className="mt-0.5 truncate text-sm font-bold text-foreground">{conquista.nome}</p>
        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{conquista.descricao}</p>
      </div>
    </motion.div>
  );
}

// ─── Orquestrador ────────────────────────────────────────────────────────

export function Celebracoes() {
  const fila = useGamificacaoStore((s) => s.fila);
  const concluir = useGamificacaoStore((s) => s.concluir);
  const reduzido = useReducedMotion() ?? false;
  const [overlaysFechados, setOverlaysFechados] = useState<ReadonlySet<number>>(new Set());
  const agendados = useRef(new Set<number>());
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Cada entrada da fila vive até a camada mais longa que ela dispara.
  useEffect(() => {
    for (const c of fila) {
      if (agendados.current.has(c.id)) continue;
      agendados.current.add(c.id);
      const vida = Math.max(
        VIDA_XP_MS + 400,
        c.resultado.subiuDeNivel ? VIDA_LEVELUP_MS + 400 : 0,
        c.resultado.conquistasNovas.length > 0 ? VIDA_CONQUISTA_MS : 0,
      );
      timers.current.push(setTimeout(() => concluir(c.id), vida));
    }
  }, [fila, concluir]);

  useEffect(() => {
    const pendentes = timers.current;
    return () => pendentes.forEach(clearTimeout);
  }, []);

  const levelUp =
    [...fila].reverse().find((c) => c.resultado.subiuDeNivel && !overlaysFechados.has(c.id)) ??
    null;

  const conquistas = fila.flatMap((c) =>
    c.resultado.conquistasNovas.map((cq) => ({ key: `${c.id}-${cq.id}`, ...cq })),
  );

  return (
    <>
      {/* Toasts de +XP */}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-6 z-[95] flex flex-col items-center gap-2 px-4"
      >
        {fila.map((c) => (
          <XpToast key={c.id} celebracao={c} reduzido={reduzido} />
        ))}
      </div>

      {/* Cards de conquista */}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed bottom-6 right-6 z-[96] flex w-80 max-w-[calc(100vw-3rem)] flex-col gap-2.5"
      >
        <AnimatePresence>
          {conquistas.map((cq) => (
            <ConquistaToast key={cq.key} conquista={cq} reduzido={reduzido} />
          ))}
        </AnimatePresence>
      </div>

      {/* Overlay de level-up */}
      <AnimatePresence>
        {levelUp && (
          <LevelUpOverlay
            key={levelUp.id}
            celebracao={levelUp}
            reduzido={reduzido}
            onFechar={() =>
              setOverlaysFechados((prev) => {
                const next = new Set(prev);
                next.add(levelUp.id);
                return next;
              })
            }
          />
        )}
      </AnimatePresence>
    </>
  );
}
