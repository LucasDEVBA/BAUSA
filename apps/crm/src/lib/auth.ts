import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from './supabase-server';
import type { PapelUsuario, UserProfile } from '@/types/crm';

export async function getSession() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function getUserProfile(): Promise<UserProfile | null> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  return data as UserProfile | null;
}

/**
 * Papel EFETIVO de autorização do usuário autenticado.
 *
 * CTO compartilha as permissões do CEO, então resolvemos cto→ceo AQUI — este é
 * o único ponto de autorização do app (requirePapel + todos os gates
 * `=== "ceo"` nas server actions passam por aqui). Espelha a função SQL
 * `public.get_user_papel()` que faz o mesmo no RLS. Para o papel REAL de
 * exibição (que mantém 'cto'), use `getUserProfile().papel`.
 */
export async function getUserPapel(): Promise<PapelUsuario | null> {
  const papel = (await getUserProfile())?.papel ?? null;
  return papel === 'cto' ? 'ceo' : papel;
}

export async function requireAuth() {
  const user = await getSession();
  if (!user) {
    redirect('/login');
  }
  return user;
}

export async function requirePapel(papel: PapelUsuario | PapelUsuario[]) {
  await requireAuth();
  const userPapel = await getUserPapel();
  const allowed = Array.isArray(papel) ? papel : [papel];

  if (!userPapel || !allowed.includes(userPapel)) {
    redirect('/');
  }

  return userPapel;
}
