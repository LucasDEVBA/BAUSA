-- Head de Sucesso chamando a função DIRETO: deve falhar com 42501 (nada muda).
select set_config('request.jwt.claims', json_build_object('sub',
  (select id::text from public.user_profiles where papel = 'head_sucesso' and ativo limit 1),
  'role', 'authenticated')::text, true);
set local role authenticated;
select public.excluir_lead(p_deal_id => (select id from public.deals where deleted_at is null limit 1));
rollback;
