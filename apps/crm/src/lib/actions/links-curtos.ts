"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createAuditedSupabaseClient } from "@/lib/supabase-audit";
import { getUserPapel, getSession } from "@/lib/auth";

// ════════════════════════════════════════════════════════════════════════
// Server actions — encurtador de links UTM (apenas CEO).
// Cria um link curto bolsaatletausa.com/l/<slug> que redireciona para o destino
// completo (com UTMs), escondendo os parâmetros do link compartilhado.
// ════════════════════════════════════════════════════════════════════════

// Alfabeto sem caracteres ambíguos (0/o, 1/l/i) — slug fácil de ler/digitar.
const SLUG_ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";
const SLUG_LEN = 7;
const MAX_TENTATIVAS = 6;
const PG_UNIQUE_VIOLATION = "23505";

// Allowlist de domínio: o link curto de MARCA só pode apontar para o site
// próprio — impede que bolsaatletausa.com/l/<slug> vire um redirecionador
// aberto (open redirect / risco de phishing). O route público reforça isso.
const HOSTS_PERMITIDOS = new Set(["bolsaatletausa.com", "www.bolsaatletausa.com"]);

function hostPermitido(url: string): boolean {
  try {
    return HOSTS_PERMITIDOS.has(new URL(url).hostname.toLowerCase());
  } catch {
    return false;
  }
}

function gerarSlug(): string {
  let s = "";
  for (let i = 0; i < SLUG_LEN; i += 1) {
    s += SLUG_ALPHABET[Math.floor(Math.random() * SLUG_ALPHABET.length)];
  }
  return s;
}

const criarSchema = z.object({
  destino: z
    .string()
    .url("URL inválida")
    .max(2000)
    .refine((u) => /^https?:\/\//i.test(u), "A URL deve começar com http(s)")
    .refine(hostPermitido, "O destino deve ser um link do bolsaatletausa.com"),
  titulo: z.string().max(120).optional(),
  utm_source: z.string().max(120).optional(),
  utm_medium: z.string().max(120).optional(),
  utm_campaign: z.string().max(120).optional(),
  utm_content: z.string().max(120).optional(),
  utm_term: z.string().max(120).optional(),
});

export type CriarLinkInput = z.input<typeof criarSchema>;

export type CriarLinkResult =
  | { success: true; slug: string }
  | { success: false; error: string };

export async function criarLinkCurto(
  input: CriarLinkInput,
): Promise<CriarLinkResult> {
  const papel = await getUserPapel();
  if (papel !== "ceo") {
    return { success: false, error: "Apenas o CEO pode criar links curtos." };
  }

  const parsed = criarSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Dados inválidos.",
    };
  }

  const dados = parsed.data;
  const supabase = await createAuditedSupabaseClient();
  const user = await getSession();

  // Retenta em colisão de slug (UNIQUE) — probabilidade ínfima, mas seguro.
  for (let tentativa = 0; tentativa < MAX_TENTATIVAS; tentativa += 1) {
    const slug = gerarSlug();
    const { error } = await supabase.from("links_curtos").insert({
      slug,
      destino: dados.destino,
      titulo: dados.titulo ?? null,
      utm_source: dados.utm_source ?? null,
      utm_medium: dados.utm_medium ?? null,
      utm_campaign: dados.utm_campaign ?? null,
      utm_content: dados.utm_content ?? null,
      utm_term: dados.utm_term ?? null,
      created_by: user?.id ?? null,
    });

    if (!error) {
      revalidatePath("/analytics/utm-builder");
      return { success: true, slug };
    }
    if (error.code !== PG_UNIQUE_VIOLATION) {
      return { success: false, error: `Erro ao criar link: ${error.message}` };
    }
  }

  return {
    success: false,
    error: "Não foi possível gerar um código único. Tente novamente.",
  };
}
