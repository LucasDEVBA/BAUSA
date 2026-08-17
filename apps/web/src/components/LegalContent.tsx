import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Link } from "@/i18n/navigation";
import type { DocumentoLegal } from "@/content/legal";

interface LegalContentProps {
  doc: DocumentoLegal;
  /** Links para o outro documento legal, no idioma corrente. */
  outroDoc: { href: string; rotulo: string };
}

/**
 * Renderiza um documento legal (privacidade / exclusão de dados).
 *
 * Server Component de propósito: é texto estático: nada aqui precisa de
 * JavaScript no cliente, e uma política de privacidade é justamente o tipo de
 * página que tem que abrir rápido e ser legível por leitores de tela e por
 * revisores automatizados.
 */
export default function LegalContent({ doc, outroDoc }: LegalContentProps) {
  return (
    <div className="min-h-screen bg-background font-sans">
      <Header />

      <main className="px-4 pt-28 pb-16 sm:pt-32 sm:pb-24">
        <article className="mx-auto w-full max-w-3xl">
          <header className="mb-10 border-b border-muted pb-8">
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground">{doc.titulo}</h1>
            <p className="mt-3 text-sm text-muted-foreground">{doc.atualizadoEm}</p>
          </header>

          {doc.intro.map((p, i) => (
            <p key={i} className="mb-4 text-base leading-relaxed text-foreground/90">
              {p}
            </p>
          ))}

          {doc.secoes.map((secao) => (
            <section key={secao.titulo} className="mt-10">
              <h2 className="mb-3 text-xl sm:text-2xl font-semibold text-foreground">
                {secao.titulo}
              </h2>

              {secao.paragrafos?.map((p, i) => (
                <p key={i} className="mb-3 text-base leading-relaxed text-foreground/90">
                  {p}
                </p>
              ))}

              {secao.itens && (
                <ul className="mt-2 space-y-2">
                  {secao.itens.map((item, i) => (
                    <li
                      key={i}
                      className="relative pl-5 text-base leading-relaxed text-foreground/90 before:absolute before:left-0 before:top-[0.65em] before:h-1.5 before:w-1.5 before:rounded-full before:bg-[hsl(var(--burgundy))]"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}

          <nav className="mt-14 border-t border-muted pt-8">
            <Link
              href={outroDoc.href}
              className="text-base font-medium text-[hsl(var(--burgundy))] underline underline-offset-4 hover:opacity-80"
            >
              {outroDoc.rotulo}
            </Link>
          </nav>
        </article>
      </main>

      <Footer />
    </div>
  );
}
