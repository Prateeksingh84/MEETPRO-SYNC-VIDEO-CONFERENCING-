import Link from "next/link";

type StaticMarketingPageProps = {
  eyebrow: string;
  title: string;
  description: string;
  primaryHref?: string;
  primaryLabel?: string;
  items: Array<{
    title: string;
    description: string;
  }>;
};

export function StaticMarketingPage({
  eyebrow,
  title,
  description,
  primaryHref = "/auth",
  primaryLabel = "Get started",
  items,
}: StaticMarketingPageProps) {
  return (
    <main className="ms-route-page">
      <nav className="ms-route-nav">
        <Link href="/" className="ms-route-logo">meetsync</Link>
        <div>
          <Link href="/products">Products</Link>
          <Link href="/enterprise">Enterprise</Link>
          <Link href="/security">Security</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href={primaryHref} className="route-cta">{primaryLabel}</Link>
        </div>
      </nav>

      <section className="ms-route-hero">
        <p>{eyebrow}</p>
        <h1>{title}</h1>
        <span>{description}</span>
        <div>
          <Link href={primaryHref}>{primaryLabel}</Link>
          <Link href="/dashboard">Open dashboard</Link>
        </div>
      </section>

      <section className="ms-route-grid">
        {items.map((item) => (
          <article key={item.title}>
            <h2>{item.title}</h2>
            <p>{item.description}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
