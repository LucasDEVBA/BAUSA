"use client";

import { ArrowRight, Sparkles } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { trackCtaClick } from "@/lib/tracking/events";

interface MuralCtaCardProps {
  title: string;
  action: string;
}

/**
 * Último tile do mural: fecha a grade (11 atletas + 1 = 12, par em 2, 3 e 4 colunas) e
 * transforma a prova social em próximo passo. O cartão inteiro é o link, então o rótulo
 * nunca precisa caber num botão estreito de duas colunas.
 */
export default function MuralCtaCard({ title, action }: MuralCtaCardProps) {
  return (
    <Link
      href="/forms"
      onClick={() => trackCtaClick("historias")}
      className="group relative isolate flex h-full min-h-[300px] flex-col justify-between overflow-hidden rounded-[24px] bg-[linear-gradient(160deg,#2b4fbd_0%,var(--ba-blue)_42%,var(--ba-navy-2)_100%)] p-4 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_24px_50px_-22px_rgba(31,63,163,0.75)] transition-[transform,box-shadow] duration-500 [transition-timing-function:var(--ba-ease)] hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[var(--ba-blue-2)] sm:rounded-[28px] sm:p-6"
    >
      <span aria-hidden="true" className="ba-glow right-[-60px] top-[-60px] -z-[1] h-[200px] w-[200px] bg-[rgba(184,54,74,0.55)]" />
      <span aria-hidden="true" className="ba-glow bottom-[-80px] left-[-40px] -z-[1] h-[180px] w-[180px] bg-[rgba(169,192,242,0.4)]" />
      <span className="flex items-start justify-between gap-3">
        <span aria-hidden="true" className="grid h-10 w-10 place-items-center rounded-[13px] bg-white/[0.14] shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]">
          <Sparkles className="h-5 w-5" />
        </span>
        <span
          aria-hidden="true"
          className="grid h-11 w-11 place-items-center rounded-full bg-[linear-gradient(180deg,#fff,#e9eefb)] text-[var(--ba-navy)] shadow-[0_10px_24px_-10px_rgba(0,0,0,0.6)] transition-transform duration-500 [transition-timing-function:var(--ba-ease)] group-hover:translate-x-0.5"
        >
          <ArrowRight className="h-5 w-5" />
        </span>
      </span>
      <span>
        <span className="block text-balance font-[family-name:var(--ba-display)] text-[18px] font-semibold leading-[1.18] tracking-[-0.025em] sm:text-[22px]">{title}</span>
        <span className="mt-4 block text-[13px] font-semibold text-[#cfdcff] underline decoration-white/30 underline-offset-4 sm:text-[14px]">{action}</span>
      </span>
    </Link>
  );
}
