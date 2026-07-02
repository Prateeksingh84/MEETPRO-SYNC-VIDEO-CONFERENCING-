"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

function textOf(element: Element | null) {
  return (element?.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
}

export function LandingHeaderSearchFix() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== "/") return;

    function safeHeaderCleanup() {
      const header =
        document.querySelector<HTMLElement>("header") ||
        document.querySelector<HTMLElement>("nav");

      if (!header) return;

      const clickables = Array.from(header.querySelectorAll<HTMLElement>("a,button"));

      clickables.forEach((item) => {
        const text = textOf(item);
        const aria = (
          item.getAttribute("aria-label") ||
          item.getAttribute("title") ||
          item.getAttribute("class") ||
          ""
        ).toLowerCase();

        const isSearchIcon =
          aria.includes("search") ||
          text === "⌕" ||
          text === "🔍" ||
          text === "º";

        const isDotsIcon =
          aria.includes("more") ||
          aria.includes("waffle") ||
          aria.includes("grid") ||
          text === "⋮" ||
          text === "⋯" ||
          text === "⁝" ||
          text === "..." ||
          text === "•••" ||
          text === "···";

        const isMSAvatar = text === "ms";

        if (isSearchIcon || isDotsIcon || isMSAvatar) {
          item.style.display = "none";
          item.setAttribute("aria-hidden", "true");
        }
      });

      const existingSignup = header.querySelector(".ms-dom-signup-fix");
      const whatsNew = clickables.find((item) => textOf(item) === "what's new");

      if (whatsNew && !existingSignup) {
        const signup = document.createElement("a");
        signup.href = "/auth";
        signup.textContent = "Sign Up";
        signup.className = "ms-dom-signup-fix";
        signup.setAttribute("aria-label", "Sign up for MeetSyncPro");
        whatsNew.insertAdjacentElement("afterend", signup);
      }

      document.querySelectorAll<HTMLElement>("a,div,section,span").forEach((element) => {
        const text = textOf(element);
        const height = element.getBoundingClientRect().height;

        if (
          height <= 130 &&
          (text.includes("introducing meetsyncmate") ||
            text.includes("explore meetsyncmate") ||
            text.includes("introducing meetsyncpro, your ai teammate") ||
            text.includes("explore meetsyncpro"))
        ) {
          element.style.display = "none";
          element.setAttribute("aria-hidden", "true");
        }
      });
    }

    const t1 = window.setTimeout(safeHeaderCleanup, 100);
    const t2 = window.setTimeout(safeHeaderCleanup, 800);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [pathname]);

  return null;
}
