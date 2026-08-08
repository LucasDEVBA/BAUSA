"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Loader2, Lock, ShieldAlert } from "lucide-react";

import { createBrowserClient } from "@/lib/supabase-browser";
import { AuthShell } from "@/components/auth/AuthShell";

const BAU_GRADIENT = "linear-gradient(150deg, var(--bau-burgundy) 0%, var(--bau-blue) 100%)";
const SENHA_MIN = 8;

type Status = "verificando" | "sem-sessao" | "pronto" | "concluido";

/** Traduz erros conhecidos do Supabase para mensagens amigáveis. */
function traduzirErro(message: string): string {
  if (/different from the old password/i.test(message)) {
    return "A nova senha deve ser diferente da senha atual.";
  }
  if (/session missing|not authenticated/i.test(message)) {
    return "Sessão expirada. Solicite um novo link de redefinição.";
  }
  return message;
}

export default function RedefinirSenhaPage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("verificando");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Só há o que redefinir se o link de recuperação criou uma sessão válida.
  useEffect(() => {
    let ativo = true;
    const supabase = createBrowserClient();
    supabase.auth
      .getUser()
      .then(({ data: { user } }) => {
        if (ativo) setStatus(user ? "pronto" : "sem-sessao");
      })
      .catch(() => {
        if (ativo) setStatus("sem-sessao");
      });
    return () => {
      ativo = false;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (novaSenha.length < SENHA_MIN) {
      setError(`A senha deve ter ao menos ${SENHA_MIN} caracteres.`);
      return;
    }
    if (novaSenha !== confirmar) {
      setError("As senhas não conferem.");
      return;
    }

    setLoading(true);
    try {
      const supabase = createBrowserClient();
      const { error: updateError } = await supabase.auth.updateUser({
        password: novaSenha,
      });

      if (updateError) {
        setError(traduzirErro(updateError.message));
        return;
      }

      setStatus("concluido");
    } catch {
      setError("Erro inesperado. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <div className="border border-border/70 bg-card/60 rounded-2xl p-8">
        {status === "verificando" && (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Validando link...
          </div>
        )}

        {status === "sem-sessao" && (
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-sys-orange/10">
              <ShieldAlert className="h-6 w-6 text-sys-orange" aria-hidden />
            </div>
            <h1 className="text-title-2 text-foreground">Link inválido ou expirado</h1>
            <p className="mt-2 text-subhead text-muted-foreground">
              O link de redefinição é de uso único e expira após um período.
              Solicite um novo para continuar.
            </p>
            <Link
              href="/recuperar-senha"
              className="mt-6 inline-flex items-center justify-center rounded-md px-4 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:opacity-95"
              style={{ backgroundImage: BAU_GRADIENT }}
            >
              Solicitar novo link
            </Link>
          </div>
        )}

        {status === "pronto" && (
          <>
            <h1 className="text-title-2 text-foreground">Definir nova senha</h1>
            <p className="mt-1 text-subhead text-muted-foreground">
              Escolha uma nova senha para sua conta.
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label
                  htmlFor="nova-senha"
                  className="mb-1.5 block text-xs font-medium text-muted-foreground"
                >
                  Nova senha
                </label>
                <input
                  id="nova-senha"
                  type="password"
                  value={novaSenha}
                  onChange={(e) => setNovaSenha(e.target.value)}
                  placeholder={`Mínimo ${SENHA_MIN} caracteres`}
                  required
                  minLength={SENHA_MIN}
                  autoComplete="new-password"
                  className="w-full rounded-md border border-input bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-placeholder outline-none transition-colors focus:border-bau-blue focus:ring-2 focus:ring-bau-blue/30"
                />
              </div>

              <div>
                <label
                  htmlFor="confirmar-senha"
                  className="mb-1.5 block text-xs font-medium text-muted-foreground"
                >
                  Confirmar nova senha
                </label>
                <input
                  id="confirmar-senha"
                  type="password"
                  value={confirmar}
                  onChange={(e) => setConfirmar(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={SENHA_MIN}
                  autoComplete="new-password"
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
                disabled={loading || !novaSenha || !confirmar}
                style={{ backgroundImage: BAU_GRADIENT }}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-md py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:opacity-95 hover:shadow-lg active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4" aria-hidden />
                    Redefinir senha
                  </>
                )}
              </button>
            </form>
          </>
        )}

        {status === "concluido" && (
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-sys-green/10">
              <CheckCircle2 className="h-6 w-6 text-sys-green" aria-hidden />
            </div>
            <h1 className="text-title-2 text-foreground">Senha redefinida</h1>
            <p className="mt-2 text-subhead text-muted-foreground">
              Sua senha foi alterada com sucesso. Você já está autenticado.
            </p>
            <button
              type="button"
              onClick={() => {
                router.push("/");
                router.refresh();
              }}
              className="mt-6 inline-flex items-center justify-center rounded-md px-4 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:opacity-95"
              style={{ backgroundImage: BAU_GRADIENT }}
            >
              Ir para o painel
            </button>
          </div>
        )}
      </div>
    </AuthShell>
  );
}
