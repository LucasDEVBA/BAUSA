-- Teste de integração da exclusão de lead (T1) — roda como `authenticated`
-- com JWT de CEO/CTO, contra a RLS REAL. SEMPRE termina em ROLLBACK.
-- O runner (tests/excluir-lead-integracao.test.js) prefixa o conteúdo da
-- migration *_excluir_lead_atomico.sql para testar o código do PR antes do deploy.
-- Fixtures dinâmicas (sem id fixo): um lead VIVO com atleta+deal, sem
-- contrato e sem Experiência.
select set_config('t.ceo', (select id::text from public.user_profiles
  where papel in ('ceo','cto') and ativo order by papel limit 1), true);
select set_config('t.fs', (select a.form_submission_id::text
  from public.atletas a join public.deals d on d.atleta_id = a.id
  join public.form_submissions fs on fs.id = a.form_submission_id
  where a.deleted_at is null and d.deleted_at is null and fs.deleted_at is null
    and not exists (select 1 from public.contratos_financeiros c where c.deal_id = d.id and c.deleted_at is null)
    and not exists (select 1 from public.crm_experiencia e where e.atleta_id = a.id and e.deleted_at is null)
  order by d.created_at desc limit 1), true);
select set_config('t.atleta', (select id::text from public.atletas where form_submission_id = current_setting('t.fs')::uuid), true);
select set_config('t.deal', (select id::text from public.deals where atleta_id = current_setting('t.atleta')::uuid and deleted_at is null limit 1), true);
-- Estado "meio excluído" (o bug do Vicente): fs excluída, atleta+deal vivos
update public.form_submissions set deleted_at = now() - interval '1 day' where id = current_setting('t.fs')::uuid;
-- Grupo vinculado ao atleta (deve ser DESVINCULADO, nunca apagado)
insert into public.whatsapp_grupos (grupo_id, nome, atleta_id)
values ('it-rollback-excluir-lead', 'integração rollback', current_setting('t.atleta')::uuid);

select set_config('request.jwt.claims',
  json_build_object('sub', current_setting('t.ceo'), 'role', 'authenticated')::text, true);
set local role authenticated;
-- (0) o bug: UPDATE direto como CEO continua barrado pela RLS (policies intactas)
--     (não executado aqui — abortaria a transação; coberto no caso "rls_intacta")
select set_config('t.r1', public.excluir_lead(p_deal_id => current_setting('t.deal')::uuid)::text, true);
select set_config('t.r2', public.excluir_lead(p_deal_id => current_setting('t.deal')::uuid)::text, true);
select set_config('t.r3', public.excluir_lead(p_form_submission_id => current_setting('t.fs')::uuid)::text, true);
-- o CEO NÃO passa a ver excluídos (políticas de SELECT intactas)
select set_config('t.ceo_ve_deal', (select count(*)::text from public.deals where id = current_setting('t.deal')::uuid), true);
reset role;

select jsonb_build_object(
  'r1', current_setting('t.r1')::jsonb,
  'r2', current_setting('t.r2')::jsonb,
  'r3', current_setting('t.r3')::jsonb,
  'ceo_ve_deal_excluido', current_setting('t.ceo_ve_deal')::int,
  'atleta_excluido', (select deleted_at is not null from public.atletas where id = current_setting('t.atleta')::uuid),
  'deal_excluido', (select deleted_at is not null from public.deals where id = current_setting('t.deal')::uuid),
  'grupo', (select jsonb_build_object('existe', true, 'atleta_id', atleta_id, 'deleted_at', deleted_at)
            from public.whatsapp_grupos where grupo_id = 'it-rollback-excluir-lead'),
  'atletas_vivos_com_fs_excluida', (select count(*) from public.form_submissions fs
     join public.atletas a on a.form_submission_id = fs.id where fs.deleted_at is not null and a.deleted_at is null
     and fs.id = current_setting('t.fs')::uuid),
  'audit_com_usuario', (select count(*) from public.audit_logs where created_at = now()
     and user_id = current_setting('t.ceo')::uuid)
) as resultado;
rollback;
