import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { toHaveNoViolations } from "jest-axe";
import { afterEach, expect } from "vitest";

// Sem `globals: true` o RTL não acha um afterEach global para se registrar;
// sem este cleanup o DOM de um teste vaza para o seguinte.
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
