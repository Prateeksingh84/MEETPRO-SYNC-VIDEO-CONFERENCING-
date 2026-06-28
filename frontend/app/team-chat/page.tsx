"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { DashboardHeader } from "@/components/DashboardHeader";
import { createInstantMeeting } from "@/lib/api";
import { WorkspaceChatMessage, WorkspaceUser } from "@/lib/types";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  "http://localhost:8000";

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

function buildWorkspaceWsUrl(roomId: string, clientId: string, displayName: string) {
  const cleanBase = API_BASE.replace(/\/$/, "");
  const wsBase = cleanBase.startsWith("https://")
    ? cleanBase.replace("https://", "wss://")
    : cleanBase.replace("http://", "ws://");

  const encodedRoomId = encodeURIComponent(roomId);
  const encodedClientId = encodeURIComponent(clientId);
  const encodedName = encodeURIComponent(displayName);

  return `${wsBase}/ws/workspace/${encodedRoomId}?client_id=${encodedClientId}&clientId=${encodedClientId}&name=${encodedName}&displayName=${encodedName}`;
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

  const [connected, setConnected] = useState(false);
  const [users, setUsers] = useState<WorkspaceUser[]>([]);
  const [messages, setMessages] = useState<WorkspaceChatMessage[]>([]);
  const [message, setMessage] = useState("");
  const [huddleLink, setHuddleLink] = useState("");
  const [error, setError] = useState("");
  const [clientId, setClientId] = useState("server-client");
  const [displayName, setDisplayName] = useState("Guest");

  useEffect(() => {
    const resolvedClientId = getClientId();
    const resolvedName = getCurrentUserName();

    setClientId(resolvedClientId);
    setDisplayName(resolvedName);

    const ws = new WebSocket(buildWorkspaceWsUrl("team-chat", resolvedClientId, resolvedName));
    socketRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      setError("");

      ws.send(
        JSON.stringify({
          type: "presence",
          client_id: resolvedClientId,
          clientId: resolvedClientId,
          name: resolvedName,
          displayName: resolvedName,
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
            normalizeUser(user, resolvedClientId, resolvedName),
          ),
        );

        setMessages(
          (data.messages || []).map((item: RawWorkspaceMessage) =>
            normalizeMessage(item, resolvedName),
          ),
        );

        return;
      }

      if (data.type === "presence") {
        if (Array.isArray(data.users)) {
          setUsers(
            data.users.map((user: RawWorkspaceUser) =>
              normalizeUser(user, resolvedClientId, resolvedName),
            ),
          );
          return;
        }

        const user = normalizeUser(data, resolvedClientId, resolvedName);

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

        setMessages((old) => [...old, normalizeMessage(rawMessage, resolvedName)]);
      }
    };

    return () => {
      ws.close();
    };
  }, []);

  function sendMessage(event: FormEvent) {
    event.preventDefault();

    const body = message.trim();

    if (!body || socketRef.current?.readyState !== WebSocket.OPEN) return;

    socketRef.current.send(
      JSON.stringify({
        type: "chat-message",
        id: `${Date.now()}-${Math.random()}`,
        client_id: clientId,
        clientId,
        senderName: displayName,
        sender_name: displayName,
        name: displayName,
        message: body,
        createdAt: new Date().toISOString(),
      }),
    );

    setMessage("");
  }

  async function startHuddle() {
    try {
      const createdMeeting = (await createInstantMeeting(displayName)) as unknown as CreatedMeetingShape;

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
          client_id: clientId,
          clientId,
          senderName: displayName,
          sender_name: displayName,
          name: displayName,
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
