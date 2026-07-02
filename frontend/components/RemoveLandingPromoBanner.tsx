"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

export function RemoveLandingPromoBanner() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== "/") return;

    function removeEmptyPromoBanner() {
      const elements = Array.from(document.querySelectorAll<HTMLElement>("a, section, div"));

      elements.forEach((element) => {
        const rect = element.getBoundingClientRect();
        const text = (element.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
        const className = (element.getAttribute("class") || "").toLowerCase();

        const isTopLandingBanner =
          rect.top >= 80 &&
          rect.top <= 220 &&
          rect.width >= window.innerWidth * 0.65 &&
          rect.height >= 45 &&
          rect.height <= 120;

        const hasCloseButton =
          text.includes("×") ||
          text.includes("✕") ||
          Boolean(element.querySelector('button[aria-label*="close" i], [class*="close" i]'));

        const looksLikeOldAiBanner =
          className.includes("alert") ||
          className.includes("banner") ||
          className.includes("promo") ||
          className.includes("announcement") ||
          hasCloseButton;

        const hasOldMeetSyncMateText =
          text.includes("meetsyncmate") ||
          text.includes("ai teammate") ||
          text.includes("explore meetsyncpro") ||
          text.includes("introducing meetsyncpro");

        if ((isTopLandingBanner && hasCloseButton && looksLikeOldAiBanner) || hasOldMeetSyncMateText) {
          element.style.display = "none";
          element.style.visibility = "hidden";
          element.style.pointerEvents = "none";
          element.setAttribute("aria-hidden", "true");
        }
      });
    }

    removeEmptyPromoBanner();

    const t1 = window.setTimeout(removeEmptyPromoBanner, 300);
    const t2 = window.setTimeout(removeEmptyPromoBanner, 1000);
    const t3 = window.setTimeout(removeEmptyPromoBanner, 2000);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [pathname]);

  return null;
}
