"use client";

import { motion } from "framer-motion";
import { MessageCircle, ClipboardCheck, ArrowRight } from "lucide-react";

interface EntryScreenProps {
  onEnterPortal: () => void;
}

const EntryScreen = ({ onEnterPortal }: EntryScreenProps) => {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center px-4 py-12 overflow-hidden">
      {/* Background Glow Effects */}
      <div className="glow-orb w-96 h-96 -top-48 -left-48 animate-glow-pulse" />
      <div className="glow-orb w-80 h-80 -bottom-40 -right-40 animate-glow-pulse" style={{ animationDelay: "1.5s" }} />

      {/* Subtle Grid Pattern */}
      <div
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `linear-gradient(hsl(var(--foreground)) 1px, transparent 1px),
                           linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)`,
          backgroundSize: '60px 60px'
        }}
      />

      <div className="relative z-10 flex flex-col items-center max-w-2xl mx-auto text-center">
        {/* Premium Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="premium-badge mb-8"
        >
          <span className="w-2 h-2 rounded-full bg-burgundy animate-pulse" />
          <span className="text-muted-foreground">Educação Esportiva Inteligente®</span>
        </motion.div>

        {/* Logo / Brand */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mb-6"
        >
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight">
            <span className="text-foreground">Bolsa Atleta</span>
            <span className="text-gradient ml-3">USA</span>
          </h1>
        </motion.div>

        {/* Tagline */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-lg md:text-xl text-muted-foreground mb-12 max-w-lg"
        >
          Estratégia de elite para atletas brasileiros conquistarem bolsas nas melhores universidades americanas.
        </motion.p>

        {/* Hero CTA Button */}
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          onClick={onEnterPortal}
          className="btn-hero group flex items-center gap-3 text-white mb-16"
        >
          <span>Acessar Portal Oficial & Estratégia</span>
          <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
        </motion.button>

        {/* Action Cards */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-xl"
        >
          {/* WhatsApp Card */}
          <a
            href="https://wa.me/+12233508213"
            target="_blank"
            rel="noopener noreferrer"
            className="action-card flex items-center gap-4"
          >
            <div className="w-12 h-12 rounded-xl bg-burgundy/20 flex items-center justify-center flex-shrink-0">
              <MessageCircle className="w-6 h-6 text-burgundy" />
            </div>
            <div className="text-left">
              <h3 className="font-semibold text-foreground">Falar com Assessor de Elite</h3>
              <p className="text-sm text-muted-foreground">Atendimento personalizado</p>
            </div>
          </a>

          {/* Application Card */}
          <a
            href="https://form.typeform.com/to/example"
            target="_blank"
            rel="noopener noreferrer"
            className="action-card flex items-center gap-4"
          >
            <div className="w-12 h-12 rounded-xl bg-burgundy/20 flex items-center justify-center flex-shrink-0">
              <ClipboardCheck className="w-6 h-6 text-burgundy" />
            </div>
            <div className="text-left">
              <h3 className="font-semibold text-foreground">Aplicar Agora (Seleção)</h3>
              <p className="text-sm text-muted-foreground">Processo seletivo exclusivo</p>
            </div>
          </a>
        </motion.div>

        {/* Trust Indicators */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="mt-16 flex flex-wrap items-center justify-center gap-8 text-sm text-muted-foreground"
        >
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>+200 atletas colocados</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>$50M+ em bolsas</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>Top 100 universidades</span>
          </div>
        </motion.div>
      </div>

      {/* Scroll Indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1, duration: 0.5 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
      >
        <div className="w-6 h-10 rounded-full border-2 border-muted-foreground/30 flex items-start justify-center p-2">
          <motion.div
            animate={{ y: [0, 12, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50"
          />
        </div>
      </motion.div>
    </section>
  );
};

export default EntryScreen;
