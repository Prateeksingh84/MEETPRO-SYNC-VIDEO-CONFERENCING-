import { StaticMarketingPage } from "@/components/StaticMarketingPage";

export default function EnterprisePage() {
  return (
    <StaticMarketingPage
      eyebrow="Enterprise Architecture"
      title="Scale MeetSync Pro for secure, high-volume collaboration."
      description="MeetSync Pro is designed as a modern collaboration platform with real-time meetings, chat, recordings, whiteboards, privacy controls, AI-ready workflows, and Redis-ready backend scaling."
      primaryHref="/auth"
      primaryLabel="Start free"
      items={[
        {
          title: "Realtime Meeting Infrastructure",
          description:
            "WebRTC meeting rooms, WebSocket signaling, live participants, chat, recording controls, screen sharing, host tools, and reactions.",
        },
        {
          title: "Redis-Ready Scale Layer",
          description:
            "Prepared for Redis-backed rate limiting, session coordination, pub/sub event fanout, live presence, and multi-instance backend scaling.",
        },
        {
          title: "Enterprise Security Foundation",
          description:
            "CORS boundaries, secure headers, environment-based secrets, protected backend configuration, and privacy-first user controls.",
        },
        {
          title: "AI Productivity Roadmap",
          description:
            "Consent-based AI summaries, action items, smart recordings, meeting notes, virtual agent workflows, and productivity automation.",
        },
      ]}
    />
  );
}
