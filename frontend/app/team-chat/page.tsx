"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { DashboardHeader } from "@/components/DashboardHeader";
import { createInstantMeeting, getWsUrl } from "@/lib/api";
import { WorkspaceChatMessage, WorkspaceUser } from "@/lib/types";

type RawWorkspaceUser = {
  clientId?: string;
  client_id?: string;
  id?: string;
  name?: string;
  displayName?: string;
  display_name?: string;
};

type RawWorkspaceMessage = {
  id?: string;
  senderName?: string;
  sender_name?: string;
  name?: string;
  message?: string;
  body?: string;
  createdAt?: string;
  created_at?: string;
};

type CreatedMeetingShape = {
  meeting_id?: string;
  public_id?: string;
  id?: string;
  invite_link?: string;
  inviteLink?: string;
};

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

function getCurrentUserName() {
  if (typeof window === "undefined") return "Guest";

  const keys = ["meetsync-user-v2", "meetsync-auth-v2", "meetsync-user"];

  for (const key of keys) {
    const raw = localStorage.getItem(key);

    if (!raw) continue;

    try {
      const parsed = JSON.parse(raw);
      const name =
        parsed?.name ||
        parsed?.user?.name ||
        parsed?.profile?.name ||
        parsed?.displayName ||
        parsed?.display_name;

      if (typeof name === "string" && name.trim()) {
        return name.trim();
      }
    } catch {
      continue;
    }
  }

  return "Guest";
}

function normalizeUser(user: RawWorkspaceUser, fallbackClientId: string, fallbackName: string) {
  return {
    clientId: user.clientId || user.client_id || user.id || fallbackClientId,
    name: user.name || user.displayName || user.display_name || fallbackName,
  } as WorkspaceUser;
}

function normalizeMessage(
  data: RawWorkspaceMessage,
  fallbackSenderName: string,
): WorkspaceChatMessage {
  return {
    id: data.id || `${Date.now()}-${Math.random()}`,
    senderName: data.senderName || data.sender_name || data.name || fallbackSenderName,
    message: data.message || data.body || "",
    createdAt: data.createdAt || data.created_at || new Date().toISOString(),
  } as WorkspaceChatMessage;
}

export default function TeamChatPage() {
  const socketRef = useRef<WebSocket | null>(null);

  const clientId = useMemo(() => getClientId(), []);
  const displayName = useMemo(() => getCurrentUserName(), []);

  const [connected, setConnected] = useState(false);
  const [users, setUsers] = useState<WorkspaceUser[]>([]);
  const [messages, setMessages] = useState<WorkspaceChatMessage[]>([]);
  const [message, setMessage] = useState("");
  const [huddleLink, setHuddleLink] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const encodedClientId = encodeURIComponent(clientId);
    const encodedDisplayName = encodeURIComponent(displayName);

    const socketPath = `/ws/workspace/team-chat?clientId=${encodedClientId}&client_id=${encodedClientId}&displayName=${encodedDisplayName}&name=${encodedDisplayName}`;

    const ws = new WebSocket(getWsUrl(socketPath));
    socketRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      setError("");

      ws.send(
        JSON.stringify({
          type: "presence",
          clientId,
          name: displayName,
        }),
      );
    };

    ws.onclose = () => {
      setConnected(false);
    };

    ws.onerror = () => {
      setConnected(false);
      setError("Team chat connection failed. Please check backend WebSocket URL.");
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === "workspace-init") {
        setUsers(
          (data.users || []).map((user: RawWorkspaceUser) =>
            normalizeUser(user, clientId, displayName),
          ),
        );

        setMessages(
          (data.messages || []).map((item: RawWorkspaceMessage) =>
            normalizeMessage(item, displayName),
          ),
        );

        return;
      }

      if (data.type === "presence") {
        if (Array.isArray(data.users)) {
          setUsers(
            data.users.map((user: RawWorkspaceUser) =>
              normalizeUser(user, clientId, displayName),
            ),
          );
          return;
        }

        const user = normalizeUser(data, clientId, displayName);

        setUsers((old) => {
          const exists = old.some((item) => item.clientId === user.clientId);

          if (exists) {
            return old.map((item) => (item.clientId === user.clientId ? user : item));
          }

          return [user, ...old];
        });

        return;
      }

      if (data.type === "chat-message") {
        const rawMessage =
          typeof data.message === "object" && data.message !== null
            ? data.message
            : {
                ...data,
                message: data.message,
              };

        setMessages((old) => [...old, normalizeMessage(rawMessage, displayName)]);
      }
    };

    return () => {
      ws.close();
    };
  }, [clientId, displayName]);

  function sendMessage(event: FormEvent) {
    event.preventDefault();

    const body = message.trim();

    if (!body || socketRef.current?.readyState !== WebSocket.OPEN) return;

    socketRef.current.send(
      JSON.stringify({
        type: "chat-message",
        id: `${Date.now()}-${Math.random()}`,
        clientId,
        senderName: displayName,
        message: body,
        createdAt: new Date().toISOString(),
      }),
    );

    setMessage("");
  }

  async function startHuddle() {
    try {
      const createdMeeting = (await createInstantMeeting(displayName)) as CreatedMeetingShape;

      const meetingId =
        createdMeeting.meeting_id || createdMeeting.public_id || createdMeeting.id || "";

      if (!meetingId) {
        throw new Error("Meeting ID missing from backend response");
      }

      const meetingPath = `/meeting/${meetingId}?name=${encodeURIComponent(displayName)}`;
      const absoluteMeetingLink =
        typeof window !== "undefined" ? `${window.location.origin}${meetingPath}` : meetingPath;

      setHuddleLink(meetingPath);

      socketRef.current?.send(
        JSON.stringify({
          type: "chat-message",
          id: `${Date.now()}-${Math.random()}`,
          clientId,
          senderName: displayName,
          message: `Started a live huddle: ${
            createdMeeting.invite_link || createdMeeting.inviteLink || absoluteMeetingLink
          }`,
          createdAt: new Date().toISOString(),
        }),
      );
    } catch {
      setError("Could not start live huddle. Please check backend API connection.");
    }
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

        {error && <div className="error-box">{error}</div>}

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

              {!messages.length && (
                <div className="empty-state">No messages yet. Send the first one.</div>
              )}
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



