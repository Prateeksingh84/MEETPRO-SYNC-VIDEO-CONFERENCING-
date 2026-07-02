"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

function cleanText(value: string | null | undefined) {
  return (value || "").replace(/\s+/g, " ").trim().toLowerCase();
}

export function LandingHeaderSearchFix() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== "/") return;

    function cleanupHeaderOnly() {
      const header =
        document.querySelector<HTMLElement>("header") ||
        document.querySelector<HTMLElement>("nav");

      if (!header) return;

      const controls = Array.from(header.querySelectorAll<HTMLElement>("a,button"));

      controls.forEach((control) => {
        const text = cleanText(control.textContent);
        const label = cleanText(
          control.getAttribute("aria-label") ||
            control.getAttribute("title") ||
            control.getAttribute("class") ||
            control.getAttribute("id") ||
            "",
        );

        const isSearchIcon =
          label.includes("search") ||
          text === "⌕" ||
          text === "🔍" ||
          text === "º";

        const isDotsIcon =
          label.includes("more") ||
          label.includes("waffle") ||
          label.includes("grid") ||
          text === "⋮" ||
          text === "⋯" ||
          text === "⁝" ||
          text === "..." ||
          text === "•••" ||
          text === "···";

        const isMSAvatar = text === "ms";

        if (isSearchIcon || isDotsIcon || isMSAvatar) {
          control.classList.add("ms-hidden-header-control");
          control.setAttribute("aria-hidden", "true");
        }
      });

      const existingSignup = header.querySelector(".ms-dom-signup-fix");
      const whatsNew = controls.find((item) => cleanText(item.textContent) === "what's new");

      if (whatsNew && !existingSignup) {
        const signup = document.createElement("a");
        signup.href = "/auth";
        signup.textContent = "Sign Up";
        signup.className = "ms-dom-signup-fix";
        signup.setAttribute("aria-label", "Sign up for MeetSyncPro");
        whatsNew.insertAdjacentElement("afterend", signup);
      }
    }

    cleanupHeaderOnly();

    const t1 = window.setTimeout(cleanupHeaderOnly, 300);
    const t2 = window.setTimeout(cleanupHeaderOnly, 1000);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [pathname]);

  return null;
}
