"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardHeader } from "@/components/DashboardHeader";
import { MeetingCard } from "@/components/MeetingCard";
import { Modal } from "@/components/Modal";
import {
  createInstantMeeting,
  getDashboard,
  getDashboardWsUrl,
  getPlatformSummary,
  scheduleMeeting,
} from "@/lib/api";
import { Dashboard, PlatformSummary, User } from "@/lib/types";

const TOKEN_KEY = "meetsync-auth-v2";
const USER_KEY = "meetsync-user-v2";

function currentClock() {
  return new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date());
}

function currentDate() {
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date());
}

const emptySummary: PlatformSummary = {
  totalMeetings: 0,
  scheduledMeetings: 0,
  instantMeetings: 0,
  totalParticipants: 0,
  activeParticipants: 0,
  totalMessages: 0,
  liveDashboardClients: 0,
  liveWorkspaceRooms: 0,
  updatedAt: "",
};

const meetingTemplates = [
  {
    icon: "📌",
    title: "Daily Standup",
    description: "Quick team update for progress, blockers, and priorities.",
    duration: "15 min",
  },
  {
    icon: "🚀",
    title: "Project Kickoff",
    description: "Start a new project with goals, owners, timeline, and deliverables.",
    duration: "45 min",
  },
  {
    icon: "🧠",
    title: "Brainstorming",
    description: "Collaborate on ideas, planning, product features, and improvements.",
    duration: "30 min",
  },
  {
    icon: "📊",
    title: "Client Review",
    description: "Review progress, discuss updates, and define next action items.",
    duration: "60 min",
  },
];

