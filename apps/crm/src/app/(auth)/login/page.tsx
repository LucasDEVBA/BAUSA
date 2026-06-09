"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Zap, Loader2 } from "lucide-react";

import { createBrowserClient } from "@/lib/supabase-browser";

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
    <div className="flex min-h-screen items-center justify-center bg-background">
      {/* Background grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(#6366f1 1px, transparent 1px), linear-gradient(90deg, #6366f1 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      {/* Glow */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-96 w-96 rounded-full bg-indigo-500/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm px-4">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/20">
            <Zap className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-xl font-bold text-foreground">BAUSA Engine</h1>
          <p className="mt-1 text-sm text-muted-foreground">Bolsa Atleta USA</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-border bg-card p-8 shadow-2xl">
          <h2 className="text-lg font-semibold text-foreground">Acessar painel</h2>
          <p className="mt-1 text-sm text-muted-foreground">
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
                className="w-full rounded-md border border-border bg-popover px-3 py-2.5 text-sm text-foreground placeholder:text-placeholder outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary/30"
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
                className="w-full rounded-md border border-border bg-popover px-3 py-2.5 text-sm text-foreground placeholder:text-placeholder outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary/30"
              />
            </div>

            {/* Error message */}
            {error && (
              <div className="rounded-md border border-sys-red/20 bg-sys-red/10 px-3 py-2.5">
                <p className="text-xs text-sys-red">{error}</p>
              </div>
            )}

            {/* Button */}
            <button
              type="submit"
              disabled={loading}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition-all hover:from-indigo-500 hover:to-purple-500 hover:shadow-indigo-500/30 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed"
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
        <p className="mt-6 text-center text-xs text-label-tertiary">
          Acesso restrito à equipe Bolsa Atleta USA
        </p>
      </div>
    </div>
  );
}
