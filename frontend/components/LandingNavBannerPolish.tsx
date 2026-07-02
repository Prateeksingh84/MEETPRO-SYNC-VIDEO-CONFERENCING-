"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

function clean(value: string | null | undefined) {
  return (value || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function alpha(value: string | null | undefined) {
  return clean(value).replace(/[^a-z]/g, "");
}

function setNavText(control: HTMLElement, label: string) {
  control.textContent = label;
  control.setAttribute("aria-label", label);
}

function fixSmallVInHeader() {
  const header =
    document.querySelector<HTMLElement>("header") ||
    document.querySelector<HTMLElement>("nav");

  if (!header) return;

  const controls = Array.from(header.querySelectorAll<HTMLElement>("a,button"));

  controls.forEach((control) => {
    const value = alpha(control.textContent);

    if ((value === "products" || value === "productsv") && clean(control.textContent).length <= 12) {
      setNavText(control, "Products");
      return;
    }

    if ((value === "ai" || value === "aiv") && clean(control.textContent).length <= 6) {
      setNavText(control, "✦ AI");
      return;
    }

    if ((value === "solutions" || value === "solutionsv") && clean(control.textContent).length <= 13) {
      setNavText(control, "Solutions");
      return;
    }

    if ((value === "pricing" || value === "pricingv") && clean(control.textContent).length <= 10) {
      setNavText(control, "Pricing");
      return;
    }

    if ((value === "meet" || value === "meetv") && clean(control.textContent).length <= 8) {
      setNavText(control, "Meet");
    }
  });
}

function mountMeetSyncProBanner() {
  const alreadyMounted = document.querySelector(".ms-pro-top-banner-content");
  if (alreadyMounted) return;

  const elements = Array.from(document.querySelectorAll<HTMLElement>("a,section,div"));

  const candidates = elements.filter((element) => {
    const rect = element.getBoundingClientRect();
    const text = clean(element.textContent);
    const className = clean(element.getAttribute("class"));

    const isTopWideBar =
      rect.top >= 85 &&
      rect.top <= 220 &&
      rect.width >= window.innerWidth * 0.75 &&
      rect.height >= 50 &&
      rect.height <= 120;

    const looksLikePromo =
      className.includes("banner") ||
      className.includes("alert") ||
      className.includes("promo") ||
      className.includes("announcement") ||
      text.includes("meetsyncmate") ||
      text.includes("explore meetsyncmate") ||
      text.includes("introducing");

    return isTopWideBar && looksLikePromo;
  });

  if (!candidates.length) return;

  const target = candidates.sort((a, b) => {
    const areaA = a.getBoundingClientRect().width * a.getBoundingClientRect().height;
    const areaB = b.getBoundingClientRect().width * b.getBoundingClientRect().height;
    return areaB - areaA;
  })[0];

  target.classList.add("ms-pro-top-banner");
  target.removeAttribute("href");
  target.removeAttribute("target");
  target.removeAttribute("rel");
  target.setAttribute("aria-label", "MeetSyncPro secure workspace announcement");

  target.innerHTML = "";

  const content = document.createElement("div");
  content.className = "ms-pro-top-banner-content";

  const left = document.createElement("div");
  left.className = "ms-pro-top-banner-copy";

  const eyebrow = document.createElement("span");
  eyebrow.textContent = "MeetSyncPro Workspace";

  const message = document.createElement("strong");
  message.textContent =
    "Secure meetings, real-time chat, whiteboards, recordings, and AI-ready collaboration in one professional workspace.";

  left.appendChild(eyebrow);
  left.appendChild(message);

  const actions = document.createElement("div");
  actions.className = "ms-pro-top-banner-actions";

  const startMeeting = document.createElement("a");
  startMeeting.href = "/dashboard";
  startMeeting.textContent = "Start meeting";

  const joinMeeting = document.createElement("a");
  joinMeeting.href = "/join";
  joinMeeting.textContent = "Join meeting";

  actions.appendChild(startMeeting);
  actions.appendChild(joinMeeting);

  content.appendChild(left);
  content.appendChild(actions);

  target.appendChild(content);
}

export function LandingNavBannerPolish() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== "/") return;

    function run() {
      fixSmallVInHeader();
      mountMeetSyncProBanner();
    }

    run();

    const timers = [
      window.setTimeout(run, 200),
      window.setTimeout(run, 700),
      window.setTimeout(run, 1500),
      window.setTimeout(run, 3000),
    ];

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [pathname]);

  return null;
}