export default function DashboardPage() {
  const router = useRouter();

  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  const [dashboard, setDashboard] = useState<Dashboard>({
    upcoming: [],
    recent: [],
  });

  const [summary, setSummary] = useState<PlatformSummary>(emptySummary);

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [modal, setModal] = useState<"join" | "schedule" | null>(null);
  const [error, setError] = useState("");
  const [clock, setClock] = useState("--:--");
  const [today, setToday] = useState("");

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    const rawUser = localStorage.getItem(USER_KEY);

    if (!token || !rawUser) {
      localStorage.removeItem("meetsync-token");
      localStorage.removeItem("meetsync-user");
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);

      router.replace("/auth");
      return;
    }

    setUser(JSON.parse(rawUser));
    setAuthReady(true);
  }, [router]);

  useEffect(() => {
    setClock(currentClock());
    setToday(currentDate());

    const timer = setInterval(() => {
      setClock(currentClock());
      setToday(currentDate());
    }, 20_000);

    return () => clearInterval(timer);
  }, []);

  async function refreshDashboard() {
    setLoading(true);
    setError("");

    try {
      const [dashboardData, summaryData] = await Promise.all([
        getDashboard(),
        getPlatformSummary(),
      ]);

      setDashboard(dashboardData);
      setSummary({
        ...emptySummary,
        ...summaryData,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load dashboard");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!authReady) return;

    refreshDashboard();
  }, [authReady]);

  useEffect(() => {
    if (!authReady) return;

    const socket = new WebSocket(getDashboardWsUrl());

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === "dashboard-update") {
        if (data.dashboard) {
          setDashboard(data.dashboard);
        }

        if (data.summary) {
          setSummary({
            ...emptySummary,
            ...data.summary,
          });
        }
      }
    };

    socket.onopen = () => {
      socket.send("dashboard-connected");
    };

    return () => socket.close();
  }, [authReady]);

  const nextMeeting = useMemo(() => dashboard.upcoming[0], [dashboard.upcoming]);

  async function handleNewMeeting() {
    setCreating(true);
    setError("");

    try {
      const meeting = await createInstantMeeting(user?.name || "User");

      await refreshDashboard();

      router.push(`/meeting/${meeting.meeting_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create meeting");
    } finally {
      setCreating(false);
    }
  }

  if (!authReady) {
    return null;
  }

  return (
    <main className="dashboard-page">
      <DashboardHeader />

      <section className="dashboard-clean-main">
        <div className="dashboard-heading">
          <div>
            <p className="eyebrow">Real-time meeting dashboard</p>
            <h2>Manage your meetings</h2>
            <p>
              Create instant meetings, join through invite links, schedule future calls,
              and track real activity from the backend database.
            </p>
          </div>
        </div>

        {error && <div className="error-box">{error}</div>}

        <section className="dashboard-top-grid">
          <div className="dashboard-action-panel">
            <button className="action-button orange" onClick={handleNewMeeting} disabled={creating}>
              <span>🎥</span>
              {creating ? "Creating..." : "New Meeting"}
            </button>

            <button className="action-button blue" onClick={() => setModal("join")}>
              <span>➕</span>
              Join Meeting
            </button>

            <button className="action-button sky" onClick={() => setModal("schedule")}>
              <span>📅</span>
              Schedule
            </button>
          </div>

          <aside className="time-card compact-time-card">
            <div suppressHydrationWarning>
              <h3>{clock}</h3>
              <p>{today || "Loading date..."}</p>
            </div>

            <div className="mini-card">
              <strong>Next up</strong>
              <p>{nextMeeting ? nextMeeting.title : "No upcoming meetings yet"}</p>
            </div>
          </aside>
        </section>

        <section className="dashboard-stat-row">
          <StatCard label="Total Meetings" value={summary.totalMeetings} />
          <StatCard label="Scheduled" value={summary.scheduledMeetings} />
          <StatCard label="Instant" value={summary.instantMeetings} />
          <StatCard label="Participants" value={summary.totalParticipants} />
        </section>

        <section className="section-grid">
          <div className="section-panel">
            <div className="section-title">
              <h2>Upcoming meetings</h2>
              <span>{dashboard.upcoming.length} scheduled</span>
            </div>

            <div className="meeting-list">
              {loading ? (
                <div className="empty-state">Loading real meetings from SQLite...</div>
              ) : dashboard.upcoming.length ? (
                dashboard.upcoming.map((meeting) => (
                  <MeetingCard key={meeting.meeting_id} meeting={meeting} />
                ))
              ) : (
                <div className="empty-state">
                  No scheduled meetings yet. Click Schedule to create your first meeting.
                </div>
              )}
            </div>
          </div>

          <div className="section-panel">
            <div className="section-title">
              <h2>{dashboard.recent.length ? "Recent meetings" : "Meeting templates"}</h2>
              <span>{dashboard.recent.length ? "Real-time history" : "Quick start"}</span>
            </div>

            {dashboard.recent.length ? (
              <div className="meeting-list">
                {dashboard.recent.map((meeting) => (
                  <MeetingCard key={meeting.meeting_id} meeting={meeting} compact />
                ))}
              </div>
            ) : (
              <div className="template-grid">
                {meetingTemplates.map((template) => (
                  <button
                    key={template.title}
                    className="template-card"
                    onClick={() => setModal("schedule")}
                  >
                    <span>{template.icon}</span>
                    <strong>{template.title}</strong>
                    <p>{template.description}</p>
                    <small>{template.duration}</small>
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="section-panel dashboard-realtime-panel">
          <div className="section-title">
            <h2>Live system activity</h2>
            <span>Connected to backend</span>
          </div>

          <div className="realtime-grid">
            <div>
              <strong>{summary.activeParticipants}</strong>
              <span>Active participants</span>
            </div>

            <div>
              <strong>{summary.totalMessages}</strong>
              <span>Meeting messages</span>
            </div>

            <div>
              <strong>{summary.liveDashboardClients || 0}</strong>
              <span>Dashboard clients</span>
            </div>

            <div>
              <strong>{summary.liveWorkspaceRooms || 0}</strong>
              <span>Workspace rooms</span>
            </div>
          </div>
        </section>
      </section>

      {modal === "join" && <JoinModal onClose={() => setModal(null)} />}

      {modal === "schedule" && (
        <ScheduleModal
          onClose={() => setModal(null)}
          onCreated={async () => {
            await refreshDashboard();
            setModal(null);
          }}
        />
      )}
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <article className="stat-card">
      <p>{label}</p>
      <strong>{value}</strong>
      <span>Live from backend</span>
    </article>
  );
}

function JoinModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [meetingId, setMeetingId] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();

    const cleaned = meetingId.trim();

    if (!cleaned) return;

    const extracted = cleaned.includes("/meeting/")
      ? cleaned.split("/meeting/").pop() || cleaned
      : cleaned;

    router.push(`/join?meetingId=${encodeURIComponent(extracted)}`);
  }

  return (
    <Modal title="Join meeting" onClose={onClose}>
      <form className="form-stack" onSubmit={submit}>
        <label>
          Meeting ID or invite link
          <input
            placeholder="Enter meeting ID or invite link"
            value={meetingId}
            onChange={(event) => setMeetingId(event.target.value)}
            autoFocus
            required
          />
        </label>

        <button className="primary-button" type="submit">
          Continue
        </button>
      </form>
    </Modal>
  );
}

function ScheduleModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startTime, setStartTime] = useState("");
  const [duration, setDuration] = useState(60);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();

    setError("");
    setSaving(true);

    try {
      await scheduleMeeting({
        title,
        description,
        start_time: new Date(startTime).toISOString(),
        duration_minutes: Number(duration),
      });

      await onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not schedule meeting");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Schedule meeting" onClose={onClose}>
      <form className="form-stack" onSubmit={submit}>
        {error && <div className="error-box">{error}</div>}

        <label>
          Meeting title
          <input
            placeholder="Example: Client Review Meeting"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
          />
        </label>

        <label>
          Description
          <textarea
            rows={3}
            placeholder="Write agenda or meeting purpose"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>

        <label>
          Date and time
          <input
            type="datetime-local"
            value={startTime}
            onChange={(event) => setStartTime(event.target.value)}
            required
          />
        </label>

        <label>
          Duration
          <select value={duration} onChange={(event) => setDuration(Number(event.target.value))}>
            <option value={15}>15 minutes</option>
            <option value={30}>30 minutes</option>
            <option value={45}>45 minutes</option>
            <option value={60}>1 hour</option>
            <option value={90}>1.5 hours</option>
          </select>
        </label>

        <button className="primary-button" type="submit" disabled={saving}>
          {saving ? "Scheduling..." : "Schedule Meeting"}
        </button>
      </form>
    </Modal>
  );
}