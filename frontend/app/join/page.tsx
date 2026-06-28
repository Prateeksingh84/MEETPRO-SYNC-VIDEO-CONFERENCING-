"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getMeeting } from "@/lib/api";
import { Meeting } from "@/lib/types";

function extractMeetingId(value: string) {
  const trimmed = value.trim();

  try {
    const url = new URL(trimmed);
    const fromQuery = url.searchParams.get("meetingId");

    if (fromQuery) return fromQuery;
  } catch {
    // Not a full URL.
  }

  const matched = trimmed.match(/\d{3}-\d{3}-\d{3}/);

  return matched ? matched[0] : trimmed;
}

function JoinContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialMeetingId = searchParams.get("meetingId") || "";

  const [meetingId, setMeetingId] = useState(initialMeetingId);
  const [displayName, setDisplayName] = useState("Prateek Singh");
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!initialMeetingId) return;

    const cleaned = extractMeetingId(initialMeetingId);

    setMeetingId(cleaned);
    setChecking(true);

    getMeeting(cleaned)
      .then((item) => {
        setMeeting(item);
        setError("");
      })
      .catch(() => {
        setMeeting(null);
        setError("This meeting does not exist. Please check the ID or invite link.");
      })
      .finally(() => setChecking(false));
  }, [initialMeetingId]);

  async function submit(event: FormEvent) {
    event.preventDefault();

    const cleanedId = extractMeetingId(meetingId);

    if (!cleanedId || !displayName.trim()) return;

    setChecking(true);
    setError("");

    try {
      await getMeeting(cleanedId);

      router.push(
        `/meeting/${encodeURIComponent(cleanedId)}?name=${encodeURIComponent(displayName.trim())}`,
      );
    } catch {
      setError("Meeting not found. Create a new meeting or verify the invite link.");
    } finally {
      setChecking(false);
    }
  }

  return (
    <main className="join-page">
      <section className="join-card">
        <p className="eyebrow">Join workflow</p>

        <h1>Join Meeting</h1>

        <p>
          Enter a meeting ID or paste a full invite link. The backend validates meeting existence
          before joining.
        </p>

        {meeting && <div className="success-box">Found: {meeting.title}</div>}
        {error && <div className="error-box">{error}</div>}

        <form className="form-stack" onSubmit={submit}>
          <label>
            Meeting ID or Invite Link
            <input
              value={meetingId}
              onChange={(event) => setMeetingId(event.target.value)}
              placeholder="821-419-305 or http://localhost:3000/join?meetingId=821-419-305"
              required
            />
          </label>

          <label>
            Display name
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Your name"
              required
            />
          </label>

          <button className="primary-button" type="submit" disabled={checking}>
            {checking ? "Checking..." : "Join"}
          </button>

          <button className="secondary-button" type="button" onClick={() => router.push("/")}>
            Back to Dashboard
          </button>
        </form>
      </section>
    </main>
  );
}

export default function JoinPage() {
  return (
    <Suspense
      fallback={
        <main className="join-page">
          <section className="join-card">Loading...</section>
        </main>
      }
    >
      <JoinContent />
    </Suspense>
  );
}
