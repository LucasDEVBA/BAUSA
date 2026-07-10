import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@bolsa-atleta/database"],
  experimental: {
    // Upload de imagem/PDF (mensagem direta, automações, remarketing) sobe via
    // Server Action. O default do Next é 1MB — um PDF > 1MB era rejeitado pelo
    // framework ANTES da action (que valida 10MB), estourando o error boundary
    // ("Application error"). 12mb cobre o teto de 10MB dos uploads + overhead do
    // multipart. O guard de tamanho no client evita exceder isto.
    serverActions: {
      bodySizeLimit: "12mb",
    },
  },
};

export default nextConfig;
