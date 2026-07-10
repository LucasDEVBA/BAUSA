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

// Slug custom: 3-40 chars, minúsculas/dígitos/hífen, começa e termina em
// alfanumérico (sem hífen nas pontas). Compatível com o regex da rota pública
// /l/[slug] (apps/web, aceita [A-Za-z0-9_-]{3,40}). Normalizado p/ minúsculas
// antes de validar.
const SLUG_CUSTOM_RE = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;
const TITULO_MAX = 300;
const LISTAR_LIMIT = 200;

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
  // Slug custom opcional — vazio/ausente → gerado automaticamente. Normaliza
  // p/ minúsculas e valida o formato (compatível com a rota pública).
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .refine((s) => SLUG_CUSTOM_RE.test(s), "Use 3-40 letras, números ou hífen (sem hífen nas pontas).")
    .optional(),
  titulo: z.string().max(TITULO_MAX).optional(),
  utm_source: z.string().max(TITULO_MAX).optional(),
  utm_medium: z.string().max(TITULO_MAX).optional(),
  utm_campaign: z.string().max(TITULO_MAX).optional(),
  utm_content: z.string().max(TITULO_MAX).optional(),
  utm_term: z.string().max(TITULO_MAX).optional(),
});

export type CriarLinkInput = z.input<typeof criarSchema>;

export type CriarLinkResult =
  | { success: true; slug: string }
  | { success: false; error: string };

export interface LinkCurtoResumo {
  id: string;
  slug: string;
  titulo: string | null;
  destino: string;
}

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

  const inserir = (slug: string) =>
    supabase.from("links_curtos").insert({
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

  // Slug custom: uma tentativa; colisão UNIQUE vira erro claro (não regera).
  if (dados.slug) {
    const { error } = await inserir(dados.slug);
    if (!error) {
      revalidatePath("/analytics/utm-builder");
      return { success: true, slug: dados.slug };
    }
    if (error.code === PG_UNIQUE_VIOLATION) {
      return { success: false, error: `O código "/l/${dados.slug}" já está em uso. Escolha outro.` };
    }
    return { success: false, error: `Erro ao criar link: ${error.message}` };
  }

  // Slug automático: retenta em colisão (UNIQUE) — probabilidade ínfima.
  for (let tentativa = 0; tentativa < MAX_TENTATIVAS; tentativa += 1) {
    const slug = gerarSlug();
    const { error } = await inserir(slug);

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

/** Lista os links curtos (CEO) — usado pelo select do compositor de mensagem. */
export async function listarLinksCurtos(): Promise<LinkCurtoResumo[]> {
  if ((await getUserPapel()) !== "ceo") return [];
  const supabase = await createAuditedSupabaseClient();
  const { data, error } = await supabase
    .from("links_curtos")
    .select("id, slug, titulo, destino")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(LISTAR_LIMIT);
  if (error || !data) return [];
  return data as LinkCurtoResumo[];
}
