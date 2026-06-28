import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MeetSync Pro | Video Conferencing Platform",
  description:
    "A Zoom-style real-time video conferencing platform built with Next.js, FastAPI, SQLite, WebSockets, and WebRTC.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
