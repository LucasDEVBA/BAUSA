import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { type Lead } from "@/types/lead";

import { useDossieLead } from "./DossieLead";

const obterLeadDossie = vi.hoisted(() => vi.fn());
vi.mock("@/lib/actions/leads-busca", () => ({ obterLeadDossie }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

// O hook só lê o id e repassa o objeto; o resto do Lead não importa aqui.
const leadFake = (id: string): Lead => ({ id }) as Lead;

type Props = { lead: Lead | null };

const renderDossie = (lead: Lead | null) =>
  renderHook(({ lead: inicial }: Props) => useDossieLead(inicial), { initialProps: { lead } });

afterEach(() => {
  obterLeadDossie.mockReset();
});

describe("useDossieLead — deep-link ?lead=/?atleta= (T14)", () => {
  it("abre o dossiê quando o deep-link muda sem remontar (sininho clicado já em /leads)", () => {
    const { result, rerender } = renderDossie(null);
    expect(result.current.estado).toEqual({ status: "fechado" });

    const y = leadFake("y");
    rerender({ lead: y });

    expect(result.current.estado).toEqual({ status: "aberto", lead: y });
  });

  it("troca para o lead novo quando outro deep-link chega com um dossiê aberto", () => {
    const x = leadFake("x");
    const y = leadFake("y");
    const { result, rerender } = renderDossie(x);
    expect(result.current.estado).toEqual({ status: "aberto", lead: x });

    rerender({ lead: y });

    expect(result.current.estado).toEqual({ status: "aberto", lead: y });
  });

  it("reabre o MESMO lead depois de fechar, quando o deep-link sai da URL e volta", () => {
    const x = leadFake("x");
    const { result, rerender } = renderDossie(x);

    act(() => result.current.fechar());
    rerender({ lead: null });
    expect(result.current.estado).toEqual({ status: "fechado" });

    rerender({ lead: leadFake("x") });
    expect(result.current.estado.status).toBe("aberto");
  });

  it("não reabre sozinho num re-render do servidor com o mesmo deep-link (router.refresh)", () => {
    const { result, rerender } = renderDossie(leadFake("x"));
    act(() => result.current.fechar());

    rerender({ lead: leadFake("x") });

    expect(result.current.estado).toEqual({ status: "fechado" });
  });

  it("clique em voo não cobre o dossiê do deep-link que chegou depois", async () => {
    let responder: (r: { success: true; lead: Lead }) => void = () => {};
    obterLeadDossie.mockReturnValue(new Promise((resolve) => (responder = resolve)));
    const { result, rerender } = renderDossie(null);

    act(() => void result.current.abrir("z"));
    expect(result.current.estado).toEqual({ status: "carregando" });

    const y = leadFake("y");
    rerender({ lead: y });
    await act(async () => responder({ success: true, lead: leadFake("z") }));

    expect(result.current.estado).toEqual({ status: "aberto", lead: y });
  });
});
