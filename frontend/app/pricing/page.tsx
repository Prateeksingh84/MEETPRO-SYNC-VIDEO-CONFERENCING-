import { StaticMarketingPage } from "@/components/StaticMarketingPage";

export default function PricingPage() {
  return (
    <StaticMarketingPage
      eyebrow="Pricing"
      title="Choose the right MeetSync Pro plan for your team."
      description="Start with browser-based meetings and upgrade toward enterprise scale, AI productivity, Redis-backed reliability, and advanced controls."
      primaryHref="/auth"
      primaryLabel="Create account"
      items={[
        { title: "Starter", description: "Meetings, joining links, chat, and dashboard access for small teams and demos." },
        { title: "Pro", description: "Recordings, whiteboards, virtual agent, AI-ready notes, and stronger collaboration workflows." },
        { title: "Business", description: "Admin controls, analytics, integrations, Redis scaling, PostgreSQL, and team governance." },
        { title: "Enterprise", description: "SFU/TURN media architecture, compliance controls, audit logs, observability, and privacy governance." },
      ]}
    />
  );
}
