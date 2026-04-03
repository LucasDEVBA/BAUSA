"use client";

import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/navigation";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 relative overflow-hidden">
      <div className="glow-orb w-96 h-96 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center relative z-10"
      >
        <h1 className="text-8xl font-bold text-gradient mb-4">404</h1>
        <p className="text-xl text-muted-foreground mb-8">
          Página não encontrada
        </p>
        <Link href="/" className="btn-hero inline-flex items-center gap-2 text-white">
          <ArrowLeft className="w-5 h-5" />
          <span>Voltar ao Início</span>
        </Link>
      </motion.div>
    </div>
  );
}
