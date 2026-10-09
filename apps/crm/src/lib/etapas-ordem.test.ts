import { describe, expect, it } from "vitest";

import {
  DEFAULT_DEAL_STAGE_DISPLAY,
  etapasGanho,
  mergeDealStageConfig,
  parseEtapasDealConfig,
  parseEtapasDealRegras,
} from "@/lib/etapas-deal";
import { colunasAnterioresBoard, proximaColunaBoard } from "@/lib/etapas-ordem";
import { isAcaoAtrasadaDaEtapa } from "@/lib/proxima-acao";

// Config de PRODUÇÃO em 09/10/2026 (configuracoes_sistema): Admitido =
// custom_1, Valor total pago = custom_2 (ambas ganho), Plano escolhido
// visível e pedindo plano, slots custom_3..6 só com `order` (ocultos e sem
// nome), admission_process/negociacao/concluido ocultos.
const OVERRIDES_PRD = parseEtapasDealConfig({
  contato_feito: { label: "Contato feito", order: 1, oculta: false },
  lead: { label: "Lead qualificado", order: 2, oculta: false },
  reuniao_marcada: { label: "Reunião marcada", order: 3, oculta: false },
  reuniao_realizada: { label: "Reunião realizada", order: 4, oculta: false },
  proposta_enviada: { label: "Proposta enviada", order: 5, oculta: false },
  contrato_enviado: { label: "Contrato enviado", order: 6, oculta: false },
  contrato_assinado: { label: "Contrato assinado", order: 7, oculta: false },
  sinal_pago: { label: "Sinal pago", order: 8, oculta: false },
  plano_escolhido: { label: "Plano escolhido", order: 9, oculta: false },
  custom_1: { label: "Admitido", order: 10, oculta: false },
  custom_2: { label: "Valor total pago", order: 11, oculta: false },
  perdido: { label: "Perdido", order: 12, oculta: false },
  custom_3: { order: 13 },
  custom_4: { order: 14 },
  custom_5: { order: 15 },
  custom_6: { order: 16 },
  aguardando_timing: { order: 17, oculta: true },
  diagnostico_fit: { order: 18, oculta: true },
  alinhamento_estrategico: { order: 19, oculta: true },
  followup_proposta: { order: 20, oculta: true },
  admission_process: { order: 21, oculta: true },
  concluido: { order: 22, oculta: true },
  negociacao: { order: 23, oculta: true },
});
const REGRAS_PRD = parseEtapasDealRegras({
  custom_1: { ganho: true },
  custom_2: { ganho: true },
  plano_escolhido: { pede_plano: true },
});
const CONFIG_PRD = mergeDealStageConfig(OVERRIDES_PRD, REGRAS_PRD);

