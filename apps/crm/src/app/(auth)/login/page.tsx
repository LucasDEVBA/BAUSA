"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Loader2, Star } from "lucide-react";

import { createBrowserClient } from "@/lib/supabase-browser";

const BAU_GRADIENT = "linear-gradient(150deg, var(--bau-burgundy) 0%, var(--bau-blue) 100%)";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const supabase = createBrowserClient();
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        if (authError.message === "Invalid login credentials") {
          setError("E-mail ou senha incorretos.");
        } else {
          setError(authError.message);
        }
        return;
      }

      router.push("/war-room");
      router.refresh();
    } catch {
      setError("Erro inesperado. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

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

      {/* ============ Painel de autenticação ============ */}
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

          {/* Card de login */}
          <div className="border border-border/70 bg-card/60 rounded-2xl p-8">
            <h1 className="text-title-2 text-foreground">Acessar painel</h1>
            <p className="mt-1 text-subhead text-muted-foreground">
              Entre com suas credenciais de acesso.
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              {/* Email */}
              <div>
                <label
                  htmlFor="email"
                  className="mb-1.5 block text-xs font-medium text-muted-foreground"
                >
                  E-mail
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@bolsaatletausa.com"
                  required
                  autoComplete="email"
                  className="w-full rounded-md border border-input bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-placeholder outline-none transition-colors focus:border-bau-blue focus:ring-2 focus:ring-bau-blue/30"
                />
              </div>

              {/* Senha */}
              <div>
                <label
                  htmlFor="password"
                  className="mb-1.5 block text-xs font-medium text-muted-foreground"
                >
                  Senha
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  className="w-full rounded-md border border-input bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-placeholder outline-none transition-colors focus:border-bau-blue focus:ring-2 focus:ring-bau-blue/30"
                />
              </div>

              {/* Error message */}
              {error && (
                <div className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2.5">
                  <p className="text-xs text-destructive">{error}</p>
                </div>
              )}

              {/* Button */}
              <button
                type="submit"
                disabled={loading}
                style={{ backgroundImage: BAU_GRADIENT }}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-md py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:opacity-95 hover:shadow-lg active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Entrando...
                  </>
                ) : (
                  "Entrar"
                )}
              </button>
            </form>
          </div>

          {/* Footer */}
          <p className="mt-6 text-center text-footnote text-label-tertiary">
            Acesso restrito à equipe Bolsa Atleta USA
          </p>
        </div>
      </main>
    </div>
  );
}
