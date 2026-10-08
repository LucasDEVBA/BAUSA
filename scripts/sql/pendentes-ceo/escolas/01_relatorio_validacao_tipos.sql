-- ════════════════════════════════════════════════════════════════════════
-- Banco de Escolas — relatório para a Head/Silvio validarem (T15, passo 4)
-- SOMENTE LEITURA. Rodar DEPOIS da migration 20261008170000 (usa `perfil`).
-- Origem dos dados: import do Trello feito pela IA em 20/08/2026 — tipo e
-- localização foram DEDUZIDOS e precisam de confirmação humana.
-- Uso: copiar o resultado para uma planilha/WhatsApp e pedir, por escola:
--   tipo (Boarding / Day school / Boarding + Day), perfil (opcional),
--   cidade/UF e site oficial quando "localizacao_pendente" = true, e
--   inglês mínimo / série máxima (PG?) / influência do esporte — hoje são o
--   DEFAULT do banco (intermediario / 12th / moderada), não dado informado.
-- Não expõe telefone/e-mail (officer fica de fora de propósito).
-- ════════════════════════════════════════════════════════════════════════
SELECT
  e.nome,
  CASE e.tipo
    WHEN 'boarding' THEN 'Boarding (internato)'
    WHEN 'day'      THEN 'Day school'
    WHEN 'mista'    THEN 'Boarding + Day'
    ELSE e.tipo
  END                                                        AS tipo_atual,
  COALESCE(CASE e.perfil
    WHEN 'academia_esportiva'     THEN 'Academia esportiva'
    WHEN 'prep_tradicional'       THEN 'Prep school tradicional'
    WHEN 'religiosa'              THEN 'Religiosa'
    WHEN 'boarding_internacional' THEN 'Boarding internacional'
    WHEN 'outro'                  THEN 'Outro'
  END, 'Não classificado')                                    AS perfil_atual,
  e.cidade,
  e.estado_us,
  (e.cidade IN ('', 'A confirmar') OR e.estado_us !~ '^[A-Z]{2}$') AS localizacao_pendente,
  COALESCE(e.website, '—')                                   AS website,
  -- Os 3 abaixo vieram do DEFAULT da coluna no import (ninguém informou):
  -- aparecem no card como dado; pedir confirmação junto com o tipo.
  e.ingles_minimo::text                                      AS ingles_minimo_padrao_import,
  e.serie_maxima                                             AS serie_maxima_padrao_import,
  e.influencia_esporte::text                                 AS influencia_padrao_import,
  e.status,
  (SELECT count(*) FROM public.estrategia_escolas es
    WHERE es.escola_id = e.id AND es.deleted_at IS NULL)     AS atletas_bausa
FROM public.escolas e
WHERE e.deleted_at IS NULL
ORDER BY localizacao_pendente DESC, e.nome;

-- Conferência rápida (deve bater com o filtro "Tipo" da tela /escolas):
-- SELECT tipo, count(*) FROM public.escolas WHERE deleted_at IS NULL GROUP BY tipo;
