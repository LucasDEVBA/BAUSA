import { getTranslations, setRequestLocale } from "next-intl/server";

import { BauFooter } from "@/components/sections/BauFooter";
import { BauHeader, type NavItem } from "@/components/sections/BauHeader";
import { BAU_PAGES } from "@/config/site-pages";

/**
 * Casca do site institucional.
 *
 * O `data-bau` escopa TODO o território visual da marca (fundo navy, cor de
 * texto, foco gold) — ver `app/bau.css`. Sem esse escopo, pintar o fundo em
 * `body`/`:root` derrubaria o tema claro de /forms, /acesso e do 404, que
 * seguem com o visual atual.
 */
export default async function BauLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("site");

  // Ordem = lógica narrativa do BAU-01: o que é → como funciona → o que
  // acontece na prática → como meu filho vai viver → quem já viveu → quem
  // conduz. Não reordenar por conveniência de layout.
  const items: NavItem[] = [
    { href: "/", label: t("nav.home") },
    { href: `/${BAU_PAGES.concept.slug}`, label: t("nav.concept") },
    { href: `/${BAU_PAGES.method.slug}`, label: t("nav.method") },
    { href: `/${BAU_PAGES.journey.slug}`, label: t("nav.journey") },
    { href: `/${BAU_PAGES.boarding.slug}`, label: t("nav.boarding") },
    { href: `/${BAU_PAGES.stories.slug}`, label: t("nav.stories") },
    { href: `/${BAU_PAGES.founder.slug}`, label: t("nav.founder") },
  ];

  return (
    <div data-bau>
      <BauHeader
        items={items}
        ctaLabel={t("cta.primary")}
        menuLabel={t("nav.menu")}
        openMenuLabel={t("nav.openMenu")}
      />

      <main id="conteudo">{children}</main>

      <BauFooter
        items={items}
        navLabel={t("footer.navLabel")}
        contactLabel={t("footer.contactLabel")}
        brand={{
          name: t("brand.name"),
          concept: t("brand.concept"),
          tagline: t("brand.tagline"),
          email: t("brand.email"),
          instagram: t("brand.instagram"),
          instagramUrl: t("brand.instagramUrl"),
          copyright: t("brand.copyright"),
        }}
      />
    </div>
  );
}
