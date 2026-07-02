"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

const floatingSelectors = [
  ".ms-cookie-float",
  ".ms-cookie-launcher",
  ".cookie-settings-float",
  ".cookie-preference-float",
  ".privacy-cookie-float",
  ".ms-privacy-float",
  ".ms-agent-float",
  ".ms-virtual-agent-float",
  ".virtual-agent-float",
  ".virtual-agent-launcher",
  ".meet-agent-float",
  ".landing-agent-float",
  ".floating-agent",
  ".floating-cookie",
];

export function RouteWidgetGuard() {
  const pathname = usePathname();

  useEffect(() => {
    const showOnlyOnLanding = pathname === "/";

    const applyVisibility = () => {
      document.querySelectorAll<HTMLElement>(floatingSelectors.join(",")).forEach((element) => {
        element.style.display = showOnlyOnLanding ? "" : "none";
      });
    };

    applyVisibility();

    const observer = new MutationObserver(applyVisibility);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, [pathname]);

  return null;
}
