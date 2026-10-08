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
    include: ["src/**/*.test.tsx"],
    setupFiles: ["./vitest.setup.ts"],
    // Sem globais: os testes importam describe/it/expect de "vitest", e o
    // `tsc --noEmit`/`next build` não precisam conhecer tipos globais de teste.
    globals: false,
  },
});
