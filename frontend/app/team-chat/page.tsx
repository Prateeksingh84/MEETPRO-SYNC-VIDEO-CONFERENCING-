"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { DashboardHeader } from "@/components/DashboardHeader";
import { createInstantMeeting, getWorkspaceWsUrl } from "@/lib/api";
import { WorkspaceChatMessage, WorkspaceUser } from "@/lib/types";

function getClientId() {
  if (typeof window === "undefined") return "server-client";

  const key = "meetsync-client-id";
  let value = sessionStorage.getItem(key);

  if (!value) {
    value = crypto.randomUUID();
    sessionStorage.setItem(key, value);
  }

  return value;
}

export default function TeamChatPage() {
  const socketRef = useRef<WebSocket | null>(null);

  const [connected, setConnected] = useState(false);
  const [users, setUsers] = useState<WorkspaceUser[]>([]);
  const [messages, setMessages] = useState<WorkspaceChatMessage[]>([]);
  const [message, setMessage] = useState("");
  const [huddleLink, setHuddleLink] = useState("");

  useEffect(() => {
    const ws = new WebSocket(getWorkspaceWsUrl("team-chat", getClientId(), "Prateek Singh"));
    socketRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === "workspace-init") {
        setUsers(data.users || []);
        setMessages(data.messages || []);
      }

      if (data.type === "presence") {
        setUsers(data.users || []);
      }

      if (data.type === "chat-message") {
        setMessages((old) => [...old, data.message]);
      }
    };

    return () => ws.close();
  }, []);

  function sendMessage(event: FormEvent) {
    event.preventDefault();

    const body = message.trim();

    if (!body || socketRef.current?.readyState !== WebSocket.OPEN) return;

    socketRef.current.send(
      JSON.stringify({
        type: "chat-message",
        message: body,
      }),
    );

    setMessage("");
  }

  async function startHuddle() {
    const meeting = await createInstantMeeting("Prateek Singh");

    setHuddleLink(`/meeting/${meeting.meeting_id}`);

    socketRef.current?.send(
      JSON.stringify({
        type: "chat-message",
        message: `Started a live huddle: ${meeting.invite_link}`,
      }),
    );
  }

  return (
    <main className="dashboard-page">
      <DashboardHeader />

      <section className="workspace-page">
        <div className="workspace-title-row">
          <div>
            <p className="eyebrow">Real-time workspace</p>
            <h2>Team Chat</h2>
            <p>Send live messages, see online teammates, and start instant meeting huddles.</p>
          </div>

          <button className="primary-button" onClick={startHuddle}>
            Start live huddle
          </button>
        </div>

        {huddleLink && (
          <div className="success-box">
            Huddle created. <Link href={huddleLink}>Open meeting room</Link>
          </div>
        )}

        <div className="workspace-grid">
          <aside className="workspace-card">
            <div className="section-title">
              <h2>Online now</h2>
              <span>{connected ? "Live" : "Offline"}</span>
            </div>

            <div className="live-user-list">
              {users.map((user) => (
                <div className="live-user" key={user.clientId}>
                  <span className="status-dot" />

                  <div>
                    <strong>{user.name}</strong>
                    <small>Connected to Team Chat</small>
                  </div>
                </div>
              ))}

              {!users.length && <div className="empty-state">Connecting users...</div>}
            </div>
          </aside>

          <section className="workspace-card chat-workspace-card">
            <div className="section-title">
              <h2>Messages</h2>
              <span>{messages.length} messages</span>
            </div>

            <div className="workspace-chat-list">
              {messages.map((item) => (
                <div className="workspace-message" key={item.id}>
                  <strong>{item.senderName}</strong>
                  <small>{new Date(item.createdAt).toLocaleTimeString()}</small>
                  <p>{item.message}</p>
                </div>
              ))}

              {!messages.length && <div className="empty-state">No messages yet. Send the first one.</div>}
            </div>

            <form className="workspace-chat-form" onSubmit={sendMessage}>
              <input
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Type a real-time team message..."
              />

              <button type="submit">Send</button>
            </form>
          </section>
        </div>
      </section>
    </main>
  );
}
