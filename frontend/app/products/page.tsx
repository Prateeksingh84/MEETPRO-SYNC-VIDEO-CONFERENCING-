import Link from "next/link";

const productModules = [
  {
    title: "Meetings",
    badge: "Live video",
    icon: "🎥",
    href: "/dashboard",
    description:
      "Create instant rooms, join by link, use camera/microphone, manage participants, chat, record, react, and share meeting context.",
  },
  {
    title: "Team Chat",
    badge: "Realtime messaging",
    icon: "💬",
    href: "/team-chat",
    description:
      "Workspace chat with live presence, huddle creation, message history, and real-time WebSocket communication.",
  },
  {
    title: "Whiteboards",
    badge: "Visual collaboration",
    icon: "□",
    href: "/whiteboards",
    description:
      "Collaborative canvas for brainstorming, teaching, planning, diagrams, remote discussions, and live drawing sync.",
  },
  {
    title: "Recordings",
    badge: "Meeting memory",
    icon: "●",
    href: "/dashboard",
    description:
      "Browser-based meeting recording with saved files, download support, and backend upload workflow.",
  },
  {
    title: "MeetSyncPro",
    badge: "AI teammate",
    icon: "✦",
    href: "/enterprise",
    description:
      "AI-ready assistant layer for summaries, action items, smart notes, meeting follow-ups, and productivity workflows.",
  },
  {
    title: "Security & Privacy",
    badge: "Enterprise ready",
    icon: "🛡️",
    href: "/security",
    description:
      "Secure headers, CORS origin control, cookie preferences, consent-first AI roadmap, and environment-based secrets.",
  },
];

const workflowCards = [
  {
    title: "Before the meeting",
    points: ["Create an instant meeting", "Share invite link", "Prepare agenda", "Check camera and microphone"],
  },
  {
    title: "During the meeting",
    points: ["Video call", "Chat", "Screen sharing", "Whiteboard", "Recording", "Reactions"],
  },
  {
    title: "After the meeting",
    points: ["Download recording", "Review chat", "Create notes", "Extract action items", "Follow up"],
  },
];

export default function ProductsPage() {
  return (
    <main className="ms-products-page">
      <nav className="ms-products-nav">
        <Link href="/" className="ms-products-logo">meetsync</Link>

        <div>
          <Link href="/enterprise">Enterprise</Link>
          <Link href="/security">Security</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/auth" className="ms-products-nav-cta">Get started</Link>
        </div>
      </nav>

      <section className="ms-products-hero">
        <p>Products</p>
        <h1>One AI-first workspace for meetings, chat, whiteboards, recordings, and notes.</h1>
        <span>
          MeetSync Pro brings core collaboration modules into one browser-based workspace with real-time communication,
          meeting memory, privacy controls, and enterprise-ready scaling direction.
        </span>

        <div className="ms-products-actions">
          <Link href="/dashboard">Open dashboard</Link>
          <Link href="/join">Join a meeting</Link>
        </div>
      </section>

      <section className="ms-products-grid">
        {productModules.map((product) => (
          <Link href={product.href} className="ms-product-module" key={product.title}>
            <div className="module-top">
              <span>{product.icon}</span>
              <small>{product.badge}</small>
            </div>

            <h2>{product.title}</h2>
            <p>{product.description}</p>
            <b>Explore →</b>
          </Link>
        ))}
      </section>

      <section className="ms-workflow-section">
        <div className="ms-workflow-heading">
          <p>Workflow</p>
          <h2>Designed for the full meeting lifecycle.</h2>
        </div>

        <div className="ms-workflow-grid">
          {workflowCards.map((card) => (
            <article key={card.title}>
              <h3>{card.title}</h3>
              <ul>
                {card.points.map((point) => (
                  <li key={point}>✓ {point}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="ms-products-cta">
        <h2>Start with meetings. Scale into a complete AI-first workspace.</h2>
        <Link href="/auth">Create account</Link>
      </section>
    </main>
  );
}

