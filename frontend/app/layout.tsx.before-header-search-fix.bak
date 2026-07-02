import { RouteWidgetGuard } from "@/components/RouteWidgetGuard";
import type { Metadata, Viewport } from "next";
import "./globals.css";
import { MeetSyncCookiePreferences } from "@/components/MeetSyncCookiePreferences";
import { MeetSyncVirtualAgent } from "@/components/MeetSyncVirtualAgent";

const siteUrl = "https://meetpro-sync-video-conferencing.vercel.app";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "MeetSync Pro | One platform to connect",
    template: "%s | MeetSync Pro",
  },
  description:
    "MeetSync Pro is an AI-first real-time collaboration platform for video meetings, team chat, whiteboards, recordings, AI notes, privacy controls, and enterprise-ready workflows.",
  keywords: [
    "MeetSync Pro",
    "Video conferencing",
    "Real-time meetings",
    "Team chat",
    "Whiteboard",
    "AI notes",
    "WebRTC",
    "Collaboration platform",
    "Workspace platform",
  ],
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: "website",
    url: siteUrl,
    title: "MeetSync Pro | One platform to connect",
    description:
      "AI-first video meetings, chat, recordings, whiteboards, virtual agent, and privacy-first collaboration workflows.",
    siteName: "MeetSync Pro",
  },
  twitter: {
    card: "summary_large_image",
    title: "MeetSync Pro | One platform to connect",
    description:
      "AI-first video meetings, chat, recordings, whiteboards, virtual agent, and privacy-first collaboration workflows.",
  },
};

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "MeetSync Pro",
  url: siteUrl,
  description:
    "MeetSync Pro is a real-time collaboration platform for meetings, chat, whiteboards, recordings, AI notes, and secure teamwork.",
  contactPoint: {
    "@type": "ContactPoint",
    telephone: "+91-78277-27574",
    contactType: "customer support",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(organizationSchema),
          }}
        />
        {children}
        <MeetSyncCookiePreferences />
        <MeetSyncVirtualAgent />
              <RouteWidgetGuard />
      </body>
    </html>
  );
}

