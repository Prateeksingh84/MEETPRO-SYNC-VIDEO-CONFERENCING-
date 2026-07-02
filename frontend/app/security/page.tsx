import { StaticMarketingPage } from "@/components/StaticMarketingPage";

export default function SecurityPage() {
  return (
    <StaticMarketingPage
      eyebrow="Security Center"
      title="Secure foundation for real-time video collaboration."
      description="MeetSync Pro uses production security practices for frontend, backend, APIs, WebSockets, user preferences, recordings, and AI-ready workflows."
      primaryHref="/privacy"
      primaryLabel="View privacy"
      items={[
        {
          title: "Secure Headers",
          description:
            "Security headers reduce browser attack surface and protect users from common frontend risks.",
        },
        {
          title: "CORS Origin Control",
          description:
            "Backend requests should only be accepted from approved frontend production domains.",
        },
        {
          title: "Environment Secrets",
          description:
            "API keys, OAuth credentials, tokens, backend URLs, and integration secrets are kept in environment variables.",
        },
        {
          title: "Rate Limit Ready",
          description:
            "Redis can be used for API rate limiting, abuse prevention, session coordination, and live traffic control.",
        },
        {
          title: "Privacy Consent",
          description:
            "Cookie preferences and AI meeting features should run with clear user consent and transparent retention policies.",
        },
        {
          title: "Production Monitoring",
          description:
            "Health checks, logs, error tracking, uptime monitoring, and audit events should be added for production operations.",
        },
      ]}
    />
  );
}
