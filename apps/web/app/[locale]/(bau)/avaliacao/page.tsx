import { getTranslations, setRequestLocale } from "next-intl/server";

import FormsContent from "@/components/FormsContent";
import { Eyebrow, Reveal, Section } from "@/components/bau";
import { BAU_PAGES, buildBauMetadata } from "@/config/site-pages";

export const metadata = buildBauMetadata(BAU_PAGES.evaluation);

interface PageProps {
  params: Promise<{ locale: string }>;
}

/**
 * A página mais silenciosa do site (BAU-02 Parte 3): sem marca d'água, sem
 * galeria, sem distração. O silêncio visual comunica que este momento é sério.
 *
 * ⚠️ O FORMULÁRIO NÃO É TOCADO. `FormsContent` é exatamente o mesmo componente
 * servido em /forms — ele alimenta `form_submissions`, que dispara a
 * qualificação Gemini, a criação do atleta/deal no CRM e a régua de WhatsApp.
 * Alterar seus campos quebraria a classificação QUENTE/MORNO/FRIO.
 *
 * /forms permanece vivo como alias: o gerador de UTM do Engine monta
 * `${baseUrl}/forms`, e há links curtos e anúncios já veiculados apontando
 * para lá. Um redirect custaria um salto em 100% do tráfego pago.
 */
export default async function EvaluationPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("site");
  const copy = t.raw("evaluation") as EvaluationCopy;

  return (
    <>
      <Section tone="deep" space="tight" className="pt-[calc(var(--bau-header-h)+4rem)]">
        <div className="mx-auto max-w-[560px]">
          <Reveal>
            <Eyebrow>{copy.hero.eyebrow}</Eyebrow>
          </Reveal>
          <Reveal delay={0.12}>
            <h1 className="bau-display mt-8 text-[2rem] sm:text-[2.75rem]">{copy.hero.title}</h1>
          </Reveal>
          <Reveal delay={0.24}>
            <p className="mt-8 text-[17px] leading-relaxed text-bau-stone">{copy.hero.sub}</p>
          </Reveal>

          <Reveal delay={0.32} className="mt-16">
            <Eyebrow>{copy.afterSubmit.eyebrow}</Eyebrow>
            <ol className="mt-8 space-y-6">
              {copy.afterSubmit.steps.map((step, i) => (
                <li key={step} className="flex gap-5 border-t border-[var(--bau-hairline)] pt-6">
                  <span aria-hidden="true" className="bau-mono shrink-0 text-[12px] text-bau-gold">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <p className="text-[16px] leading-relaxed text-bau-stone">{step}</p>
                </li>
              ))}
            </ol>

            <p className="bau-signature mt-12 text-[1.25rem] text-bau-ivory/80">
              {copy.afterSubmit.highlight}
            </p>
          </Reveal>
        </div>
      </Section>

      <FormsContent />
    </>
  );
}

interface EvaluationCopy {
  hero: { eyebrow: string; title: string; sub: string };
  afterSubmit: { eyebrow: string; steps: string[]; highlight: string };
}
