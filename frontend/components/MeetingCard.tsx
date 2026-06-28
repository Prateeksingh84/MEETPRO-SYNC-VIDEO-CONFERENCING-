"use client";

import Link from "next/link";
import { Meeting } from "@/lib/types";

function formatMeetingTime(value?: string | null) {
  if (!value) return "Instant meeting";

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function MeetingCard({
  meeting,
  compact = false,
}: {
  meeting: Meeting;
  compact?: boolean;
}) {
  async function copyInvite() {
    await navigator.clipboard.writeText(meeting.invite_link);
    alert("Invite link copied");
  }

  return (
    <article className={compact ? "meeting-card compact" : "meeting-card"}>
      <div>
        <p className="meeting-type">{meeting.meeting_type}</p>

        <h3>{meeting.title}</h3>

        <p>{meeting.description || "No description added."}</p>

        <span>{formatMeetingTime(meeting.start_time)}</span>
      </div>

      <div className="meeting-card-actions">
        <Link className="primary-button" href={`/meeting/${meeting.meeting_id}`}>
          Start
        </Link>

        <button className="secondary-button" type="button" onClick={copyInvite}>
          Copy Invite
        </button>
      </div>
    </article>
  );
}
