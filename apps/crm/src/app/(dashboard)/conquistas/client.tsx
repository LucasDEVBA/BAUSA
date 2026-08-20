"use client";

import { useState } from "react";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { Crown, Flame, Medal, Sparkles, Trophy, Zap } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type {
  ConquistaView,
  PerfilGamificacao,
  RankingUsuario,
} from "@/lib/gamificacao-queries";
import { PAPEL_LABEL } from "@/lib/papel";
import { cn, formatDate, formatRelativeTime, getInitials } from "@/lib/utils";
import {
  Badge,
  Card,
  ChartCard,
  ChartTooltip,
  EmptyState,
  PageHeader,
  ScrollList,
} from "@/components/ui";

interface ConquistasClientProps {
  userId: string;
  nome: string;
  avatarUrl: string | null;
  perfil: PerfilGamificacao;
  ranking: RankingUsuario[];
}

/** "2026-08-19" (BRT) → "19/08" para o eixo do gráfico. */
function labelDia(dia: string): string {
  return `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
}

export function ConquistasClient({
  userId,
  nome,
  avatarUrl,
  perfil,
  ranking,
}: ConquistasClientProps) {
  const reduzido = useReducedMotion() ?? false;

  const chartData = perfil.xpPorDia.map((d) => ({ label: labelDia(d.dia), xp: d.xp }));
  const faltamXp =
    perfil.xpProximo !== null ? Math.max(0, perfil.xpProximo - perfil.xpNoNivel) : null;

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Gamificação"
        title="Conquistas"
        description="XP por ação real no Engine — níveis, selos e o ranking do time."
      />

      {/* ─── Hero: nível + progresso + streak ─────────────────────────── */}
      <Card padding="lg" className="relative overflow-hidden">
        <span
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-28 size-80 rounded-full bg-primary/10 blur-3xl"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -left-20 size-72 rounded-full bg-bau-burgundy/10 blur-3xl"
        />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <FotoPerfil url={avatarUrl} nome={nome} tamanho="hero" />

            <div className="min-w-0 flex-1">
              <p className="text-eyebrow text-primary">
                {nome} · Nível {perfil.nivel} de {perfil.nivelMaximo}
              </p>
              <h2 className="mt-0.5 bg-gradient-brand bg-clip-text text-4xl font-black tracking-tight text-transparent sm:text-5xl">
                {perfil.nivelNome}
              </h2>

              <div className="mt-4 max-w-md">
                <div
                  role="progressbar"
                  aria-label="Progresso até o próximo nível"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={perfil.progressoPct}
                  className="h-2.5 overflow-hidden rounded-full bg-secondary"
                >
                  <motion.div
                    initial={{ width: reduzido ? `${perfil.progressoPct}%` : "0%" }}
                    animate={{ width: `${perfil.progressoPct}%` }}
                    transition={
                      reduzido ? { duration: 0 } : { duration: 1, ease: [0.22, 1, 0.36, 1], delay: 0.2 }
                    }
                    className="h-full rounded-full bg-gradient-brand"
                  />
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {perfil.xpProximo === null || perfil.proximoNivelNome === null ? (
                    <>Topo da escada — {perfil.xpTotal.toLocaleString("pt-BR")} XP acumulado.</>
                  ) : (
                    <>
                      <span className="font-semibold tabular-nums text-foreground">
                        {perfil.xpNoNivel.toLocaleString("pt-BR")}/
                        {perfil.xpProximo.toLocaleString("pt-BR")} XP
                      </span>{" "}
                      — faltam {faltamXp?.toLocaleString("pt-BR")} para{" "}
                      <span className="font-semibold text-foreground">{perfil.proximoNivelNome}</span>
                    </>
                  )}
                </p>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap gap-3">
            <HeroStat
              icon={<Zap aria-hidden className="size-4 text-primary" />}
              valor={perfil.xpTotal.toLocaleString("pt-BR")}
              rotulo="XP total"
            />
            <HeroStat
              icon={<Flame aria-hidden className="size-4 text-sys-orange" />}
              valor={perfil.streakDias > 0 ? `🔥 ${perfil.streakDias}` : "0"}
              rotulo={perfil.streakDias === 1 ? "dia seguido" : "dias seguidos"}
            />
            <HeroStat
              icon={<Medal aria-hidden className="size-4 text-bau-burgundy" />}
              valor={`${perfil.conquistasDesbloqueadas}/${perfil.conquistas.length}`}
              rotulo="selos"
            />
          </div>
        </div>
      </Card>

      {/* ─── Ranking + XP por dia ─────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="flex flex-col lg:col-span-1">
          <header className="mb-3 shrink-0">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <Trophy aria-hidden className="size-4 text-bau-burgundy" />
              Ranking
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">XP total por pessoa — todo o time</p>
          </header>

          {ranking.length === 0 ? (
            <EmptyState
              icon={Trophy}
              title="Sem ranking ainda"
              description="As primeiras ações pontuadas montam o placar."
            />
          ) : (
            <div className="space-y-2">
              {ranking.map((r, i) => {
                const primeiro = i === 0 && r.xpTotal > 0;
                const souEu = r.userId === userId;
                return (
                  <div
                    key={r.userId}
                    className={cn(
                      "rounded-2xl border p-3",
                      primeiro
                        ? "border-bau-burgundy/25 bg-bau-burgundy/5"
                        : "border-border bg-card/60",
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={cn(
                          "flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                          primeiro
                            ? "bg-bau-burgundy/10 text-bau-burgundy ring-1 ring-bau-burgundy/30"
                            : "bg-secondary text-muted-foreground",
                        )}
                      >
                        {primeiro ? <Crown aria-hidden className="size-4" /> : `${i + 1}º`}
                      </span>
                      <FotoPerfil url={r.avatarUrl} nome={r.nome} tamanho="linha" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="truncate text-sm font-semibold text-foreground">{r.nome}</p>
                          {souEu && (
                            <Badge tone="brand" size="sm">
                              você
                            </Badge>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          {PAPEL_LABEL[r.papel] ?? r.papel} · {r.nivelNome}
                        </p>
                      </div>
                      <p className="shrink-0 text-sm font-bold tabular-nums text-foreground">
                        {r.xpTotal.toLocaleString("pt-BR")}{" "}
                        <span className="text-[10px] font-semibold text-muted-foreground">XP</span>
                      </p>
                    </div>
                    <div className="mt-2 h-1 overflow-hidden rounded-full bg-secondary">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          primeiro ? "bg-bau-burgundy" : "bg-primary/70",
                        )}
                        style={{ width: `${r.progressoPct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <ChartCard
          title="XP por dia"
          subtitle="Últimos 30 dias"
          className="lg:col-span-2"
        >
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="xpDia" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
              <XAxis
                dataKey="label"
                tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                minTickGap={28}
              />
              <YAxis
                tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                allowDecimals={false}
                width={36}
              />
              <Tooltip
                content={
                  <ChartTooltip valueFormatter={(v) => `${Number(v).toLocaleString("pt-BR")} XP`} />
                }
                cursor={{ stroke: "var(--border)" }}
              />
              <Area
                type="monotone"
                dataKey="xp"
                name="XP"
                stroke="var(--chart-1)"
                strokeWidth={2}
                fill="url(#xpDia)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* ─── Galeria de selos + atividade recente ─────────────────────── */}
      <div className="grid items-stretch gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <header className="mb-3 flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Galeria de conquistas</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Selos desbloqueados por marcos reais de trabalho
              </p>
            </div>
            <Badge tone="brand">
              {perfil.conquistasDesbloqueadas} de {perfil.conquistas.length}
            </Badge>
          </header>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {perfil.conquistas.map((c, i) => (
              <ConquistaCard key={c.id} conquista={c} indice={i} reduzido={reduzido} />
            ))}
          </div>
        </Card>

        <Card className="flex h-[26rem] flex-col lg:col-span-1 lg:h-auto">
          <header className="mb-3 shrink-0">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <Sparkles aria-hidden className="size-4 text-primary" />
              Atividade recente
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">Últimas 15 ações pontuadas</p>
          </header>

          {perfil.ultimasAcoes.length === 0 ? (
            <EmptyState
              icon={Sparkles}
              title="Nada pontuado ainda"
              description="Aprove um lead, avance um deal ou conclua uma tarefa — o XP aparece aqui."
            />
          ) : (
            <ScrollList className="space-y-1.5">
              {perfil.ultimasAcoes.map((a, i) => (
                <div
                  key={`${a.criadoEm}-${i}`}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card/60 px-3 py-2"
                >
                  <Badge tone="green" size="sm" className="shrink-0 tabular-nums">
                    +{a.pontos}
                  </Badge>
                  <p className="min-w-0 flex-1 truncate text-sm text-foreground">{a.rotulo}</p>
                  <p className="shrink-0 text-[11px] text-label-tertiary">
                    {formatRelativeTime(a.criadoEm)}
                  </p>
                </div>
              ))}
            </ScrollList>
          )}
        </Card>
      </div>
    </div>
  );
}

