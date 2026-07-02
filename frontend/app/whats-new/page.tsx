import { StaticMarketingPage } from "@/components/StaticMarketingPage";

export default function WhatsNewPage() {
  return (
    <StaticMarketingPage
      eyebrow="What's New"
      title="Making news, making impact with MeetSync Pro."
      description="Latest product upgrades across meeting UI, virtual agent, cookie preferences, landing page experience, and enterprise-ready routes."
      primaryHref="/dashboard"
      primaryLabel="Open dashboard"
      items={[
        { title: "Professional Meeting UI", description: "Zoom-style call layout with bottom controls, participant count, chat, recording, and host tools." },
        { title: "Virtual Agent", description: "A working MeetSync Pro assistant with quick actions, typed messages, and product navigation." },
        { title: "Cookie Preference Center", description: "A user-facing privacy preference modal with local preference persistence." },
        { title: "Interactive Customer Stories", description: "Clickable Video SDK, Analytics, Remote, and AI Notes story cards with dynamic content." },
      ]}
    />
  );
}
