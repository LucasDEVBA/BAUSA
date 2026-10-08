-- Prova de que as políticas atletas_select/deals_select NÃO foram afrouxadas:
-- o UPDATE direto do soft delete, como CEO, continua barrado (42501).
select set_config('request.jwt.claims', json_build_object('sub',
  (select id::text from public.user_profiles where papel in ('ceo','cto') and ativo order by papel limit 1),
  'role', 'authenticated')::text, true);
set local role authenticated;
update public.deals set deleted_at = now()
 where id = (select id from public.deals where deleted_at is null limit 1);
rollback;
