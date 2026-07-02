import Link from "next/link";

const securityControls = [
  "Environment-based backend and frontend configuration",
  "CORS-restricted production frontend origin",
  "Secure browser headers",
  "Redis-ready rate limiting",
  "No hardcoded production secrets",
  "Separated frontend and backend deployments",
  "Backend health endpoint for production monitoring",
  "Privacy and cookie preference center",
];

export default function SecurityPage() {
  return (
    <main className="enterprise-page">
      <nav className="enterprise-nav">
        <Link href="/" className="enterprise-logo">
          meetsync
        </Link>

        <div>
          <Link href="/enterprise">Enterprise</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/auth" className="enterprise-nav-cta">
            Get started
          </Link>
        </div>
      </nav>

      <section className="enterprise-hero">
        <p>Security Center</p>
        <h1>Secure foundation for real-time video collaboration.</h1>
        <span>
          MeetSync Pro uses production-ready security practices such as origin control,
          environment secrets, secure headers, and rate-limit readiness.
        </span>
      </section>

      <section className="enterprise-grid">
        {securityControls.map((item) => (
          <article key={item}>
            <h2>{item}</h2>
            <p>
              This control helps protect users, meeting data, backend APIs, and production
              collaboration workflows.
            </p>
          </article>
        ))}
      </section>
    </main>
  );
}
