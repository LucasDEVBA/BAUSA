import { redirect } from "next/navigation";
import { CheckCircle2, ShieldAlert, ShieldCheck } from "lucide-react";

import { AuthShell } from "@/components/auth/AuthShell";
import { BotoesConsentimento } from "@/components/auth/BotoesConsentimento";
import { buttonVariants } from "@/components/ui/Button";
import { decidirAutorizacaoOAuth } from "@/lib/actions/oauth-consentimento";
import { getUserProfile } from "@/lib/auth";
import { redirectPermitidoParaConsentimento } from "@/lib/mcp/redirect-consentimento";
import { isCeoLevel } from "@/lib/papel";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const AUTORIZACAO_ID_RE = /^[A-Za-z0-9_-]{8,128}$/;

const MENSAGEM_ERRO: Record<string, string> = {
  expirado: "Este pedido de conexão expirou. Volte ao Claude e conecte de novo.",
  papel: "Só CEO/CTO com conta ativa podem conectar o Claude ao Engine.",
  destino: "Este pedido não veio do Claude. Por segurança, só o Claude pode ser conectado.",
  falha: "Não foi possível concluir a conexão. Volte ao Claude e tente de novo.",
};

const PODERA = [
  "Buscar leads e abrir o dossiê de cada um",
  "Ver o resumo do pipeline e a taxa de conversão",
  "Ver o funil por período e a fila de aprovação",
];

function Aviso({ texto }: { texto: string }) {
  return (
    <div role="alert" className="mt-4 rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2.5">
      <p className="text-xs text-destructive">{texto}</p>
    </div>
  );
}

function Cartao({ children }: { children: React.ReactNode }) {
  return (
    <AuthShell>
      <section className="rounded-2xl border border-border/70 bg-card/60 p-8">{children}</section>
    </AuthShell>
  );
}

function Mensagem({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <Cartao>
      <h1 className="text-title-2 text-foreground">{titulo}</h1>
      <p className="mt-2 text-subhead text-muted-foreground">{texto}</p>
    </Cartao>
  );
}

const hostDe = (uri: string): string => {
  try {
    return new URL(uri).host;
  } catch {
    return uri;
  }
};

async function carregarPedido(id: string) {
  try {
    const supabase = await createServerSupabaseClient();
    return await supabase.auth.oauth.getAuthorizationDetails(id);
  } catch (e) {
    console.error({ level: "error", action: "oauth_consent_page", message: e instanceof Error ? e.message : String(e) });
    return null;
  }
}

/**
 * Consentimento do conector do Claude (servidor OAuth 2.1 do Supabase Auth
 * redireciona para cá com `authorization_id`). Aprovar só aparece para
 * CEO/CTO ativo e só para destino oficial do Claude — a action refaz as
 * checagens. Nunca redireciona sozinho: até a conexão já autorizada pede um
 * clique (um link de autorização aberto por engano não completa nada).
 */
export default async function OAuthConsentPage({
  searchParams,
}: {
  searchParams: Promise<{ authorization_id?: string; erro?: string }>;
}) {
  const { authorization_id: id, erro } = await searchParams;
  if (!id || !AUTORIZACAO_ID_RE.test(id)) {
    return <Mensagem titulo="Link de conexão inválido" texto="Volte ao Claude e inicie a conexão de novo." />;
  }

  const perfil = await getUserProfile().catch(() => null);
  if (!perfil) redirect(`/login?next=${encodeURIComponent(`/oauth/consent?authorization_id=${id}`)}`);
  const nivelCeo = perfil.ativo !== false && isCeoLevel(perfil.papel);

  const detalhes = await carregarPedido(id);
  if (!detalhes || detalhes.error || !detalhes.data) {
    return <Mensagem titulo="Pedido de conexão expirado" texto={MENSAGEM_ERRO.expirado} />;
  }

  // Já autorizado antes: o Supabase devolve o redirect com o código. Mostra a
  // conta e pede um clique em vez de mandar direto.
  if (!("authorization_id" in detalhes.data)) {
    const destino = detalhes.data.redirect_url;
    const ok = nivelCeo && redirectPermitidoParaConsentimento(destino, { comParametros: true });
    return (
      <Cartao>
        <h1 className="text-title-2 text-foreground">Conexão já autorizada</h1>
        <p className="mt-2 text-subhead text-muted-foreground">
          Você ({perfil.email}) já permitiu este acesso antes. Continue só se foi você quem iniciou a conexão agora no
          Claude.
        </p>
        {ok ? (
          <a href={destino} className={cn(buttonVariants({ variant: "brand", size: "lg" }), "mt-6 w-full")}>
            Continuar para {hostDe(destino)}
          </a>
        ) : (
          <Aviso texto={nivelCeo ? MENSAGEM_ERRO.destino : MENSAGEM_ERRO.papel} />
        )}
      </Cartao>
    );
  }

  const pedido = detalhes.data;
  const destinoOficial = redirectPermitidoParaConsentimento(pedido.redirect_uri);
  const podeAprovar = nivelCeo && destinoOficial;

  return (
    <Cartao>
      <div className="flex items-center gap-2">
        {podeAprovar ? (
          <ShieldCheck aria-hidden className="size-5 text-primary" />
        ) : (
          <ShieldAlert aria-hidden className="size-5 text-destructive" />
        )}
        <h1 className="text-title-2 text-foreground">Conectar ao BAUSA Engine</h1>
      </div>
      <p className="mt-2 text-subhead text-muted-foreground">
        <strong className="text-foreground">{pedido.client?.name || "Um aplicativo"}</strong> quer acessar o Engine com a
        sua conta ({pedido.user?.email}).
      </p>

      <div className="mt-5 rounded-lg border border-border/70 bg-background px-4 py-3">
        <p className="text-xs font-medium text-muted-foreground">Com esta conexão o Claude poderá, só para leitura:</p>
        <ul className="mt-2 space-y-1.5">
          {PODERA.map((item) => (
            <li key={item} className="flex items-start gap-2 text-sm text-foreground">
              <CheckCircle2 aria-hidden className="mt-0.5 size-4 shrink-0 text-sys-green" />
              {item}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">
          Ele não aprova leads, não move deals e não envia mensagens. Destino: {hostDe(pedido.redirect_uri)}. Os atletas
          são menores de idade: use os dados só na operação interna.
        </p>
      </div>

      {erro && MENSAGEM_ERRO[erro] && <Aviso texto={MENSAGEM_ERRO[erro]} />}
      {!nivelCeo && <Aviso texto={MENSAGEM_ERRO.papel} />}
      {nivelCeo && !destinoOficial && <Aviso texto={MENSAGEM_ERRO.destino} />}

      <form action={decidirAutorizacaoOAuth} className="mt-6 flex flex-col gap-2 sm:flex-row-reverse">
        <input type="hidden" name="authorization_id" value={id} />
        <BotoesConsentimento podeAprovar={podeAprovar} />
      </form>
    </Cartao>
  );
}
