"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Globe } from "lucide-react";

import { useLanguage, type Lang } from "@/i18n";

type Language = {
  code: Lang;
  name: string;
  flag: string;
};

const languages: Language[] = [
  { code: "pt", name: "PT", flag: "🇧🇷" },
  { code: "en", name: "EN", flag: "🇺🇸" },
  { code: "es", name: "ES", flag: "🇪🇸" },
];

interface LanguageSelectorProps {
  variant?: "light" | "dark";
  size?: "default" | "lg";
}

const LanguageSelector = ({ variant = "light", size = "default" }: LanguageSelectorProps) => {
  const { lang, setLang } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);

  const isLarge = size === "lg";
  const isDark = variant === "dark";

  const selectedLanguage = languages.find((l) => l.code === lang) ?? languages[0];

  const handleSelect = (language: Language) => {
    setLang(language.code);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 ${isLarge ? "px-3 py-2" : "px-2 py-1.5"} rounded-full transition-all duration-200 ${
          isDark ? "hover:bg-white/10" : "hover:bg-black/5"
        }`}
        aria-label="Selecionar idioma"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <Globe
          className={`${isLarge ? "w-5 h-5" : "w-4 h-4"} ${isDark ? "text-white/80" : "text-muted-foreground"}`}
        />
        <span
          className={`${isLarge ? "text-sm" : "text-xs"} font-medium ${isDark ? "text-white/80" : "text-muted-foreground"}`}
        >
          {selectedLanguage.flag}
        </span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
              aria-hidden="true"
            />

            {/* Dropdown */}
            <motion.div
              role="listbox"
              aria-label="Idioma"
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.12 }}
              className={`absolute right-0 top-full mt-1 z-50 rounded-lg overflow-hidden shadow-lg ${
                isDark
                  ? "bg-[hsl(222_70%_15%)] border border-white/15"
                  : "bg-white border border-[hsl(var(--border))]"
              }`}
            >
              {languages.map((language) => (
                <button
                  key={language.code}
                  role="option"
                  aria-selected={selectedLanguage.code === language.code}
                  onClick={() => handleSelect(language)}
                  className={`w-full flex items-center gap-2 px-3 py-2 transition-colors min-h-[44px] ${
                    selectedLanguage.code === language.code
                      ? isDark
                        ? "bg-white/10"
                        : "bg-[hsl(var(--muted))]"
                      : isDark
                        ? "hover:bg-white/5"
                        : "hover:bg-[hsl(var(--muted))]/50"
                  }`}
                >
                  <span className="text-base">{language.flag}</span>
                  <span
                    className={`text-xs font-medium ${isDark ? "text-white/80" : "text-foreground"}`}
                  >
                    {language.name}
                  </span>
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LanguageSelector;
