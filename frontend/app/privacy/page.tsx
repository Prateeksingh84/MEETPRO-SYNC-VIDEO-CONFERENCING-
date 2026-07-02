import { StaticMarketingPage } from "@/components/StaticMarketingPage";

export default function PrivacyPage() {
  return (
    <StaticMarketingPage
      eyebrow="Privacy Center"
      title="Privacy-first meetings, recordings, chat, and AI workflows."
      description="MeetSync Pro is designed to minimize data exposure, avoid hardcoded secrets, provide cookie choices, and prepare AI features for consent-based processing."
      primaryHref="/security"
      primaryLabel="View security"
      items={[
        {
          title: "Cookie Preferences",
          description:
            "Users can manage strictly necessary, performance, functional, and targeting preferences from the cookie settings panel.",
        },
        {
          title: "Meeting Data",
          description:
            "Meeting metadata, chat, recordings, and participant activity should be protected with clear access and retention rules.",
        },
        {
          title: "AI Consent",
          description:
            "AI summaries, transcripts, and generated notes should run only after clear user consent and meeting policy approval.",
        },
        {
          title: "Data Minimization",
          description:
            "Only collect what is required for collaboration, safety, support, reliability, and product functionality.",
        },
      ]}
    />
  );
}
