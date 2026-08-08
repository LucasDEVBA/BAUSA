import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { EmailOtpType } from "@supabase/supabase-js";

const DESTINO_PADRAO = "/redefinir-senha";

/** Evita open redirect: só aceita caminhos internos absolutos ("/x", nunca "//x"). */
function destinoSeguro(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return DESTINO_PADRAO;
  return raw;
}

/**
 * Destino dos links de e-mail do Supabase Auth (recuperação de senha).
 * Suporta os dois formatos de link:
 *  - `?token_hash=...&type=recovery` → verifyOtp (template customizado; funciona
 *    em qualquer dispositivo, inclusive e-mails disparados pelo dashboard)
 *  - `?code=...` → exchangeCodeForSession (template padrão, fluxo PKCE; exige o
 *    mesmo navegador que solicitou o link)
 * Em sucesso, grava os cookies de sessão e redireciona para /redefinir-senha.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const next = destinoSeguro(searchParams.get("next"));

  const falha = NextResponse.redirect(
    new URL("/recuperar-senha?erro=link-invalido", origin),
  );

  // A resposta de sucesso precisa existir antes: o Supabase grava os cookies
  // de sessão nela durante a verificação (callback setAll).
  const sucesso = NextResponse.redirect(new URL(next, origin));

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            sucesso.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  try {
    if (tokenHash && type) {
      const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
      return error ? falha : sucesso;
    }

    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      return error ? falha : sucesso;
    }
  } catch (err) {
    console.error({
      level: "error",
      action: "auth_confirm",
      message: err instanceof Error ? err.message : "erro desconhecido",
    });
  }

  return falha;
}
