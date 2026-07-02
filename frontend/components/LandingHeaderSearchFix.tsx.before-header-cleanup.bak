"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

const searchIndex = [
  {
    title: "Products",
    description: "Explore MeetSync Pro meetings, chat, whiteboards, recordings, and AI workspace.",
    href: "/products",
    keywords: "products meeting chat whiteboard recording workspace",
  },
  {
    title: "Join a meeting",
    description: "Join a MeetSync Pro meeting using a shared meeting link.",
    href: "/join",
    keywords: "join meeting link invite call room",
  },
  {
    title: "Dashboard",
    description: "Create instant meetings, manage workspace activity, and open meeting rooms.",
    href: "/dashboard",
    keywords: "dashboard create meeting instant meeting manage",
  },
  {
    title: "Team Chat",
    description: "Open real-time team chat and start live huddles.",
    href: "/team-chat",
    keywords: "team chat workspace huddle realtime message",
  },
  {
    title: "Whiteboards",
    description: "Collaborate visually with real-time whiteboards.",
    href: "/whiteboards",
    keywords: "whiteboard canvas drawing brainstorm",
  },
  {
    title: "Enterprise",
    description: "Enterprise-ready collaboration, scaling, Redis, privacy, and deployment architecture.",
    href: "/enterprise",
    keywords: "enterprise scale redis crore production architecture",
  },
  {
    title: "Security",
    description: "Security, privacy, CORS, protected environment variables, and safe collaboration controls.",
    href: "/security",
    keywords: "security privacy cors encryption data protection",
  },
  {
    title: "Privacy",
    description: "Cookie preferences, privacy choices, user consent, and data handling.",
    href: "/privacy",
    keywords: "privacy cookies consent data",
  },
  {
    title: "Sign up",
    description: "Create a MeetSync Pro account.",
    href: "/auth",
    keywords: "signup sign up login account auth register",
  },
];

function normalize(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

export function LandingHeaderSearchFix() {
  const pathname = usePathname();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  const results = useMemo(() => {
    const clean = normalize(query);

    if (!clean) return searchIndex;

    return searchIndex.filter((item) => {
      const haystack = normalize(`${item.title} ${item.description} ${item.keywords}`);
      return haystack.includes(clean);
    });
  }, [query]);

  useEffect(() => {
    if (pathname !== "/") return;

    function isSearchTrigger(target: EventTarget | null) {
      const element = (target as HTMLElement | null)?.closest("a,button") as HTMLElement | null;
      if (!element) return false;

      const nav = element.closest("header,nav,.ms-nav,.ms-home-nav,.ms-landing-nav,.home-nav,.site-nav");
      if (!nav) return false;

      const text = normalize(element.textContent || "");
      const label = normalize(
        element.getAttribute("aria-label") ||
          element.getAttribute("title") ||
          element.getAttribute("data-label") ||
          "",
      );
      const href = element.getAttribute("href") || "";

      const isActualProductsLink = text.includes("products");
      const looksLikeSearch =
        label.includes("search") ||
        text === "⌕" ||
        text === "🔍" ||
        text === "search" ||
        (href === "/products" && !isActualProductsLink && text.length <= 3);

      return looksLikeSearch;
    }

    function onDocumentClick(event: MouseEvent) {
      if (!isSearchTrigger(event.target)) return;

      event.preventDefault();
      event.stopPropagation();
      setOpen(true);
    }

    document.addEventListener("click", onDocumentClick, true);

    return () => document.removeEventListener("click", onDocumentClick, true);
  }, [pathname]);

  useEffect(() => {
    if (pathname !== "/") return;

    function patchHeader() {
      const navs = Array.from(
        document.querySelectorAll<HTMLElement>("header,nav,.ms-nav,.ms-home-nav,.ms-landing-nav,.home-nav,.site-nav"),
      );

      navs.forEach((nav) => {
        const controls = Array.from(nav.querySelectorAll<HTMLElement>("a,button,span,div"));

        controls.forEach((control) => {
          const text = (control.textContent || "").replace(/\s+/g, " ").trim();
          const clickable = control.closest("a,button") as HTMLElement | null;
          const target = clickable || control;

          if (text === "MS") {
            target.classList.add("ms-hidden-header-control");
          }

          if (
            text === "⋮" ||
            text === "⋯" ||
            text === "⁝" ||
            text === "..." ||
            text === "•••" ||
            text === "···"
          ) {
            target.classList.add("ms-hidden-header-control");
          }
        });

        const whatsNew = controls.find((control) => {
          return (control.textContent || "").replace(/\s+/g, " ").trim().toLowerCase() === "what's new";
        });

        const whatsNewButton = whatsNew?.closest("a,button") as HTMLElement | null;

        if (whatsNewButton && !nav.querySelector(".ms-dom-signup-fix")) {
          const signup = document.createElement("a");
          signup.href = "/auth";
          signup.textContent = "Sign Up";
          signup.className = "ms-dom-signup-fix";
          signup.setAttribute("aria-label", "Sign up for MeetSync Pro");

          whatsNewButton.insertAdjacentElement("afterend", signup);
        }
      });
    }

    patchHeader();

    const observer = new MutationObserver(patchHeader);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, [pathname]);

  useEffect(() => {
    if (!open) return;

    const timer = window.setTimeout(() => inputRef.current?.focus(), 50);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  if (pathname !== "/") return null;

  function openResult(href: string) {
    setOpen(false);
    setQuery("");
    router.push(href);
  }

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const first = results[0];

    if (first) {
      openResult(first.href);
    }
  }

  return (
    <>
      {open && (
        <div className="ms-search-modal-backdrop" role="dialog" aria-modal="true">
          <div className="ms-search-modal">
            <div className="ms-search-modal-header">
              <div>
                <p>MeetSync Search</p>
                <h2>What are you looking for?</h2>
              </div>

              <button type="button" onClick={() => setOpen(false)} aria-label="Close search">
                ×
              </button>
            </div>

            <form onSubmit={submitSearch} className="ms-search-form">
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search meetings, chat, whiteboards, security..."
              />

              <button type="submit">Search</button>
            </form>

            <div className="ms-search-results">
              {results.map((item) => (
                <button type="button" key={item.href} onClick={() => openResult(item.href)}>
                  <strong>{item.title}</strong>
                  <span>{item.description}</span>
                </button>
              ))}

              {!results.length && (
                <div className="ms-search-empty">
                  No result found. Try searching meeting, chat, whiteboard, dashboard, security, privacy, or signup.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
