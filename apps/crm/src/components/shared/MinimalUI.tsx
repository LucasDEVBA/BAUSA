"use client";

import { type LucideIcon, Copy, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ─── Section: page-level vertical rhythm ────────────────────────

export function MinimalPage({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-3", className)}>{children}</div>
  );
}

// ─── Card: minimal container without heavy header ───────────────

interface CardProps {
  title?: string;
  icon?: LucideIcon;
  iconColor?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function MinimalCard({
  title,
  icon: Icon,
  iconColor,
  action,
  children,
  className,
}: CardProps) {
  return (
    <section
      className={cn(
        "rounded-lg border border-border/70 bg-card/60 p-3",
        className,
      )}
    >
      {(title || action) && (
        <header className="mb-2 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            {Icon && (
              <Icon
                className={cn(
                  "h-3 w-3",
                  iconColor ?? "text-muted-foreground/60",
                )}
              />
            )}
            {title && (
              <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                {title}
              </h3>
            )}
          </div>
          {action}
        </header>
      )}
      <div>{children}</div>
    </section>
  );
}

// ─── Field: dt/dd minimal ──────────────────────────────────────

interface FieldProps {
  label: string;
  value: React.ReactNode;
  href?: string;
  mono?: boolean;
  copyable?: boolean;
}

async function copyValue(value: string, label: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} copiado`);
  } catch {
    toast.error("Não foi possível copiar");
  }
}

export function MinimalField({
  label,
  value,
  href,
  mono,
  copyable,
}: FieldProps) {
  const hasValue =
    value !== null && value !== undefined && value !== "" && value !== "—";
  return (
    <div className="py-1">
      <dt className="text-[9px] font-medium uppercase tracking-widest text-muted-foreground/80">
        {label}
      </dt>
      <dd
        className={cn(
          "mt-0.5 flex items-center gap-1.5",
          mono && "font-mono text-[11px]",
          hasValue ? "text-foreground" : "text-muted-foreground/60",
        )}
      >
        {!hasValue ? (
          <span className="text-xs">—</span>
        ) : href ? (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="group inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            {value}
            <ExternalLink className="h-3 w-3 opacity-60 group-hover:opacity-100" />
          </a>
        ) : (
          <span className={cn("text-xs", mono && "break-all")}>{value}</span>
        )}
        {hasValue && copyable && typeof value === "string" && (
          <button
            onClick={() => copyValue(value, label)}
            className="ml-auto rounded p-0.5 text-muted-foreground/60 transition-colors hover:bg-secondary hover:text-foreground"
            title={`Copiar ${label.toLowerCase()}`}
          >
            <Copy className="h-3 w-3" />
          </button>
        )}
      </dd>
    </div>
  );
}

// ─── StatPill: compact KPI ──────────────────────────────────────

export type StatTone = "default" | "green" | "orange" | "red" | "blue" | "purple";

const TONE_TEXT: Record<StatTone, string> = {
  default: "text-foreground",
  green: "text-sys-green",
  orange: "text-sys-orange",
  red: "text-sys-red",
  blue: "text-sys-blue",
  purple: "text-sys-purple",
};

export function MinimalStat({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: string | number;
  tone?: StatTone;
  hint?: string;
}) {
  return (
    <div className="rounded-md bg-secondary/40 px-2.5 py-1.5">
      <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-0.5 text-sm font-semibold tabular-nums leading-tight",
          TONE_TEXT[tone ?? "default"],
        )}
      >
        {value}
      </p>
      {hint && (
        <p className="text-[9px] text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

// ─── PageHeader: title + description + action slot ─────────────

export function MinimalHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-base font-semibold leading-tight text-foreground">
          {title}
        </h1>
        {description && (
          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}

// ─── PageHero: identidade BAU ───────────────────────────────────
// Hero pra tela inteira com acento de cor da marca BAU.
// Usar em landings de seção (War Room, Pipeline, Leads, etc.) onde
// queremos identidade visual mais marcante do que MinimalHeader.

export function PageHero({
  eyebrow,
  title,
  description,
  action,
  accent = "blue",
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  accent?: "blue" | "burgundy" | "gold";
}) {
  const accentBar: Record<string, string> = {
    blue: "bg-bau-blue",
    burgundy: "bg-bau-burgundy",
    gold: "bg-bau-gold",
  };
  const accentText: Record<string, string> = {
    blue: "text-bau-blue",
    burgundy: "text-bau-burgundy",
    gold: "text-bau-gold",
  };
  return (
    <header className="flex items-start justify-between gap-4 border-b border-border pb-3">
      <div className="flex items-stretch gap-3 min-w-0">
        <span
          aria-hidden
          className={cn("w-0.5 shrink-0 rounded-full", accentBar[accent])}
        />
        <div className="min-w-0">
          {eyebrow && (
            <p
              className={cn(
                "mb-0.5 text-[10px] font-semibold uppercase tracking-[0.18em]",
                accentText[accent],
              )}
            >
              {eyebrow}
            </p>
          )}
          <h1 className="text-[17px] font-semibold leading-tight tracking-tight text-foreground">
            {title}
          </h1>
          {description && (
            <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
              {description}
            </p>
          )}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}
