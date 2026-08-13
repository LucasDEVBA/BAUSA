import { z } from "zod";

// ════════════════════════════════════════════════════════════════════════
// Escopo dos Fluxos — schema, tipo e constantes.
//
// Vive FORA do arquivo de actions porque um módulo "use server" só pode
// exportar funções async: exportar const/type de lá quebra o build do Next
// (e o tsc NÃO acusa — é regra do bundler). Mesmo motivo do ads-utm.ts.
// ════════════════════════════════════════════════════════════════════════

export const ESCOPO_CHAVE = "fluxos_escopo";

export const escopoSchema = z.object({
  modo: z.enum(["desligado", "lista", "global"]),
  telefones: z.array(z.string().trim().min(8).max(20)).max(50).default([]),
  grupos: z.array(z.string().trim().min(5).max(80)).max(50).default([]),
});

export type FluxosEscopo = z.infer<typeof escopoSchema>;

/** Fail-closed: o padrão de qualquer caminho de erro é DESLIGADO. */
export const ESCOPO_PADRAO: FluxosEscopo = { modo: "desligado", telefones: [], grupos: [] };
