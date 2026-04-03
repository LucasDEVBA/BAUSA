import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from './supabase';
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

export async function getUserPapel(): Promise<PapelUsuario | null> {
  const profile = await getUserProfile();
  return profile?.papel ?? null;
}

export async function requireAuth(locale: string = 'pt') {
  const user = await getSession();
  if (!user) {
    redirect(`/${locale === 'pt' ? '' : locale + '/'}login`);
  }
  return user;
}

export async function requirePapel(papel: PapelUsuario | PapelUsuario[], locale: string = 'pt') {
  await requireAuth(locale);
  const userPapel = await getUserPapel();
  const allowed = Array.isArray(papel) ? papel : [papel];

  if (!userPapel || !allowed.includes(userPapel)) {
    redirect(`/${locale === 'pt' ? '' : locale + '/'}crm`);
  }

  return userPapel;
}
