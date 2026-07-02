import type { Metadata } from "next";
import "./globals.css";
import { MeetSyncVirtualAgent } from "@/components/MeetSyncVirtualAgent";
import { MeetSyncCookiePreferences } from "@/components/MeetSyncCookiePreferences";

export const metadata: Metadata = {
  title: "MeetSync Pro",
  description: "MeetSync Pro - real-time video conferencing, collaboration, recordings, chat, and workspace tools.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
        <MeetSyncCookiePreferences />
        <MeetSyncVirtualAgent />
      </body>
    </html>
  );
}
