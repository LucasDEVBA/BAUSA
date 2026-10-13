"use client";

import { useId, useState } from "react";
import { Plus } from "lucide-react";

import BrandCta from "@/components/brand/BrandCta";
import MeshBackground from "@/components/brand/MeshBackground";
import { useLanguage } from "@/i18n";
import { FAQ_COPY, FAQ_ITEMS } from "@/content/metodo";
import { pick } from "@/content/types";
import { MethodVideoChip } from "./MethodVideoChip";

const delay = (d: number) => ({ "--d": d }) as React.CSSProperties;

/**
 * Perguntas frequentes visíveis (as mesmas do JSON-LD FAQPage da página). Acordeão
 * acessível: cada pergunta é um botão com aria-expanded/aria-controls; a resposta
 * fechada continua no HTML (indexável) mas fica inert, então o Tab não entra nela.
 */
export default function MethodFaq() {
  const { lang } = useLanguage();
  const baseId = useId();
  // A primeira aberta mostra o formato (resposta + vídeo) sem exigir um toque
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set([FAQ_ITEMS[0].key]));

  const toggle = (key: string) =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    // overflow-clip (não hidden): hidden cria um contêiner de rolagem e quebra o sticky do cabeçalho
    <section className="relative isolate overflow-hidden py-[clamp(72px,9vw,128px)] supports-[overflow:clip]:overflow-clip" aria-labelledby="faq-title">
      <MeshBackground blobs={["b1", "b4"]} className="[&_.ba-b1]:!left-[-22vw] [&_.ba-b1]:!top-[-10%] [&_.ba-b1]:!opacity-55 [&_.ba-b4]:!left-auto [&_.ba-b4]:!right-[-12vw]" />

      <div className="ba-wrap relative z-[2] grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-[clamp(40px,4vw,64px)]">
        <header className="lg:sticky lg:top-28 lg:col-span-5 lg:self-start">
          <span className="ba-eyebrow ba-glass ba-rv" style={delay(0)}>
            <span className="ba-dot" />
            {pick(FAQ_COPY.eyebrow, lang)}
          </span>
          <h2 id="faq-title" className="ba-h2 ba-rv mt-6 text-[var(--ba-navy)]" style={delay(1)}>
            {pick(FAQ_COPY.titleBefore, lang)} <span className="ba-serif ba-grad-text text-[1.12em]">{pick(FAQ_COPY.titleAccent, lang)}</span>
          </h2>
          <p className="ba-lead ba-rv mt-5 max-w-[460px]" style={delay(2)}>
            {pick(FAQ_COPY.lead, lang)}
          </p>
        </header>

        <div className="ba-glass ba-rv rounded-[26px] px-1.5 py-1.5 sm:rounded-[30px] sm:px-2 sm:py-2 lg:col-span-7" style={delay(2)}>
          <ul role="list" className="divide-y divide-[var(--ba-stroke)]">
            {FAQ_ITEMS.map((item, index) => {
              const isOpen = open.has(item.key);
              const buttonId = `${baseId}-q-${item.key}`;
              const panelId = `${baseId}-a-${item.key}`;
              return (
                <li key={item.key}>
                  <h3 className="m-0">
                    <button
                      id={buttonId}
                      type="button"
                      aria-expanded={isOpen}
                      aria-controls={panelId}
                      onClick={() => toggle(item.key)}
                      className="group flex min-h-[64px] w-full items-center gap-4 rounded-[20px] px-4 py-4 text-left transition-colors duration-300 hover:bg-white/60 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--ba-blue-2)] sm:gap-5 sm:px-5 sm:py-5"
                    >
                      <span className="hidden w-7 flex-none font-[family-name:var(--ba-display)] text-[13px] font-bold text-[var(--ba-ink-3)] sm:block" aria-hidden="true">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="flex-1 font-[family-name:var(--ba-display)] text-[16.5px] font-semibold leading-[1.3] tracking-[-0.02em] text-[var(--ba-navy)] sm:text-[18px]">
                        {pick(item.question, lang)}
                      </span>
                      <span
                        aria-hidden="true"
                        className={`grid h-9 w-9 flex-none place-items-center rounded-full transition-[transform,background-color,color] duration-500 [transition-timing-function:var(--ba-ease)] ${
                          isOpen
                            ? "rotate-45 bg-[linear-gradient(150deg,#3d61c8,var(--ba-blue))] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]"
                            : "bg-[rgba(31,63,163,0.07)] text-[var(--ba-blue)] shadow-[inset_0_0_0_1px_rgba(31,63,163,0.1)] group-hover:bg-[rgba(31,63,163,0.12)]"
                        }`}
                      >
                        <Plus className="h-[18px] w-[18px]" />
                      </span>
                    </button>
                  </h3>
                  {/* grid-rows 0fr→1fr anima a altura real sem medir o DOM */}
                  {/* Sem role="region": com 8 painéis abertos ao mesmo tempo viraria uma enxurrada de landmarks */}
                  <div
                    id={panelId}
                    inert={!isOpen}
                    className={`grid transition-[grid-template-rows,opacity] duration-500 [transition-timing-function:var(--ba-ease)] ${isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
                  >
                    <div className="min-h-0 overflow-hidden">
                      <div className="px-4 pb-5 sm:pl-[68px] sm:pr-16 sm:pb-6">
                        <p className="m-0 text-[15.5px] leading-[1.62] text-[var(--ba-ink-2)]">{pick(item.answer, lang)}</p>
                        {item.video && (
                          <div className="mt-4 flex flex-wrap items-center gap-3">
                            <span className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--ba-ink-3)]">{pick(FAQ_COPY.watchAnswer, lang)}</span>
                            <MethodVideoChip chip={item.video} />
                          </div>
                        )}
                        {item.cta && (
                          <BrandCta source="metodo" className="mt-5 max-sm:w-full">
                            {pick(FAQ_COPY.cta, lang)}
                          </BrandCta>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
