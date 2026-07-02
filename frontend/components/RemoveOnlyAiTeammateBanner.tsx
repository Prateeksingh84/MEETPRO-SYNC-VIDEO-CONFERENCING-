"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

function normalizeText(value: string | null | undefined) {
  return (value || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function hideOnlyTargetBanner() {
  const allElements = Array.from(document.querySelectorAll<HTMLElement>("a, div, section"));

  const candidates = allElements.filter((element) => {
    const text = normalizeText(element.textContent);
    const rect = element.getBoundingClientRect();

    const hasTargetText =
      text.includes("introducing meetsyncmate") ||
      text.includes("explore meetsyncmate") ||
      text.includes("meetsyncmate, your ai teammate");

    const isTopBanner =
      rect.top >= 70 &&
      rect.top <= 210 &&
      rect.height >= 35 &&
      rect.height <= 120 &&
      rect.width >= window.innerWidth * 0.5;

    return hasTargetText && isTopBanner;
  });

  candidates
    .sort((a, b) => {
      const areaA = a.getBoundingClientRect().width * a.getBoundingClientRect().height;
      const areaB = b.getBoundingClientRect().width * b.getBoundingClientRect().height;
      return areaA - areaB;
    })
    .forEach((element) => {
      element.style.display = "none";
      element.style.visibility = "hidden";
      element.style.pointerEvents = "none";
      element.setAttribute("aria-hidden", "true");
    });
}

export function RemoveOnlyAiTeammateBanner() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== "/") return;

    hideOnlyTargetBanner();

    const timers = [
      window.setTimeout(hideOnlyTargetBanner, 200),
      window.setTimeout(hideOnlyTargetBanner, 700),
      window.setTimeout(hideOnlyTargetBanner, 1500),
      window.setTimeout(hideOnlyTargetBanner, 3000),
    ];

    const observer = new MutationObserver(() => hideOnlyTargetBanner());

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    const stopObserver = window.setTimeout(() => observer.disconnect(), 5000);

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      window.clearTimeout(stopObserver);
      observer.disconnect();
    };
  }, [pathname]);

  return null;
}
