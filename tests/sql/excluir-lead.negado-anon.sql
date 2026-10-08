-- anon (chave pública do site): sem EXECUTE na função → 42501.
set local role anon;
select public.excluir_lead(p_deal_id => '00000000-0000-4000-8000-000000000000');
rollback;
