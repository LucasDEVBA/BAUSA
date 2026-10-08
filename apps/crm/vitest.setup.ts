import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { toHaveNoViolations } from "jest-axe";
import { afterAll, afterEach, beforeAll, expect } from "vitest";

// Sem `globals: true` a autoconfiguração do RTL não acha afterEach/beforeAll
// globais e não roda nenhuma das duas metades; repomos as duas aqui.
type ReactActGlobal = { IS_REACT_ACT_ENVIRONMENT?: boolean };
const reactActGlobal = globalThis as ReactActGlobal;
let ambienteActAnterior: boolean | undefined;

// Sem isto o React 19 não avisa "not wrapped in act(...)": um update que
// chega depois do `await user.click` (server action mockada resolvendo)
// passaria sem sinal e o teste ficaria intermitente.
beforeAll(() => {
  ambienteActAnterior = reactActGlobal.IS_REACT_ACT_ENVIRONMENT;
  reactActGlobal.IS_REACT_ACT_ENVIRONMENT = true;
});

afterAll(() => {
  reactActGlobal.IS_REACT_ACT_ENVIRONMENT = ambienteActAnterior;
});

// Sem este cleanup o DOM de um teste vaza para o seguinte.
afterEach(() => {
  cleanup();
});

expect.extend(toHaveNoViolations);

declare module "vitest" {
  interface Matchers<T> {
    /** jest-axe: falha listando cada violação do axe-core com o nó e o link da regra. */
    toHaveNoViolations(): T;
  }
}
