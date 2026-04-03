"use client";

import { Target, TrendingUp, Brain, Zap } from "lucide-react";
import { useScrollReveal, revealClass } from "@/hooks/useScrollReveal";

const pillars = [
  {
    icon: Target,
    title: "Visão Estratégica",
    description: "Mapeamento completo do seu perfil atlético e acadêmico para identificar as universidades com maior probabilidade de sucesso.",
  },
  {
    icon: TrendingUp,
    title: "Alta Performance",
    description: "Metodologia comprovada que já colocou mais de 200 atletas em universidades de elite nos Estados Unidos.",
  },
  {
    icon: Brain,
    title: "Growth Mindset",
    description: "Preparação mental e estratégica para você se destacar no competitivo processo de recrutamento universitário.",
  },
  {
    icon: Zap,
    title: "Execução Precisa",
    description: "Acompanhamento passo a passo desde a primeira reunião até sua chegada no campus americano.",
  },
];

const ValueProposition = () => {
  const header = useScrollReveal();
  const cards = useScrollReveal();
  const stats = useScrollReveal();

  return (
    <section className="py-24 relative overflow-hidden">
      {/* Background Elements */}
      <div className="glow-orb w-[600px] h-[600px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />

      <div className="container mx-auto px-4 relative z-10">
        {/* Main Headline */}
        <div
          ref={header.ref}
          className={`${revealClass(header.isRevealed)} max-w-4xl mx-auto text-center mb-20`}
        >
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6">
            Não é apenas intercâmbio.
            <br />
            <span className="text-gradient">É Estratégia de Carreira.</span>
          </h2>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
            Transformamos atletas brasileiros em candidatos de elite para as melhores
            universidades americanas. Seu talento merece o palco certo.
          </p>
        </div>

        {/* Pillar Cards - Bento Grid Style */}
        <div
          ref={cards.ref}
          className={`${revealClass(cards.isRevealed)} grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto`}
        >
          {pillars.map((pillar, index) => (
            <div
              key={pillar.title}
              className={`glass-card p-8 group hover:border-burgundy/30 transition-all duration-500 scroll-delay-${Math.min(index + 1, 4)}`}
            >
              <div className="w-14 h-14 rounded-2xl bg-burgundy/10 flex items-center justify-center mb-6 group-hover:bg-burgundy/20 transition-colors">
                <pillar.icon className="w-7 h-7 text-burgundy" />
              </div>
              <h3 className="text-2xl font-bold mb-3">{pillar.title}</h3>
              <p className="text-muted-foreground leading-relaxed">{pillar.description}</p>
            </div>
          ))}
        </div>

        {/* Stats Section */}
        <div
          ref={stats.ref}
          className={`${revealClass(stats.isRevealed)} mt-20 grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto`}
        >
          {[
            { value: "200+", label: "Atletas Colocados" },
            { value: "$50M+", label: "Em Bolsas Conquistadas" },
            { value: "95%", label: "Taxa de Sucesso" },
            { value: "15+", label: "Anos de Experiência" },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-gradient mb-2">
                {stat.value}
              </div>
              <div className="text-sm text-muted-foreground">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ValueProposition;
