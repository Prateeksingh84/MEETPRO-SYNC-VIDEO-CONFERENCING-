import Link from "next/link";

const scaleItems = [
  {
    title: "Realtime Meeting Infrastructure",
    description:
      "WebRTC meeting rooms, WebSocket signaling, live participants, chat, recording controls, screen sharing, and host tools.",
  },
  {
    title: "Redis-Ready Scale Layer",
    description:
      "Prepared for Redis-backed rate limiting, session coordination, event fanout, and production traffic control.",
  },
  {
    title: "Enterprise Security Foundation",
    description:
      "CORS boundaries, security headers, environment-based secrets, privacy pages, and protected backend configuration.",
  },
  {
    title: "AI Productivity Roadmap",
    description:
      "Meeting summaries, action items, smart recordings, note generation, and AI workflow automation can be added with user consent.",
  },
];

const roadmap = [
  "Move production database from SQLite to PostgreSQL",
  "Use Redis Pub/Sub for multi-instance WebSocket coordination",
  "Add TURN/SFU media servers for large-scale video meetings",
  "Add audit logs, admin controls, and meeting governance",
  "Add consent-based transcription and AI meeting summaries",
  "Add observability with logs, metrics, alerts, and uptime monitoring",
];

export default function EnterprisePage() {
  return (
    <main className="enterprise-page">
      <nav className="enterprise-nav">
        <Link href="/" className="enterprise-logo">
          meetsync
        </Link>

        <div>
          <Link href="/dashboard">Products</Link>
          <Link href="/security">Security</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/auth" className="enterprise-nav-cta">
            Get started
          </Link>
        </div>
      </nav>

      <section className="enterprise-hero">
        <p>Enterprise Architecture</p>
        <h1>Scale MeetSync Pro for secure, high-volume collaboration.</h1>
        <span>
          MeetSync Pro is built as a modern video collaboration platform with real-time meetings,
          chat, whiteboards, recordings, privacy-first controls, and a Redis-ready backend foundation.
        </span>

        <div className="enterprise-actions">
          <Link href="/auth">Start free</Link>
          <Link href="/dashboard">Open dashboard</Link>
        </div>
      </section>

      <section className="enterprise-grid">
        {scaleItems.map((item) => (
          <article key={item.title}>
            <h2>{item.title}</h2>
            <p>{item.description}</p>
          </article>
        ))}
      </section>

      <section className="enterprise-roadmap">
        <div>
          <p>Production Roadmap</p>
          <h2>What is needed for crore-level usage?</h2>
          <span>
            A peer-to-peer WebRTC demo is good for small meetings. For massive scale, MeetSync Pro
            should use SFU/TURN media infrastructure, Redis, PostgreSQL, autoscaling, observability,
            and strong privacy governance.
          </span>
        </div>

        <ul>
          {roadmap.map((item) => (
            <li key={item}>✓ {item}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}
