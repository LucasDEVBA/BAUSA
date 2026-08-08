import Image from "next/image";
import { Star } from "lucide-react";

const BAU_GRADIENT = "linear-gradient(150deg, var(--bau-burgundy) 0%, var(--bau-blue) 100%)";

/**
 * Casca compartilhada das telas de autenticação (login, recuperar/redefinir senha):
 * painel de marca à esquerda (desktop) + painel de conteúdo à direita.
 */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen w-full">
      {/* ============ Painel de marca (desktop) ============ */}
      <aside
        className="relative hidden w-1/2 flex-col justify-between overflow-hidden p-12 lg:flex"
        style={{ backgroundImage: BAU_GRADIENT }}
      >
        {/* Brasão watermark */}
        <Image
          src="/brand/bausa-logo-white.png"
          alt=""
          aria-hidden
          width={757}
          height={506}
          className="pointer-events-none absolute -right-20 bottom-[-4rem] h-auto w-[680px] select-none opacity-[0.06]"
        />

        {/* Topo: estrelas + logo */}
        <div className="relative">
          <div className="mb-7 flex items-end gap-2" aria-hidden>
            <Star className="h-5 w-5 fill-white/80 text-white/80" />
            <Star className="h-7 w-7 fill-white text-white" />
            <Star className="h-5 w-5 fill-white/80 text-white/80" />
          </div>
          <Image
            src="/brand/bausa-logo-white.png"
            alt="BAUSA — Bolsa Atleta USA"
            width={757}
            height={506}
            priority
            className="h-auto w-[280px]"
          />
        </div>

        {/* Base: tagline + selo */}
        <div className="relative max-w-md">
          <p className="text-title-1 leading-tight text-white">
            Plataforma de operações
          </p>
          <p className="mt-3 text-callout text-white/70">
            Pipeline comercial, famílias e inteligência de matching — atleta × escola,
            em um só lugar.
          </p>
          <div className="mt-10 flex items-center gap-2 text-caption-1 font-semibold uppercase tracking-widest text-white/55">
            <span className="h-px w-8 bg-white/40" />
            ESTD 2024
          </div>
        </div>
      </aside>

      {/* ============ Painel de conteúdo ============ */}
      <main className="relative flex flex-1 items-center justify-center px-6 py-10">
        <div className="w-full max-w-sm">
          {/* Marca compacta (mobile) */}
          <div
            className="mx-auto mb-8 flex w-fit items-center justify-center rounded-2xl px-6 py-4 shadow-lg lg:hidden"
            style={{ backgroundImage: BAU_GRADIENT }}
          >
            <Image
              src="/brand/bausa-logo-white.png"
              alt="BAUSA — Bolsa Atleta USA"
              width={757}
              height={506}
              priority
              className="h-auto w-[180px]"
            />
          </div>

          {children}

          {/* Footer */}
          <p className="mt-6 text-center text-footnote text-label-tertiary">
            Acesso restrito à equipe Bolsa Atleta USA
          </p>
        </div>
      </main>
    </div>
  );
}
