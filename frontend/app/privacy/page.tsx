import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="enterprise-page">
      <nav className="enterprise-nav">
        <Link href="/" className="enterprise-logo">
          meetsync
        </Link>

        <div>
          <Link href="/enterprise">Enterprise</Link>
          <Link href="/security">Security</Link>
          <Link href="/auth" className="enterprise-nav-cta">
            Get started
          </Link>
        </div>
      </nav>

      <section className="enterprise-hero">
        <p>Privacy Center</p>
        <h1>Privacy-first meetings, recordings, chat, and AI workflows.</h1>
        <span>
          MeetSync Pro is designed to minimize data exposure, avoid hardcoded secrets, give users
          control over cookie preferences, and prepare AI features for consent-based processing.
        </span>
      </section>

      <section className="enterprise-grid">
        <article>
          <h2>Cookie Control</h2>
          <p>Users can manage performance, functional, and targeting preferences from the cookie panel.</p>
        </article>

        <article>
          <h2>Meeting Data</h2>
          <p>Meeting metadata, chat, recordings, and participant activity should be protected with clear retention rules.</p>
        </article>

        <article>
          <h2>AI Consent</h2>
          <p>AI summaries and transcripts should only run after clear user consent and meeting policy approval.</p>
        </article>

        <article>
          <h2>Secure Configuration</h2>
          <p>Secrets, backend URLs, OAuth keys, and integrations should always come from environment variables.</p>
        </article>
      </section>
    </main>
  );
}
