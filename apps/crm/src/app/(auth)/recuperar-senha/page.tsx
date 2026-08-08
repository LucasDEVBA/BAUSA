"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, MailCheck } from "lucide-react";

import { createBrowserClient } from "@/lib/supabase-browser";
import { AuthShell } from "@/components/auth/AuthShell";

const BAU_GRADIENT = "linear-gradient(150deg, var(--bau-burgundy) 0%, var(--bau-blue) 100%)";

/** Traduz erros conhecidos do Supabase para mensagens amigáveis. */
function traduzirErro(message: string): string {
  if (/only request this after|rate limit/i.test(message)) {
    return "Por segurança, aguarde alguns instantes antes de solicitar um novo link.";
  }
  if (/error sending recovery email/i.test(message)) {
    return "Não foi possível enviar o e-mail agora. Tente novamente em instantes.";
  }
  return message;
}

export default function RecuperarSenhaPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  // Links inválidos chegam aqui de duas formas: fragment #error=... (redirect
  // direto do Supabase, invisível ao servidor) ou ?erro=... (nosso /auth/confirm).
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const query = new URLSearchParams(window.location.search);

    if (hash.get("error_code") === "otp_expired") {
      setAviso("O link de redefinição expirou ou já foi usado. Solicite um novo abaixo.");
    } else if (hash.get("error") || query.get("erro") === "link-invalido") {
      setAviso("Não foi possível validar o link de redefinição. Solicite um novo abaixo.");
    } else {
      return;
    }
    // Limpa a URL para o aviso não reaparecer em refresh/navegação
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const supabase = createBrowserClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/confirm`,
      });

      if (resetError) {
        setError(traduzirErro(resetError.message));
        return;
      }

      setSent(true);
    } catch {
      setError("Erro inesperado. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <div className="border border-border/70 bg-card/60 rounded-2xl p-8">
        {sent ? (
          /* Estado de sucesso — mensagem genérica (não revela se o e-mail existe) */
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-sys-green/10">
              <MailCheck className="h-6 w-6 text-sys-green" aria-hidden />
            </div>
            <h1 className="text-title-2 text-foreground">Verifique seu e-mail</h1>
            <p className="mt-2 text-subhead text-muted-foreground">
              Se <span className="font-medium text-foreground">{email}</span> tiver
              acesso ao Engine, você receberá um link para redefinir a senha.
              O link é de uso único e expira — abra-o assim que chegar.
            </p>
            <Link
              href="/login"
              className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Voltar ao login
            </Link>
          </div>
        ) : (
          <>
            <h1 className="text-title-2 text-foreground">Recuperar senha</h1>
            <p className="mt-1 text-subhead text-muted-foreground">
              Informe seu e-mail de acesso e enviaremos um link para redefinir a senha.
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              {/* Aviso de link expirado/inválido */}
              {aviso && (
                <div className="rounded-md border border-sys-orange/25 bg-sys-orange/10 px-3 py-2.5">
                  <p className="text-xs text-foreground">{aviso}</p>
                </div>
              )}

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
                  placeholder="seu-email@bolsaatletausa.com"
                  required
                  autoComplete="email"
                  className="w-full rounded-md border border-input bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-placeholder outline-none transition-colors focus:border-bau-blue focus:ring-2 focus:ring-bau-blue/30"
                />
              </div>

              {error && (
                <div className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2.5">
                  <p className="text-xs text-destructive">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                style={{ backgroundImage: BAU_GRADIENT }}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-md py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:opacity-95 hover:shadow-lg active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  "Enviar link de redefinição"
                )}
              </button>

              <Link
                href="/login"
                className="mx-auto flex w-fit items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
                Voltar ao login
              </Link>
            </form>
          </>
        )}
      </div>
    </AuthShell>
  );
}
