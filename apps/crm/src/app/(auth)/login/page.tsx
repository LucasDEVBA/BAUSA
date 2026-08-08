"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";

import { createBrowserClient } from "@/lib/supabase-browser";
import { AuthShell } from "@/components/auth/AuthShell";

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
    <AuthShell>
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
            <div className="mb-1.5 flex items-center justify-between">
              <label
                htmlFor="password"
                className="block text-xs font-medium text-muted-foreground"
              >
                Senha
              </label>
              <Link
                href="/recuperar-senha"
                className="text-xs font-medium text-primary transition-colors hover:underline"
              >
                Esqueci minha senha
              </Link>
            </div>
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
    </AuthShell>
  );
}
