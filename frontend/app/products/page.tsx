import { StaticMarketingPage } from "@/components/StaticMarketingPage";

export default function ProductsPage() {
  return (
    <StaticMarketingPage
      eyebrow="Products"
      title="One AI-first workspace for meetings, chat, whiteboards, recordings, and notes."
      description="MeetSync Pro brings core collaboration modules into one browser-based workspace."
      primaryHref="/dashboard"
      primaryLabel="Open dashboard"
      items={[
        { title: "Meetings", description: "Real-time video rooms with host tools, participants, chat, screen sharing, reactions, and recording." },
        { title: "Team Chat", description: "Live workspace messaging with presence and meeting huddles." },
        { title: "Whiteboards", description: "Realtime visual collaboration for planning, brainstorming, and teaching." },
        { title: "Recordings", description: "Browser recording workflow with saved meeting recordings and download support." },
        { title: "Virtual Agent", description: "Interactive product assistant for help, routing, and self-service support." },
        { title: "AI Notes", description: "Roadmap-ready meeting summaries, action items, decisions, and follow-up generation." },
      ]}
    />
  );
}
