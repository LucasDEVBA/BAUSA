import { describe, expect, it } from "vitest";

import { calcularTaxaConversao, descreverBaseConversao, formatarTaxaConversao } from "@/lib/taxa-conversao";

describe("calcularTaxaConversao", () => {
  it("should count signed contracts as wins even with zero concluded deals", () => {
    // Caso real de 17/11/2026: 8 contratos assinados, nenhum concluído, 12 perdidos.
    const t = calcularTaxaConversao(8, 12);
    expect(t).toEqual({ taxa: 40, ganhos: 8, decididos: 20 });
    expect(formatarTaxaConversao(t)).toBe("40%");
  });

  it("should return null (shown as dash) when no deal was decided", () => {
    const t = calcularTaxaConversao(0, 0);
    expect(t.taxa).toBeNull();
    expect(formatarTaxaConversao(t)).toBe("—");
    expect(descreverBaseConversao(t)).toBe("Nenhum deal ganho ou perdido ainda");
  });

  it("should return 0% when there are only losses", () => {
    expect(formatarTaxaConversao(calcularTaxaConversao(0, 5))).toBe("0%");
  });

  it("should return 100% when there are only wins", () => {
    expect(calcularTaxaConversao(3, 0).taxa).toBe(100);
  });

  it("should ignore negative, fractional and non-finite inputs", () => {
    expect(calcularTaxaConversao(-2, Number.NaN)).toEqual({ taxa: null, ganhos: 0, decididos: 0 });
    expect(calcularTaxaConversao(2.9, Number.POSITIVE_INFINITY)).toEqual({ taxa: 100, ganhos: 2, decididos: 2 });
  });

  it("should describe the base in Portuguese with singular and plural", () => {
    expect(descreverBaseConversao(calcularTaxaConversao(1, 3))).toBe("1 ganho de 4 decididos");
    expect(descreverBaseConversao(calcularTaxaConversao(8, 12))).toBe("8 ganhos de 20 decididos");
  });
});
