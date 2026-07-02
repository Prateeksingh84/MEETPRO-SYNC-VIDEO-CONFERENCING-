"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type AgentAction = {
  label: string;
  href?: string;
};

type AgentMessage = {
  id: string;
  sender: "bot" | "user";
  text: string;
  time: string;
  actions?: AgentAction[];
};

const QUICK_ACTIONS = [
  "Upgrade to Pro",
  "Join a Meeting",
  "I can't find my Meetings",
  "What MeetSync plan is right for me?",
  "I'm interested in a MeetSync Phone plan",
  "Ask a question",
];

function formatTime() {
  return new Date().toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function createBotResponse(input: string): Omit<AgentMessage, "id" | "time"> {
  const normalized = input.toLowerCase().trim();

  if (normalized.includes("upgrade") || normalized.includes("pro") || normalized.includes("pricing") || normalized.includes("plan")) {
    return {
      sender: "bot",
      text: "MeetSync Pro offers advanced meetings, better collaboration controls, recordings, and productivity workflows. You can review plans and choose what fits your team.",
      actions: [
        { label: "View plans", href: "/settings" },
        { label: "Contact sales", href: "/enterprise" },
      ],
    };
  }

  if (normalized.includes("join") || normalized.includes("meeting")) {
    return {
      sender: "bot",
      text: "You can join a meeting using a meeting link or meeting ID. I can take you directly to the join page.",
      actions: [
        { label: "Join a meeting", href: "/join" },
        { label: "Go to dashboard", href: "/dashboard" },
      ],
    };
  }

  if (normalized.includes("record") || normalized.includes("recording")) {
    return {
      sender: "bot",
      text: "Recording is available inside the meeting room. Start a meeting, then use the Record control in the call interface.",
      actions: [
        { label: "Open dashboard", href: "/dashboard" },
      ],
    };
  }

  if (normalized.includes("chat")) {
    return {
      sender: "bot",
      text: "Team chat is available as a live workspace feature. You can open it to message teammates in real time.",
      actions: [
        { label: "Open team chat", href: "/team-chat" },
      ],
    };
  }

  if (normalized.includes("whiteboard")) {
    return {
      sender: "bot",
      text: "MeetSync Whiteboards let you collaborate visually in real time. Open the whiteboard workspace to start drawing and sharing ideas.",
      actions: [
        { label: "Open whiteboards", href: "/whiteboards" },
      ],
    };
  }

  if (normalized.includes("phone")) {
    return {
      sender: "bot",
      text: "MeetSync Phone can be positioned as a business communication extension for voice workflows, support, and contact teams.",
      actions: [
        { label: "Explore workspace", href: "/dashboard" },
        { label: "Contact sales", href: "/enterprise" },
      ],
    };
  }

  if (normalized.includes("support") || normalized.includes("help") || normalized.includes("issue")) {
    return {
      sender: "bot",
      text: "I can help you navigate meetings, chat, whiteboards, recordings, plans, and workspace settings. Tell me what you need or open the relevant area directly.",
      actions: [
        { label: "Open dashboard", href: "/dashboard" },
        { label: "Open settings", href: "/settings" },
      ],
    };
  }

  return {
    sender: "bot",
    text: "Thanks for your message. I can help with meetings, joining links, recordings, plans, chat, whiteboards, and workspace navigation.",
    actions: [
      { label: "Open dashboard", href: "/dashboard" },
      { label: "Join a meeting", href: "/join" },
    ],
  };
}

export function MeetSyncVirtualAgent() {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [messages, setMessages] = useState<AgentMessage[]>([
    {
      id: crypto.randomUUID(),
      sender: "bot",
      text: "Hi there! I’m MeetSync Pro’s Virtual Agent.",
      time: formatTime(),
    },
    {
      id: crypto.randomUUID(),
      sender: "bot",
      text: "How can I help?",
      time: formatTime(),
    },
  ]);

  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open, isTyping]);

  const quickActions = useMemo(() => QUICK_ACTIONS, []);

  function sendBotReply(input: string) {
    setIsTyping(true);

    const botReplyBase = createBotResponse(input);

    window.setTimeout(() => {
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          sender: "bot",
          text: botReplyBase.text,
          actions: botReplyBase.actions,
          time: formatTime(),
        },
      ]);

      setIsTyping(false);
    }, 550);
  }

  function handleUserMessage(text: string) {
    const value = text.trim();
    if (!value) return;

    setMessages((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        sender: "user",
        text: value,
        time: formatTime(),
      },
    ]);

    sendBotReply(value);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const value = draft.trim();
    if (!value) return;

    handleUserMessage(value);
    setDraft("");
  }

  function handleQuickAction(action: string) {
    setOpen(true);
    handleUserMessage(action);
  }

  return (
    <>
      <button
        type="button"
        className="meetsync-agent-launcher"
        onClick={() => setOpen((prev) => !prev)}
        aria-label={open ? "Close MeetSync Pro virtual agent" : "Open MeetSync Pro virtual agent"}
      >
        <span className="meetsync-agent-launcher-dot" />
      </button>

      {open && (
        <section className="meetsync-agent-panel" aria-label="MeetSync Pro Virtual Agent">
          <header className="meetsync-agent-header">
            <div>
              <strong>MeetSync Pro Virtual Agent</strong>
              <p>Live product help and navigation assistant</p>
            </div>

            <div className="meetsync-agent-header-actions">
              <button type="button" aria-label="More options">
                ⋯
              </button>
              <button type="button" aria-label="Close virtual agent" onClick={() => setOpen(false)}>
                ×
              </button>
            </div>
          </header>

          <div className="meetsync-agent-body">
            <div className="meetsync-agent-chat">
              {messages.map((message) => (
                <article
                  key={message.id}
                  className={`meetsync-agent-message ${message.sender === "user" ? "user" : "bot"}`}
                >
                  {message.sender === "bot" && <div className="meetsync-agent-avatar">MS</div>}

                  <div className="meetsync-agent-bubble-wrap">
                    <div className="meetsync-agent-meta">
                      <span>{message.sender === "bot" ? "MSA" : "You"}</span>
                      <small>{message.time}</small>
                    </div>

                    <div className="meetsync-agent-bubble">
                      <p>{message.text}</p>

                      {message.actions && message.actions.length > 0 && (
                        <div className="meetsync-agent-inline-actions">
                          {message.actions.map((action, index) =>
                            action.href ? (
                              <a key={`${message.id}-${index}`} href={action.href}>
                                {action.label}
                              </a>
                            ) : (
                              <button
                                key={`${message.id}-${index}`}
                                type="button"
                                onClick={() => handleQuickAction(action.label)}
                              >
                                {action.label}
                              </button>
                            ),
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              ))}

              {isTyping && (
                <article className="meetsync-agent-message bot">
                  <div className="meetsync-agent-avatar">MS</div>
                  <div className="meetsync-agent-bubble-wrap">
                    <div className="meetsync-agent-meta">
                      <span>MSA</span>
                      <small>{formatTime()}</small>
                    </div>
                    <div className="meetsync-agent-bubble typing">
                      <span />
                      <span />
                      <span />
                    </div>
                  </div>
                </article>
              )}

              <div ref={bottomRef} />
            </div>

            <div className="meetsync-agent-quick-actions">
              {quickActions.map((action) => (
                <button key={action} type="button" onClick={() => handleQuickAction(action)}>
                  {action}
                </button>
              ))}
            </div>
          </div>

          <form className="meetsync-agent-form" onSubmit={handleSubmit}>
            <input
              type="text"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Write a message"
              aria-label="Write a message"
            />
            <button type="submit">Send</button>
          </form>

          <footer className="meetsync-agent-footer">
            MeetSync Pro may retain support transcripts to improve product quality and user assistance.
          </footer>
        </section>
      )}
    </>
  );
}
