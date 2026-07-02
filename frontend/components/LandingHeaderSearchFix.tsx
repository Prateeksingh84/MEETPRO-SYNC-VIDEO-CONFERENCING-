"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

function cleanText(value: string | null | undefined) {
  return (value || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function isHeaderRoot(element: HTMLElement) {
  return Boolean(
    element.matches("header,nav,.ms-nav,.ms-home-nav,.ms-landing-nav,.home-nav,.site-nav") ||
      element.closest("header,nav,.ms-nav,.ms-home-nav,.ms-landing-nav,.home-nav,.site-nav"),
  );
}

function hideElement(element: HTMLElement | null) {
  if (!element) return;
  element.classList.add("ms-hidden-header-control");
  element.style.display = "none";
}

export function LandingHeaderSearchFix() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== "/") return;

    function patchLandingHeader() {
      const headers = Array.from(
        document.querySelectorAll<HTMLElement>(
          "header,nav,.ms-nav,.ms-home-nav,.ms-landing-nav,.home-nav,.site-nav,.nav-workspace",
        ),
      );

      headers.forEach((header) => {
        const controls = Array.from(header.querySelectorAll<HTMLElement>("a,button,span,div"));

        controls.forEach((control) => {
          const clickable = (control.closest("a,button") as HTMLElement | null) || control;
          const text = cleanText(clickable.textContent);
          const label = cleanText(
            clickable.getAttribute("aria-label") ||
              clickable.getAttribute("title") ||
              clickable.getAttribute("data-label") ||
              clickable.getAttribute("id") ||
              clickable.getAttribute("class") ||
              "",
          );
          const href = clickable.getAttribute("href") || "";

          const isSearchControl =
            label.includes("search") ||
            text === "search" ||
            text === "⌕" ||
            text === "🔍" ||
            text === "º" ||
            text === "o" ||
            (href === "/products" && text.length <= 3);

          const isDotsOrMore =
            label.includes("more") ||
            label.includes("waffle") ||
            label.includes("grid") ||
            text === "⋮" ||
            text === "⋯" ||
            text === "⁝" ||
            text === "..." ||
            text === "•••" ||
            text === "···";

          const isOldAvatar = text === "ms";

          if (isHeaderRoot(clickable) && (isSearchControl || isDotsOrMore || isOldAvatar)) {
            hideElement(clickable);
          }
        });

        const whatsNew = Array.from(header.querySelectorAll<HTMLElement>("a,button")).find((item) => {
          return cleanText(item.textContent) === "what's new";
        });

        if (whatsNew && !header.querySelector(".ms-dom-signup-fix")) {
          const signup = document.createElement("a");
          signup.href = "/auth";
          signup.textContent = "Sign Up";
          signup.className = "ms-dom-signup-fix";
          signup.setAttribute("aria-label", "Sign up for MeetSyncPro");
          whatsNew.insertAdjacentElement("afterend", signup);
        }

        const signupButton = header.querySelector<HTMLElement>(".ms-dom-signup-fix");

        if (signupButton) {
          let sibling = signupButton.nextElementSibling as HTMLElement | null;

          while (sibling) {
            const text = cleanText(sibling.textContent);
            const label = cleanText(
              sibling.getAttribute("aria-label") ||
                sibling.getAttribute("title") ||
                sibling.getAttribute("class") ||
                "",
            );

            if (
              text === "ms" ||
              text === "⋮" ||
              text === "⋯" ||
              text === "⁝" ||
              text === "..." ||
              text === "•••" ||
              text === "···" ||
              label.includes("more") ||
              label.includes("waffle") ||
              label.includes("grid") ||
              label.includes("search")
            ) {
              hideElement(sibling);
            }

            sibling = sibling.nextElementSibling as HTMLElement | null;
          }
        }

        Array.from(header.querySelectorAll<HTMLElement>("a,div,span,strong")).forEach((item) => {
          if (cleanText(item.textContent) === "meetsync") {
            item.textContent = "meetsyncpro";
          }
        });
      });

      const bannerCandidates = Array.from(document.querySelectorAll<HTMLElement>("a,section,div"));

      bannerCandidates.forEach((element) => {
        const text = cleanText(element.textContent);
        const className = cleanText(element.getAttribute("class"));

        const isMeetSyncProBanner =
          text.includes("introducing MeetSyncPro") ||
          text.includes("") ||
          text.includes("MeetSyncPro, your ai teammate");

        const looksLikeBanner =
          className.includes("alert") ||
          className.includes("banner") ||
          className.includes("announcement") ||
          element.getBoundingClientRect().height <= 130;

        if (isMeetSyncProBanner && looksLikeBanner) {
          hideElement(element);
        }
      });
    }

    patchLandingHeader();

    const observer = new MutationObserver(patchLandingHeader);

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "style", "href", "aria-label", "title"],
    });

    return () => observer.disconnect();
  }, [pathname]);

  return null;
}

