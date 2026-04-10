"use client";

import { useState, useEffect } from "react";
import { useLanguage } from "@/i18n";

const CONSENT_KEY = "bau_cookie_consent";

const TEXTS = {
  pt: {
    message:
      "Usamos cookies para melhorar sua experiência e medir o desempenho do site. Ao aceitar, você concorda com o uso de cookies analíticos conforme a LGPD.",
    accept: "Aceitar",
    reject: "Recusar",
    privacy: "Política de Privacidade",
  },
  en: {
    message:
      "We use cookies to improve your experience and measure site performance. By accepting, you agree to the use of analytical cookies.",
    accept: "Accept",
    reject: "Decline",
    privacy: "Privacy Policy",
  },
  es: {
    message:
      "Usamos cookies para mejorar su experiencia y medir el rendimiento del sitio. Al aceptar, usted acepta el uso de cookies analíticas.",
    accept: "Aceptar",
    reject: "Rechazar",
    privacy: "Política de Privacidad",
  },
};

export function CookieConsent() {
  const { lang } = useLanguage();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem(CONSENT_KEY);
    if (!consent) {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  const t = TEXTS[lang as keyof typeof TEXTS] || TEXTS.pt;

  function handleAccept() {
    localStorage.setItem(CONSENT_KEY, "granted");
    window.dispatchEvent(new Event("consent-granted"));
    setVisible(false);
  }

  function handleReject() {
    localStorage.setItem(CONSENT_KEY, "denied");
    setVisible(false);
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[9999] border-t border-white/10 bg-[#0c1527]/95 px-4 py-4 backdrop-blur-md sm:px-6">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <p className="flex-1 text-xs leading-relaxed text-zinc-300 sm:text-sm">
          {t.message}
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={handleReject}
            className="rounded-lg border border-white/10 px-4 py-2 text-xs font-medium text-zinc-400 transition-colors hover:border-white/20 hover:text-zinc-200 sm:text-sm"
          >
            {t.reject}
          </button>
          <button
            onClick={handleAccept}
            className="rounded-lg bg-gradient-to-r from-[#8e1824] to-[#1A365D] px-5 py-2 text-xs font-semibold text-white shadow-lg transition-all hover:shadow-[#8e1824]/20 sm:text-sm"
          >
            {t.accept}
          </button>
        </div>
      </div>
    </div>
  );
}
