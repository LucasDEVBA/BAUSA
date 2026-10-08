-- ════════════════════════════════════════════════════════════════════════
-- DADOS (NÃO é migration) — T1: concluir a exclusão do Vicente Biernaski
-- Pedrollo (meio excluído desde 2026-08-24: form_submission excluída,
-- atleta + deal 'reuniao_realizada' vivos).
--
-- ⚠️ SÓ RODAR COM AUTORIZAÇÃO EXPLÍCITA DO CEO (TAREFAS.md, pergunta 3c).
-- Preferível: depois do deploy do T1, o CEO clica em "Excluir" no card —
-- a função excluir_lead completa a cascata com a trilha no nome dele.
-- Este script é o PLANO B (ex.: Engine fora do ar), executado pelo suporte.
--
-- Idempotente: todos os UPDATEs filtram deleted_at IS NULL; rodar 2x não
-- muda nada na 2ª. Termina em ROLLBACK por padrão — troque a última linha
-- por COMMIT só depois de conferir a prévia E ter a autorização.
-- Ids fixos (conferidos em 2026-10-08):
--   form_submission de2a046a-9590-49b8-803a-38dad71028e5
--   atleta          fde9834d-ff0e-41f1-8d40-3118b365cbce
--   deal            6ba447a6-c4e4-4519-bf5b-54b0c23fe868
-- ════════════════════════════════════════════════════════════════════════
begin;

-- 1. PRÉVIA (antes)
select 'antes' as fase,
  (select deleted_at from public.form_submissions where id = 'de2a046a-9590-49b8-803a-38dad71028e5') as fs_deleted_at,
  (select deleted_at from public.atletas where id = 'fde9834d-ff0e-41f1-8d40-3118b365cbce') as atleta_deleted_at,
  (select deleted_at from public.deals where id = '6ba447a6-c4e4-4519-bf5b-54b0c23fe868') as deal_deleted_at,
  (select etapa from public.deals where id = '6ba447a6-c4e4-4519-bf5b-54b0c23fe868') as deal_etapa,
  (select count(*) from public.contratos_financeiros where deal_id = '6ba447a6-c4e4-4519-bf5b-54b0c23fe868' and deleted_at is null) as contratos_vivos,
  (select count(*) from public.crm_experiencia where atleta_id = 'fde9834d-ff0e-41f1-8d40-3118b365cbce' and deleted_at is null) as experiencias_vivas,
  (select count(*) from public.whatsapp_grupos where atleta_id = 'fde9834d-ff0e-41f1-8d40-3118b365cbce') as grupos_vinculados,
  (select count(*) from public.tarefas where (deal_id = '6ba447a6-c4e4-4519-bf5b-54b0c23fe868' or atleta_id = 'fde9834d-ff0e-41f1-8d40-3118b365cbce')
     and deleted_at is null and status in ('pendente','em_andamento','atrasada')) as tarefas_abertas;

-- Trava de segurança: aborta se o lead virou cliente (contrato/Experiência)
do $$ begin
  if exists (select 1 from public.contratos_financeiros where deal_id = '6ba447a6-c4e4-4519-bf5b-54b0c23fe868' and deleted_at is null)
     or exists (select 1 from public.crm_experiencia where atleta_id = 'fde9834d-ff0e-41f1-8d40-3118b365cbce' and deleted_at is null) then
    raise exception 'Vicente tem contrato/Experiência ativos — NÃO excluir; falar com o CEO.';
  end if;
end $$;

-- 2. Contexto de auditoria (triggers de atletas/deals/tarefas/grupos)
select set_config('audit.user_id', '', true), set_config('audit.user_papel', 'suporte', true);

-- 3. Cascata (mesma da função excluir_lead; mesmo timestamp em tudo)
update public.deals set deleted_at = now()
 where id = '6ba447a6-c4e4-4519-bf5b-54b0c23fe868' and deleted_at is null;
update public.atletas set deleted_at = now()
 where id = 'fde9834d-ff0e-41f1-8d40-3118b365cbce' and deleted_at is null;
update public.whatsapp_grupos set atleta_id = null
 where atleta_id = 'fde9834d-ff0e-41f1-8d40-3118b365cbce';
update public.tarefas set status = 'cancelada'
 where (deal_id = '6ba447a6-c4e4-4519-bf5b-54b0c23fe868' or atleta_id = 'fde9834d-ff0e-41f1-8d40-3118b365cbce')
   and deleted_at is null and status in ('pendente','em_andamento','atrasada');
update public.form_submissions set deleted_at = now()
 where id = 'de2a046a-9590-49b8-803a-38dad71028e5' and deleted_at is null;  -- já excluída: 0 linhas

-- 4. Trilha explícita (só se algo mudou nesta transação)
insert into public.audit_logs (tabela, registro_id, operacao, dados_anteriores, dados_novos, campos_alterados, user_papel, justificativa)
select 'form_submissions', 'de2a046a-9590-49b8-803a-38dad71028e5', 'UPDATE',
       jsonb_build_object('deleted_at', '2026-08-24T14:17:00.883+00:00'),
       jsonb_build_object('cascata', jsonb_build_object('em', now(),
         'atletas', jsonb_build_array('fde9834d-ff0e-41f1-8d40-3118b365cbce'),
         'deals', jsonb_build_array('6ba447a6-c4e4-4519-bf5b-54b0c23fe868'))),
       array['deleted_at'], 'suporte',
       'T1 — concluir exclusão do Vicente (autorizado pelo CEO em <DATA>, pergunta 3c)'
where exists (select 1 from public.deals where id = '6ba447a6-c4e4-4519-bf5b-54b0c23fe868' and deleted_at = now());

-- 5. CONFERÊNCIA (depois) — esperado: tudo com deleted_at; 0 atletas vivos com fs excluída
select 'depois' as fase,
  (select deleted_at is not null from public.atletas where id = 'fde9834d-ff0e-41f1-8d40-3118b365cbce') as atleta_excluido,
  (select deleted_at is not null from public.deals where id = '6ba447a6-c4e4-4519-bf5b-54b0c23fe868') as deal_excluido,
  (select count(*) from public.form_submissions fs join public.atletas a on a.form_submission_id = fs.id
    where fs.deleted_at is not null and a.deleted_at is null) as atletas_vivos_com_fs_excluida,
  (select count(*) from public.audit_logs where created_at = now()) as linhas_de_audit;

rollback;  -- ← trocar por COMMIT somente com autorização do CEO
