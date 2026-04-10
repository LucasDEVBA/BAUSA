"use client";

import { useEffect, useState } from "react";

const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID;

function hasConsent(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("bau_cookie_consent") === "granted";
}

export function GoogleTagManager() {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!GTM_ID || loaded) return;

    function injectGTM() {
      if (loaded) return;

      // Initialize dataLayer
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({
        "gtm.start": new Date().getTime(),
        event: "gtm.js",
      });

      // Inject GTM script
      const script = document.createElement("script");
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtm.js?id=${GTM_ID}`;
      document.head.appendChild(script);

      // Inject noscript iframe
      const noscript = document.createElement("noscript");
      const iframe = document.createElement("iframe");
      iframe.src = `https://www.googletagmanager.com/ns.html?id=${GTM_ID}`;
      iframe.height = "0";
      iframe.width = "0";
      iframe.style.display = "none";
      iframe.style.visibility = "hidden";
      noscript.appendChild(iframe);
      document.body.insertBefore(noscript, document.body.firstChild);

      setLoaded(true);
    }

    // If consent already granted (returning user), inject immediately
    if (hasConsent()) {
      injectGTM();
      return;
    }

    // Listen for consent event
    function onConsent() {
      injectGTM();
      window.removeEventListener("consent-granted", onConsent);
    }

    window.addEventListener("consent-granted", onConsent);
    return () => window.removeEventListener("consent-granted", onConsent);
  }, [loaded]);

  return null;
}
