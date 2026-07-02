"use client";

import { useEffect, useState } from "react";

type CookieState = {
  strictlyNecessary: boolean;
  performance: boolean;
  functional: boolean;
  targeting: boolean;
};

const STORAGE_KEY = "meetsync-cookie-preferences-v1";

const DEFAULT_STATE: CookieState = {
  strictlyNecessary: true,
  performance: true,
  functional: true,
  targeting: true,
};

export function MeetSyncCookiePreferences() {
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [preferences, setPreferences] = useState<CookieState>(DEFAULT_STATE);

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY);

    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as CookieState;
      setPreferences({
        strictlyNecessary: true,
        performance: Boolean(parsed.performance),
        functional: Boolean(parsed.functional),
        targeting: Boolean(parsed.targeting),
      });
      setSaved(true);
    } catch {
      setPreferences(DEFAULT_STATE);
    }
  }, []);

  useEffect(() => {
    if (!open) return;

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  function updateToggle(key: keyof CookieState) {
    if (key === "strictlyNecessary") return;

    setPreferences((current) => ({
      ...current,
      [key]: !current[key],
    }));
  }

  function savePreferences(next: CookieState) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setPreferences(next);
    setSaved(true);
    setOpen(false);
  }

  function handleRejectAll() {
    savePreferences({
      strictlyNecessary: true,
      performance: false,
      functional: false,
      targeting: false,
    });
  }

  function handleConfirm() {
    savePreferences(preferences);
  }

  return (
    <>
      <button
        type="button"
        className="meetsync-cookie-launcher"
        onClick={() => setOpen(true)}
        aria-label="Open MeetSync Pro cookie settings"
      >
        <span>⚙</span>
      </button>

      {open && (
        <div className="meetsync-cookie-overlay" onClick={() => setOpen(false)}>
          <section
            className="meetsync-cookie-modal"
            onClick={(event) => event.stopPropagation()}
            aria-label="MeetSync Pro cookie preferences"
          >
            <header className="meetsync-cookie-header">
              <strong>meetsync</strong>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close cookie settings">
                ×
              </button>
            </header>

            <div className="meetsync-cookie-scroll">
              <h2>Privacy Preference Center</h2>

              <p>
                Cookies and similar technologies are important to the proper functioning of MeetSync Pro
                and to provide visitors with a seamless and customized experience.
              </p>

              <p>
                We use cookies to enable core platform behavior, personalize your experience, improve
                performance, and help us understand usage patterns. You can accept or reject all optional
                cookies or customize them below.
              </p>

              <p>
                Strictly necessary cookies may process limited technical data required to run the service.
                You can change your preferences at any time by reopening this settings panel.
              </p>

              <div className="meetsync-cookie-section">
                <h3>Manage Consent Preferences</h3>

                <div className="meetsync-cookie-row">
                  <div>
                    <strong>Strictly Necessary Cookies</strong>
                    <small>Required for authentication, routing, and essential platform functionality.</small>
                  </div>
                  <span className="always-active">Always Active</span>
                </div>

                <div className="meetsync-cookie-row">
                  <div>
                    <strong>Performance Cookies</strong>
                    <small>Help us understand application performance and improve reliability.</small>
                  </div>
                  <button
                    type="button"
                    className={`toggle ${preferences.performance ? "on" : ""}`}
                    onClick={() => updateToggle("performance")}
                    aria-checked={preferences.performance}
                    role="switch"
                  >
                    <span />
                  </button>
                </div>

                <div className="meetsync-cookie-row">
                  <div>
                    <strong>Functional Cookies</strong>
                    <small>Enable enhanced features such as saved experience preferences.</small>
                  </div>
                  <button
                    type="button"
                    className={`toggle ${preferences.functional ? "on" : ""}`}
                    onClick={() => updateToggle("functional")}
                    aria-checked={preferences.functional}
                    role="switch"
                  >
                    <span />
                  </button>
                </div>

                <div className="meetsync-cookie-row">
                  <div>
                    <strong>Targeting Cookies</strong>
                    <small>Support campaign analysis and product communication relevance.</small>
                  </div>
                  <button
                    type="button"
                    className={`toggle ${preferences.targeting ? "on" : ""}`}
                    onClick={() => updateToggle("targeting")}
                    aria-checked={preferences.targeting}
                    role="switch"
                  >
                    <span />
                  </button>
                </div>
              </div>

              {saved && (
                <div className="meetsync-cookie-saved-banner">
                  Preferences were previously saved on this browser.
                </div>
              )}
            </div>

            <footer className="meetsync-cookie-footer">
              <button type="button" className="secondary" onClick={handleRejectAll}>
                Reject All
              </button>
              <button type="button" className="primary" onClick={handleConfirm}>
                Confirm My Choices
              </button>
            </footer>
          </section>
        </div>
      )}
    </>
  );
}
