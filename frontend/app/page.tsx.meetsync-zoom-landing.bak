"use client";

import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function LandingPage() {
  return (
    <main className="landing-page clean-public-landing">
      <header className="landing-header clean-public-header">
        <Link href="/" className="landing-brand">
          <div className="brand-logo">M</div>

          <div>
            <p>Video Conferencing Platform</p>
            <h1>MeetSync Pro</h1>
          </div>
        </Link>

        <div className="landing-header-actions">
          <ThemeToggle />

          <Link href="/auth" className="landing-login-button">
            Login / Signup
          </Link>
        </div>
      </header>

      <section className="landing-hero-section">
        <div className="landing-hero-copy">
          <div className="live-pill">
            <span className="status-dot" />
            Real-time video conferencing platform
          </div>

          <h2>Meet, schedule, chat, present, and collaborate from one workspace.</h2>

          <p>
            MeetSync Pro is a full-stack Zoom-style video conferencing platform. It allows
            users to create instant meetings, schedule future meetings, join through invite
            links, manage participants, chat in real time, collaborate on whiteboards, and
            connect productivity apps.
          </p>
        </div>

        <div className="landing-preview-card">
          <div className="preview-topbar">
            <span />
            <span />
            <span />
            <strong>Meeting Preview</strong>
          </div>

          <div className="preview-video-grid">
            <div className="preview-tile main">
              <span>PS</span>
              <p>Host</p>
            </div>

            <div className="preview-tile">
              <span>AI</span>
              <p>Participant</p>
            </div>

            <div className="preview-tile">
              <span>UX</span>
              <p>Designer</p>
            </div>
          </div>

          <div className="preview-controls">
            <button>🎙️ Mute</button>
            <button>🎥 Video</button>
            <button>💬 Chat</button>
            <button>📤 Share</button>
          </div>
        </div>
      </section>

      <section className="platform-overview-section">
        <div className="landing-section-heading">
          <p className="eyebrow">Platform Overview</p>
          <h2>What MeetSync Pro contains</h2>
        </div>

        <div className="landing-feature-grid">
          <OverviewCard
            icon="📹"
            title="Instant Meetings"
            text="Start a meeting instantly with a generated meeting ID and invite link."
          />

          <OverviewCard
            icon="🔗"
            title="Join Meetings"
            text="Join meetings using a meeting ID or a shared invite link."
          />

          <OverviewCard
            icon="📅"
            title="Schedule Meetings"
            text="Schedule future meetings with title, description, time, duration, and history."
          />

          <OverviewCard
            icon="👥"
            title="Participant Management"
            text="Track participants, host status, mute state, camera state, and active users."
          />

          <OverviewCard
            icon="💬"
            title="Real-Time Chat"
            text="Use meeting chat and team chat powered by WebSocket communication."
          />

          <OverviewCard
            icon="📝"
            title="Collaborative Whiteboard"
            text="Draw and collaborate live on a shared whiteboard canvas."
          />

          <OverviewCard
            icon="🧩"
            title="App Integrations"
            text="Connect Google Calendar, Google Drive, and Slack from the apps section."
          />

          <OverviewCard
            icon="⚙️"
            title="Settings"
            text="Manage theme, profile preferences, device settings, and account options."
          />
        </div>
      </section>
    </main>
  );
}

function OverviewCard({
  icon,
  title,
  text,
}: {
  icon: string;
  title: string;
  text: string;
}) {
  return (
    <article className="landing-feature-card">
      <span>{icon}</span>
      <h3>{title}</h3>
      <p>{text}</p>
    </article>
  );
}