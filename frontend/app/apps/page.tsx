"use client";

import { useEffect, useState } from "react";
import { DashboardHeader } from "@/components/DashboardHeader";
import {
  connectApp,
  disconnectApp,
  getApps,
  getGoogleAuthUrl,
  getIntegrationStatus,
  shareMeetingToSlack,
  testSlackConnection,
  IntegrationApp,
  IntegrationStatus,
} from "@/lib/api";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  "http://localhost:8000";

type ActivityEvent = {
  id: string;
  app: string;
  actor: string;
  action: string;
  status: string;
  time: string;
};

const emptyStatus: IntegrationStatus = {
  google: false,
  slack: false,
  drive: false,
  calendar: false,
};

async function getIntegrationActivity(): Promise<ActivityEvent[]> {
  const response = await fetch(`${API_BASE}/api/integrations/activity`, {
    cache: "no-store",
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.detail || "Could not load integration activity");
  }

  return Array.isArray(data?.events) ? data.events : [];
}

function formatEventTime(value: string) {
  if (!value) return "Just now";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AppsPage() {
  const [apps, setApps] = useState<IntegrationApp[]>([]);
  const [status, setStatus] = useState<IntegrationStatus>(emptyStatus);
  const [activityEvents, setActivityEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingAppId, setWorkingAppId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    loadApps();

    const query = new URLSearchParams(window.location.search);
    const googleStatus = query.get("google");

    if (googleStatus === "connected") {
      setMessage("Google OAuth completed. Status refreshed from backend.");
      window.history.replaceState({}, "", "/apps");
    }

    if (googleStatus === "failed") {
      setError("Google connection failed.");
      window.history.replaceState({}, "", "/apps");
    }

    if (googleStatus === "missing-code") {
      setError("Google OAuth did not return an authorization code.");
      window.history.replaceState({}, "", "/apps");
    }
  }, []);

  async function loadApps() {
    setLoading(true);
    setError("");

    try {
      const [appsData, statusData, eventsData] = await Promise.all([
        getApps(),
        getIntegrationStatus(),
        getIntegrationActivity(),
      ]);

      setApps(Array.isArray(appsData.apps) ? appsData.apps : []);
      setStatus({
        ...emptyStatus,
        ...statusData,
      });
      setActivityEvents(eventsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load integrations");
      setApps([]);
      setStatus(emptyStatus);
      setActivityEvents([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleAppAction(app: IntegrationApp) {
    setWorkingAppId(app.id);
    setMessage("");
    setError("");

    try {
      if (app.status === "not_configured") {
        setError(app.configurationMessage || `${app.name} is not configured in backend .env`);
        return;
      }

      if (app.status === "connected") {
        const response = await disconnectApp(app.id);

        setMessage(response.message || `${app.name} disconnected successfully.`);
        await loadApps();
        return;
      }

      if (app.id === "google-calendar" || app.id === "google-drive") {
        const authUrl = await getGoogleAuthUrl();

        if (!authUrl) {
          throw new Error("Google authorization URL not received from backend.");
        }

        window.location.href = authUrl;
        return;
      }

      if (app.id === "slack") {
        const response = await testSlackConnection();

        setMessage(response.message || "Slack connected successfully.");
        await loadApps();
        return;
      }

      const response = await connectApp(app.id);

      setMessage(response.message || `${app.name} connected successfully.`);
      await loadApps();
    } catch (err) {
      setError(err instanceof Error ? err.message : `${app.name} action failed`);
    } finally {
      setWorkingAppId("");
    }
  }

  async function handleShareToSlack() {
    setWorkingAppId("slack-share");
    setMessage("");
    setError("");

    try {
      const response = await shareMeetingToSlack({
        channel: "#general",
        message: "MeetSync Pro Slack integration message.",
      });

      setMessage(response.message || "Message shared to Slack successfully.");
      await loadApps();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Slack share failed");
    } finally {
      setWorkingAppId("");
    }
  }

  const connectedCount =
    Number(Boolean(status.google)) +
    Number(Boolean(status.calendar)) +
    Number(Boolean(status.drive)) +
    Number(Boolean(status.slack));

  return (
    <main className="dashboard-page">
      <DashboardHeader />

      <section className="workspace-page">
        <div className="workspace-title-row">
          <div>
            <p className="eyebrow">App Integrations</p>
            <h2>Connect your workflow</h2>
            <p>
              Integrations are verified using real backend credentials. Apps without keys stay
              Not Configured and cannot be marked connected.
            </p>
          </div>

          <button className="secondary-button" onClick={loadApps} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh Apps"}
          </button>
        </div>

        {message && <div className="success-box">{message}</div>}
        {error && <div className="error-box">{error}</div>}

        <section className="apps-layout">
          <div className="apps-grid">
            {loading && !apps.length ? (
              <div className="empty-state">Loading integrations from backend...</div>
            ) : apps.length ? (
              apps.map((app) => (
                <article className="app-card" key={app.id}>
                  <div className="app-icon">{app.icon}</div>

                  <div>
                    <p className="eyebrow">{app.category}</p>
                    <h3>{app.name}</h3>
                    <p>{app.description}</p>
                  </div>

                  <p className="integration-status">
                    {app.status === "connected"
                      ? "Connected"
                      : app.status === "not_configured"
                        ? "Not configured"
                        : "Not connected"}
                  </p>

                  {app.status === "not_configured" && (
                    <p className="muted-text">{app.configurationMessage}</p>
                  )}

                  <div className="app-actions">
                    <button
                      className={app.status === "connected" ? "secondary-button" : "primary-button"}
                      onClick={() => handleAppAction(app)}
                      disabled={workingAppId === app.id}
                    >
                      {workingAppId === app.id ? "Working..." : app.actionLabel || "Connect"}
                    </button>

                    {app.id === "slack" && app.status === "connected" && (
                      <button
                        className="secondary-button"
                        onClick={handleShareToSlack}
                        disabled={workingAppId === "slack-share"}
                      >
                        {workingAppId === "slack-share" ? "Sharing..." : "Share Test Message"}
                      </button>
                    )}
                  </div>
                </article>
              ))
            ) : (
              <div className="empty-state">No integrations found from backend.</div>
            )}
          </div>

          <aside className="workspace-card">
            <div className="section-title">
              <h2>Integration Status</h2>
              <span>{connectedCount} connected</span>
            </div>

            <div className="activity-feed">
              <div className="activity-item">
                <strong>Google</strong>
                <p>{status.google ? "Connected" : "Not connected"}</p>
              </div>

              <div className="activity-item">
                <strong>Calendar</strong>
                <p>{status.calendar ? "Connected" : "Not connected"}</p>
              </div>

              <div className="activity-item">
                <strong>Drive</strong>
                <p>{status.drive ? "Connected" : "Not connected"}</p>
              </div>

              <div className="activity-item">
                <strong>Slack</strong>
                <p>{status.slack ? "Connected" : "Not connected"}</p>
              </div>
            </div>

            <div className="section-title apps-activity-title">
              <h2>Recent Activity</h2>
              <span>Backend</span>
            </div>

            <div className="activity-feed">
              {activityEvents.length ? (
                activityEvents.map((event) => (
                  <div className="activity-item" key={event.id}>
                    <strong>{event.app}</strong>
                    <p>
                      {event.actor} {event.action}
                    </p>
                    <small>{formatEventTime(event.time)}</small>
                  </div>
                ))
              ) : (
                <div className="empty-state">No backend integration activity yet.</div>
              )}
            </div>
          </aside>
        </section>
      </section>
    </main>
  );
}