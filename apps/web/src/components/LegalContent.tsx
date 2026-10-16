import MeshBackground from "@/components/brand/MeshBackground";
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
 * revisores automatizados. Por isso não usa as revelações ba-rv (dependem de JS).
 */
export default function LegalContent({ doc, outroDoc }: LegalContentProps) {
  return (
    <>
      {/* Header, Footer e dock vêm do layout (site). O header é uma pílula fixa: o topo generoso evita que o título nasça escondido sob ela */}
      <div className="relative isolate flex-1 overflow-hidden px-[var(--ba-gutter)] pb-[clamp(64px,8vw,112px)] pt-[clamp(116px,13vw,168px)]">
        <MeshBackground blobs={["b1", "b2", "b4"]} grid className="h-[900px]" />

        <article className="ba-glass relative z-[1] mx-auto w-full max-w-[820px] rounded-[26px] px-5 py-9 sm:rounded-[32px] sm:px-[clamp(32px,6vw,72px)] sm:py-[clamp(44px,6vw,72px)]">
          <header className="mb-9 border-b border-[var(--ba-stroke)] pb-8">
            <span className="ba-eyebrow ba-glass mb-5">
              <span className="ba-dot" />
              Bolsa Atleta USA
            </span>
            <h1 className="font-[family-name:var(--ba-display)] text-[clamp(30px,4.4vw,48px)] font-bold leading-[1.06] tracking-[-0.04em] text-[var(--ba-ink)]">
              {doc.titulo}
            </h1>
            <p className="mt-3 text-[14px] font-medium text-[var(--ba-ink-3)]">{doc.atualizadoEm}</p>
          </header>

          {doc.intro.map((p, i) => (
            <p key={i} className="mb-4 text-[16px] leading-[1.75] text-[var(--ba-ink-2)]">
              {p}
            </p>
          ))}

          {doc.secoes.map((secao) => (
            <section key={secao.titulo} className="mt-11">
              <h2 className="mb-3 font-[family-name:var(--ba-display)] text-[clamp(20px,2.2vw,25px)] font-semibold leading-[1.2] tracking-[-0.025em] text-[var(--ba-ink)]">
                {secao.titulo}
              </h2>

              {secao.paragrafos?.map((p, i) => (
                <p key={i} className="mb-3 text-[16px] leading-[1.75] text-[var(--ba-ink-2)]">
                  {p}
                </p>
              ))}

              {secao.itens && (
                <ul className="mt-3 space-y-2.5">
                  {secao.itens.map((item, i) => (
                    <li
                      key={i}
                      className="relative pl-6 text-[16px] leading-[1.7] text-[var(--ba-ink-2)] before:absolute before:left-0 before:top-[0.62em] before:h-2 before:w-2 before:rounded-full before:bg-[linear-gradient(135deg,var(--ba-wine-2),var(--ba-wine))] before:shadow-[0_0_0_4px_rgba(144,36,52,0.1)]"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}

          <nav className="mt-14 border-t border-[var(--ba-stroke)] pt-8">
            <Link href={outroDoc.href} className="ba-btn ba-btn-ghost">
              {outroDoc.rotulo}
            </Link>
          </nav>
        </article>
      </div>
    </>
  );
}
