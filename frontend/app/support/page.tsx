import { StaticMarketingPage } from "@/components/StaticMarketingPage";

export default function SupportPage() {
  return (
    <StaticMarketingPage
      eyebrow="Support"
      title="Get help with meetings, chat, recordings, whiteboards, and workspace setup."
      description="Use MeetSync Pro support resources and the virtual agent to navigate product flows quickly."
      primaryHref="/join"
      primaryLabel="Test meeting"
      items={[
        { title: "Join a Meeting", description: "Use the meeting link or meeting ID to enter a room quickly." },
        { title: "Camera and Microphone", description: "Allow browser permissions and use HTTPS deployment for media access." },
        { title: "Recording", description: "Use the meeting room recording button and select the correct browser tab or window." },
        { title: "WebSocket Connection", description: "Confirm backend URL, CORS, and WebSocket environment settings if live features fail." },
      ]}
    />
  );
}
