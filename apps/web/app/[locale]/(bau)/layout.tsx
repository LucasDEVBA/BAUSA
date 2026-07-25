import { setRequestLocale } from "next-intl/server";

/**
 * Casca do site institucional.
 *
 * O `data-bau` é o que escopa TODO o território visual da marca (fundo navy,
 * cor de texto, foco gold) — ver `app/bau.css`. Sem esse escopo, pintar o
 * fundo em `body`/`:root` derrubaria o tema claro de /forms, /acesso e do 404,
 * que continuam com o visual atual.
 *
 * Header e Footer são montados aqui para que as páginas sejam só composição
 * de seções.
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

  return (
    <div data-bau>
      <main id="conteudo">{children}</main>
    </div>
  );
}
