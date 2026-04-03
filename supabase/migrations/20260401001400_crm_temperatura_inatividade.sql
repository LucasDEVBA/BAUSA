-- ============================================================
-- CRM Bolsa Atleta USA — Temperatura automática + Inatividade
-- Trigger: ansiedade >= 4 OR satisfacao <= 2 → vermelho
-- Função: lista famílias com inatividade acima do threshold
-- ============================================================

-- ── Substituir trigger de temperatura existente ──────────────
-- O trigger anterior (20260401001200) fazia apenas vermelho.
-- Este faz verde/amarelo/vermelho completo.
-- Thresholds fixos (4/2) — documentado na spec como configurável
-- pelo CEO, mas no trigger usa valores fixos por performance.
-- Mudança de thresholds requer atualização da aplicação.

CREATE OR REPLACE FUNCTION public.trg_experiencia_temperatura()
RETURNS TRIGGER AS $$
BEGIN
  -- Vermelho: ansiedade >= 4 ou satisfacao <= 2 (Regra 8)
  IF NEW.ansiedade >= 4 OR NEW.satisfacao <= 2 THEN
    NEW.temperatura := 'vermelho';
  -- Verde: ansiedade baixa e satisfacao alta e sem problemas
  ELSIF NEW.ansiedade <= 2 AND NEW.satisfacao >= 4 AND NEW.status = 'satisfeita' THEN
    NEW.temperatura := 'verde';
  -- Amarelo: caso intermediário
  ELSE
    NEW.temperatura := 'amarelo';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recria trigger (DROP IF EXISTS já feito na migration anterior)
DROP TRIGGER IF EXISTS trg_experiencia_temp ON public.crm_experiencia;
CREATE TRIGGER trg_experiencia_temp
  BEFORE INSERT OR UPDATE OF ansiedade, satisfacao, status ON public.crm_experiencia
  FOR EACH ROW EXECUTE FUNCTION public.trg_experiencia_temperatura();

-- ── Função: famílias em alerta de inatividade ────────────────
-- Retorna famílias cujo dias_sem_contato > threshold da fase.
-- Thresholds: admissao=7, pre_embarque=15, embarcado_inicial=7, acompanhamento=30
CREATE OR REPLACE FUNCTION public.familias_em_alerta_inatividade()
RETURNS TABLE(
  experiencia_id UUID,
  atleta_nome TEXT,
  dias INT,
  fase TEXT,
  threshold INT
) AS $$
  SELECT
    ce.id,
    a.nome_completo,
    EXTRACT(DAY FROM NOW() - ce.data_ultimo_contato)::INT,
    ce.fase::TEXT,
    CASE ce.fase
      WHEN 'admissao' THEN 7
      WHEN 'pre_embarque' THEN 15
      WHEN 'embarcado_inicial' THEN 7
      WHEN 'acompanhamento' THEN 30
      ELSE 30
    END
  FROM crm_experiencia ce
  JOIN atletas a ON a.id = ce.atleta_id
  WHERE ce.deleted_at IS NULL
  AND ce.fase NOT IN ('encerrado', 'aprovado')
  AND ce.data_ultimo_contato IS NOT NULL
  AND EXTRACT(DAY FROM NOW() - ce.data_ultimo_contato) >
    CASE ce.fase
      WHEN 'admissao' THEN 7
      WHEN 'pre_embarque' THEN 15
      WHEN 'embarcado_inicial' THEN 7
      WHEN 'acompanhamento' THEN 30
      ELSE 30
    END
$$ LANGUAGE sql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION public.familias_em_alerta_inatividade() IS 'Retorna famílias com dias sem contato acima do threshold por fase';
