"use server";

import { revalidatePath } from "next/cache";

import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createAdminClient, hasServiceKey } from "@/lib/supabase-admin";
import { getUserProfile } from "@/lib/auth";
import type { PapelUsuario, UserProfile } from "@/types/crm";

type Result<T = undefined> =
  | { success: true; data?: T }
  | { success: false; error: string };

const PAPEIS_VALIDOS: PapelUsuario[] = ["ceo", "head_sucesso", "comercial"];

/** Lista todos os usuários (apenas CEO). */
export async function listarUsuarios(): Promise<Result<UserProfile[]>> {
  const me = await getUserProfile();
  if (me?.papel !== "ceo") return { success: false, error: "Acesso restrito ao CEO." };

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("user_profiles")
    .select("*")
    .order("nome", { ascending: true });

  if (error) return { success: false, error: error.message };
  return { success: true, data: (data ?? []) as UserProfile[] };
}

/** CEO edita papel/ativo/nome/foto de qualquer usuário (RLS já garante). */
export async function atualizarUsuario(
  id: string,
  patch: { papel?: PapelUsuario; ativo?: boolean; nome?: string; avatar_url?: string | null },
): Promise<Result> {
  const me = await getUserProfile();
  if (me?.papel !== "ceo") return { success: false, error: "Acesso restrito ao CEO." };

  if (patch.papel && !PAPEIS_VALIDOS.includes(patch.papel)) {
    return { success: false, error: "Papel inválido." };
  }
  // Trava de segurança: o CEO não pode rebaixar/desativar a si mesmo (evita lockout).
  if (id === me.id && (patch.papel && patch.papel !== "ceo")) {
    return { success: false, error: "Você não pode alterar o próprio papel de CEO." };
  }
  if (id === me.id && patch.ativo === false) {
    return { success: false, error: "Você não pode desativar a própria conta." };
  }

  const update: Record<string, unknown> = {};
  if (patch.papel !== undefined) update.papel = patch.papel;
  if (patch.ativo !== undefined) update.ativo = patch.ativo;
  if (patch.nome !== undefined) update.nome = patch.nome.trim();
  if (patch.avatar_url !== undefined) update.avatar_url = patch.avatar_url;
  if (Object.keys(update).length === 0) return { success: true };

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("user_profiles").update(update).eq("id", id);
  if (error) return { success: false, error: error.message };

  revalidatePath("/configuracoes");
  revalidatePath("/", "layout");
  return { success: true };
}

/** Usuário edita o próprio perfil (nome/foto). RLS permite self-update. */
export async function atualizarMeuPerfil(
  patch: { nome?: string; avatar_url?: string | null },
): Promise<Result> {
  const me = await getUserProfile();
  if (!me) return { success: false, error: "Não autenticado." };

  const update: Record<string, unknown> = {};
  if (patch.nome !== undefined) {
    const nome = patch.nome.trim();
    if (nome.length < 2) return { success: false, error: "Nome muito curto." };
    update.nome = nome;
  }
  if (patch.avatar_url !== undefined) update.avatar_url = patch.avatar_url;
  if (Object.keys(update).length === 0) return { success: true };

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("user_profiles").update(update).eq("id", me.id);
  if (error) return { success: false, error: error.message };

  revalidatePath("/perfil");
  revalidatePath("/", "layout");
  return { success: true };
}

/**
 * CEO cria um novo usuário (login + perfil). Requer SUPABASE_SERVICE_KEY
 * (admin API do Supabase Auth). Cria o auth.user com senha inicial + email
 * confirmado, depois o user_profiles. Faz rollback do auth se o perfil falhar.
 */
export async function criarUsuario(input: {
  email: string;
  nome: string;
  papel: PapelUsuario;
  senha: string;
}): Promise<Result> {
  const me = await getUserProfile();
  if (me?.papel !== "ceo") return { success: false, error: "Acesso restrito ao CEO." };

  if (!hasServiceKey()) {
    return {
      success: false,
      error:
        "Criação de usuário desativada: configure a variável SUPABASE_SERVICE_KEY no ambiente (Vercel/.env.local) para habilitar.",
    };
  }
  if (!PAPEIS_VALIDOS.includes(input.papel)) return { success: false, error: "Papel inválido." };
  const email = input.email.trim().toLowerCase();
  const nome = input.nome.trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { success: false, error: "E-mail inválido." };
  if (nome.length < 2) return { success: false, error: "Informe o nome." };
  if (input.senha.length < 8) return { success: false, error: "Senha inicial deve ter ao menos 8 caracteres." };

  try {
    const admin = createAdminClient();
    const { data: created, error: authErr } = await admin.auth.admin.createUser({
      email,
      password: input.senha,
      email_confirm: true,
    });
    if (authErr || !created?.user) {
      return { success: false, error: authErr?.message ?? "Falha ao criar o login." };
    }

    const { error: profErr } = await admin.from("user_profiles").insert({
      id: created.user.id,
      email,
      nome,
      papel: input.papel,
      ativo: true,
    });
    if (profErr) {
      // Rollback: remove o auth.user órfão se o perfil falhar.
      await admin.auth.admin.deleteUser(created.user.id);
      return { success: false, error: profErr.message };
    }

    revalidatePath("/configuracoes");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Erro inesperado ao criar usuário." };
  }
}