function HeroStat({
  icon,
  valor,
  rotulo,
}: {
  icon: React.ReactNode;
  valor: string;
  rotulo: string;
}) {
  return (
    <div className="flex min-w-[6.5rem] flex-col items-center rounded-2xl border border-border bg-card/60 px-4 py-3">
      <span className="mb-1">{icon}</span>
      <p className="text-lg font-bold tabular-nums leading-none text-foreground">{valor}</p>
      <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-label-tertiary">
        {rotulo}
      </p>
    </div>
  );
}

// ─── Foto de perfil (bucket público `avatars`) ───────────────────────────
// Mesmo padrão do Header/Sidebar: next/image com `unoptimized` (o host do
// Supabase Storage NÃO está em images.remotePatterns — sem a flag o otimizador
// rejeita a URL e a foto some). Fallback gracioso: URL quebrada → inicial.

function FotoPerfil({
  url,
  nome,
  tamanho,
}: {
  url: string | null;
  nome: string;
  tamanho: "hero" | "linha";
}) {
  const [erro, setErro] = useState(false);
  const hero = tamanho === "hero";

  if (url && !erro) {
    const foto = (
      <Image
        src={url}
        alt={`Foto de ${nome}`}
        width={hero ? 80 : 32}
        height={hero ? 80 : 32}
        unoptimized
        onError={() => setErro(true)}
        className={
          hero
            ? "size-20 rounded-full border-2 border-card object-cover"
            : "size-8 shrink-0 rounded-full object-cover ring-1 ring-border"
        }
      />
    );
    if (!hero) return foto;
    return (
      <span className="shrink-0 rounded-full bg-gradient-brand p-[3px] shadow-sm">{foto}</span>
    );
  }

  const inicial = (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-gradient-brand font-bold text-white",
        hero ? "size-20 border-2 border-card text-2xl" : "size-8 text-[11px]",
      )}
    >
      {getInitials(nome)}
    </span>
  );
  if (!hero) return inicial;
  return (
    <span className="flex shrink-0 rounded-full bg-gradient-brand p-[3px] shadow-sm">{inicial}</span>
  );
}

