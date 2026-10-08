import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "jsdom",
    // .ts também: o tsc e o next build já checam esses arquivos, então um
    // teste de função pura fora do include passaria verde sem nunca rodar.
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["./vitest.setup.ts"],
    // Sem globais: os testes importam describe/it/expect de "vitest", e o
    // `tsc --noEmit`/`next build` não precisam conhecer tipos globais de teste.
    globals: false,
  },
});
