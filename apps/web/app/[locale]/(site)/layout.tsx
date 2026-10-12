import type { Viewport } from "next";

import SiteChrome from "@/components/site/SiteChrome";

// viewport-fit=cover só nas páginas com dock: env(safe-area-inset-*) deixa de
// valer 0 no iOS. /forms e /acesso ficam fora (não têm tratamento de safe-area).
export const viewport: Viewport = {
  viewportFit: "cover",
};

interface SiteLayoutProps {
  children: React.ReactNode;
}

export default function SiteLayout({ children }: SiteLayoutProps) {
  return <SiteChrome>{children}</SiteChrome>;
}