// ─── Card de conquista da galeria ────────────────────────────────────────
// Camadas de animação (todas viram fade/estático com prefers-reduced-motion):
//  - entrada em stagger sutil (delay por índice — a lista vem do catálogo e é
//    estática, então não há o gotcha do filho novo em staggerParent)
//  - hover: selo desbloqueado dá scale+tilt com spring; bloqueado balança
//    (denied shake) ao clicar
//  - desbloqueada: brilho periódico varrendo o card (gradiente animado)
//  - ÉPICA desbloqueada: anel de gradiente da marca em rotação lenta

const SHAKE_X = [0, -6, 6, -4, 4, 0];

function ConquistaCard({
  conquista: c,
  indice,
  reduzido,
}: {
  conquista: ConquistaView;
  indice: number;
  reduzido: boolean;
}) {
  const [balancando, setBalancando] = useState(false);
  const epicaDesbloqueada = c.tier === "epica" && c.desbloqueada;
  const pct =
    c.progressoMeta && c.progressoMeta > 0
      ? Math.min(100, Math.round(((c.progressoAtual ?? 0) / c.progressoMeta) * 100))
      : 0;

  return (
    <motion.div
      initial={reduzido ? { opacity: 0 } : { opacity: 0, scale: 0.92 }}
      animate={reduzido ? { opacity: 1 } : { opacity: 1, scale: 1 }}
      transition={
        reduzido
          ? { duration: 0.15 }
          : { type: "spring", stiffness: 300, damping: 24, delay: indice * 0.03 }
      }
      whileHover={
        !reduzido && c.desbloqueada
          ? {
              scale: 1.045,
              rotate: -1.5,
              y: -2,
              transition: { type: "spring", stiffness: 320, damping: 18 },
            }
          : undefined
      }
      onClick={!c.desbloqueada && !reduzido ? () => setBalancando(true) : undefined}
      className={cn(
        "relative rounded-2xl",
        epicaDesbloqueada && "overflow-hidden p-px",
        !c.desbloqueada && "cursor-not-allowed select-none",
      )}
    >
      {/* Anel gradiente animado — só épica desbloqueada */}
      {epicaDesbloqueada &&
        (reduzido ? (
          <span aria-hidden className="absolute inset-0 bg-gradient-brand" />
        ) : (
          <motion.span
            aria-hidden
            style={{
              x: "-50%",
              y: "-50%",
              background:
                "conic-gradient(from 0deg, var(--bau-blue), var(--bau-burgundy-2), var(--bau-blue-2), var(--bau-burgundy), var(--bau-blue))",
            }}
            animate={{ rotate: 360 }}
            transition={{ duration: 9, repeat: Infinity, ease: "linear" }}
            className="absolute left-1/2 top-1/2 aspect-square w-[250%]"
          />
        ))}

      <motion.div
        animate={balancando ? { x: SHAKE_X } : { x: 0 }}
        transition={balancando ? { duration: 0.35, ease: "easeInOut" } : { duration: 0 }}
        onAnimationComplete={() => {
          if (balancando) setBalancando(false);
        }}
        className={cn(
          "relative flex h-full flex-col items-center overflow-hidden p-4 text-center",
          epicaDesbloqueada
            ? "rounded-[calc(1rem-1px)] bg-card"
            : cn(
                "rounded-2xl border",
                c.desbloqueada ? "border-primary/20 bg-primary/5" : "border-border bg-card/60",
              ),
        )}
      >
        {epicaDesbloqueada && (
          <span aria-hidden className="pointer-events-none absolute inset-0 bg-primary/5" />
        )}

        {/* Brilho periódico discreto — só desbloqueadas, dessincronizado por índice */}
        {c.desbloqueada && !reduzido && (
          <motion.span
            aria-hidden
            initial={{ x: "-120%" }}
            animate={{ x: "320%" }}
            transition={{
              duration: 1.4,
              ease: "easeInOut",
              repeat: Infinity,
              repeatDelay: 6.5,
              delay: 1.2 + indice * 0.7,
            }}
            className="pointer-events-none absolute inset-y-0 left-0 w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-primary/10 to-transparent"
          />
        )}

        <span
          aria-hidden
          className={cn(
            "relative flex size-14 items-center justify-center rounded-full text-3xl ring-2",
            c.desbloqueada
              ? epicaDesbloqueada
                ? "bg-primary/10 ring-bau-burgundy/35"
                : "bg-primary/10 ring-primary/30"
              : "bg-secondary opacity-55 grayscale ring-border",
          )}
        >
          {c.selo}
        </span>
        <p
          className={cn(
            "relative mt-2.5 text-sm font-semibold",
            c.desbloqueada ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {c.nome}
        </p>
        <p className="relative mt-0.5 line-clamp-2 text-[11px] leading-snug text-muted-foreground">
          {c.descricao}
        </p>

        {c.desbloqueada && c.desbloqueadaEm ? (
          <Badge tone="brand" size="sm" className="relative mt-2">
            {formatDate(c.desbloqueadaEm)}
          </Badge>
        ) : (
          <div className="relative mt-2.5 w-full">
            {c.progressoMeta !== null && c.progressoMeta > 1 ? (
              <>
                <div className="h-1 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-primary/60"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="mt-1 text-[10px] font-semibold tabular-nums text-label-tertiary">
                  {c.progressoAtual ?? 0}/{c.progressoMeta}
                </p>
              </>
            ) : (
              <p className="text-[10px] font-semibold uppercase tracking-wider text-label-tertiary">
                Bloqueada
              </p>
            )}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