describe("editor do deal: Avançar/Retroceder pela ordem do board (T2/T17/T20)", () => {
  it("Valor total pago (custom_2) não avança para o slot oculto e sem nome custom_3", () => {
    expect(proximaColunaBoard("custom_2", CONFIG_PRD)).toBeNull();
    // Com o default estático (bug do dossiê fora do board) o destino era custom_3.
    expect(CONFIG_PRD.custom_3.oculta).toBe(true);
  });

  it("Sinal pago avança para Plano escolhido (coluna que pede plano), sem pular", () => {
    const proxima = proximaColunaBoard("sinal_pago", CONFIG_PRD);
    expect(proxima).toBe("plano_escolhido");
    expect(CONFIG_PRD.plano_escolhido.pedePlano).toBe(true);
    expect(proximaColunaBoard("plano_escolhido", CONFIG_PRD)).toBe("custom_1");
  });

  it("nunca oferece coluna oculta nem Perdido como destino, de nenhuma etapa", () => {
    for (const atual of Object.keys(CONFIG_PRD) as (keyof typeof CONFIG_PRD)[]) {
      const proxima = proximaColunaBoard(atual, CONFIG_PRD);
      if (proxima) {
        expect(CONFIG_PRD[proxima].oculta, `${atual} → ${proxima}`).toBe(false);
        expect(proxima).not.toBe("perdido");
      }
      for (const anterior of colunasAnterioresBoard(atual, CONFIG_PRD)) {
        expect(CONFIG_PRD[anterior].oculta, `${atual} ← ${anterior}`).toBe(false);
        expect(anterior).not.toBe("perdido");
      }
    }
  });

  it("etapa atual OCULTA conta na posição em que o board a desenha (sem fallback estático)", () => {
    // admission_process está oculta e DEPOIS de Perdido no board do CEO:
    // não há coluna visível à frente; antes dela, só as visíveis, em ordem.
    expect(proximaColunaBoard("admission_process", CONFIG_PRD)).toBeNull();
    expect(colunasAnterioresBoard("admission_process", CONFIG_PRD)).toEqual([
      "contato_feito",
      "lead",
      "reuniao_marcada",
      "reuniao_realizada",
      "proposta_enviada",
      "contrato_enviado",
      "contrato_assinado",
      "sinal_pago",
      "plano_escolhido",
      "custom_1",
      "custom_2",
    ]);
  });

  it("Retroceder lista só as colunas visíveis antes da atual, na ordem do CEO", () => {
    expect(colunasAnterioresBoard("contrato_assinado", CONFIG_PRD)).toEqual([
      "contato_feito",
      "lead",
      "reuniao_marcada",
      "reuniao_realizada",
      "proposta_enviada",
      "contrato_enviado",
    ]);
  });

  it("etapa fora do Kanban (projeto futuro) não oferece avanço nem retrocesso", () => {
    expect(proximaColunaBoard("projeto_futuro", CONFIG_PRD)).toBeNull();
    expect(colunasAnterioresBoard("projeto_futuro", CONFIG_PRD)).toEqual([]);
  });

  it("default estático (config ilegível) também nunca oferece coluna oculta", () => {
    const proxima = proximaColunaBoard("sinal_pago", DEFAULT_DEAL_STAGE_DISPLAY);
    expect(proxima).not.toBeNull();
    expect(DEFAULT_DEAL_STAGE_DISPLAY[proxima ?? "sinal_pago"].oculta).toBe(false);
  });
});

describe("Contratos assinados = ganho (T20)", () => {
  it("contrato assinado em diante + colunas de ganho; nunca contrato enviado nem negociação", () => {
    const ganho = etapasGanho(CONFIG_PRD);
    for (const etapa of ["contrato_assinado", "sinal_pago", "plano_escolhido", "admission_process", "custom_1", "custom_2"]) {
      expect(ganho).toContain(etapa);
    }
    expect(ganho).not.toContain("contrato_enviado");
    expect(ganho).not.toContain("negociacao");
    expect(ganho).not.toContain("custom_3");
  });
});

describe("ação atrasada só da etapa atual (T21)", () => {
  const HOJE = "2026-10-09";

  it("ação herdada de outra etapa vencida não é atraso (caso Matheus em Sinal pago)", () => {
    const deal = { next_action: "Preparar para reunião", next_action_date: "2026-09-08" };
    expect(isAcaoAtrasadaDaEtapa(deal, "sinal_pago", HOJE)).toBe(false);
  });

  it("ação da etapa atual vencida é atraso", () => {
    const deal = {
      next_action: "Confirmar o pagamento do sinal",
      next_action_etapa: "contrato_assinado",
      next_action_date: "2026-10-01",
    };
    expect(isAcaoAtrasadaDaEtapa(deal, "contrato_assinado", HOJE)).toBe(true);
  });

  it("ação escrita à mão vencida é atraso mesmo depois de mudar de etapa", () => {
    const deal = {
      next_action: "Ligar para o pai",
      next_action_etapa: "reuniao_marcada",
      next_action_manual: true,
      next_action_date: "2026-10-01",
    };
    expect(isAcaoAtrasadaDaEtapa(deal, "sinal_pago", HOJE)).toBe(true);
  });

  it("prazo hoje ou futuro não é atraso; sem prazo não é atraso", () => {
    expect(isAcaoAtrasadaDaEtapa({ next_action: "Ligar", next_action_date: HOJE }, "lead", HOJE)).toBe(false);
    expect(isAcaoAtrasadaDaEtapa({ next_action: "Ligar", next_action_date: null }, "lead", HOJE)).toBe(false);
  });
});
