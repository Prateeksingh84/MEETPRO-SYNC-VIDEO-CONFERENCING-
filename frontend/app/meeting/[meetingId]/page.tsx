"use client";

import { FormEvent, Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { getWsUrl, joinMeeting, leaveMeeting } from "@/lib/api";
import { ChatMessage, Meeting, RoomParticipant } from "@/lib/types";
import { MeetingRecorder } from "@/components/MeetingRecorder";

type JoinedParticipantShape = {
  public_id?: string;
  publicId?: string;
  id?: string;
  participant_id?: string;
  display_name?: string;
  displayName?: string;
  is_host?: boolean;
  isHost?: boolean;
  is_muted?: boolean;
  isMuted?: boolean;
  camera_on?: boolean;
  cameraOn?: boolean;
};

type ActivePanel = "participants" | "chat" | "recording" | "host-tools" | "ai" | "more" | null;
type ViewMode = "speaker" | "gallery";

function RemoteVideo({ stream, name }: { stream: MediaStream; name: string }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="zoom-native-video-tile">
      <video ref={videoRef} autoPlay playsInline />
      <div className="zoom-native-name-badge">{name}</div>
    </div>
  );
}

function MeetingRoomContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const meetingId = Array.isArray(params.meetingId)
    ? params.meetingId[0]
    : String(params.meetingId);

  const displayName = searchParams.get("name")?.trim() || "Guest";

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const participantIdRef = useRef("");
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Record<string, RTCPeerConnection>>({});

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [participants, setParticipants] = useState<RoomParticipant[]>([]);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isHost, setIsHost] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [cameraOn, setCameraOn] = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState("");
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("speaker");
  const [copied, setCopied] = useState(false);
  const [mediaPermissionDenied, setMediaPermissionDenied] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function initialize() {
      try {
        const join = await joinMeeting(meetingId, displayName);

        if (!mounted) return;

        const joinedParticipant = join.participant as JoinedParticipantShape;

        const joinedParticipantId =
          joinedParticipant.public_id ||
          joinedParticipant.publicId ||
          joinedParticipant.id ||
          joinedParticipant.participant_id ||
          "";

        if (!joinedParticipantId) {
          throw new Error("Participant ID missing from join response");
        }

        const joinedIsHost = Boolean(joinedParticipant.is_host ?? joinedParticipant.isHost);
        const joinedIsMuted = Boolean(joinedParticipant.is_muted ?? joinedParticipant.isMuted);
        const joinedCameraOn = Boolean(
          joinedParticipant.camera_on ?? joinedParticipant.cameraOn ?? true,
        );

        participantIdRef.current = joinedParticipantId;

        setMeeting(join.meeting);
        setIsHost(joinedIsHost);
        setIsMuted(joinedIsMuted);
        setCameraOn(joinedCameraOn);

        await startInitialMedia();

        connectSocket(joinedParticipantId, joinedIsHost);
      } catch {
        setError("Could not join meeting. Please verify the meeting ID.");
      }
    }

    initialize();

    return () => {
      mounted = false;

      if (participantIdRef.current) {
        leaveMeeting(meetingId, participantIdRef.current).catch(() => undefined);
      }

      socketRef.current?.close();

      Object.values(peerConnectionsRef.current).forEach((pc) => pc.close());
      peerConnectionsRef.current = {};

      localStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetingId, displayName]);

  async function startInitialMedia() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      });

      localStreamRef.current = stream;
      setMediaPermissionDenied(false);

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
    } catch {
      setMediaPermissionDenied(true);
      setCameraOn(false);
      setIsMuted(true);
      setError("Camera/microphone permission denied. You can still join with chat.");
    }
  }

  async function ensureTrack(kind: "audio" | "video") {
    const existingTrack =
      kind === "audio"
        ? localStreamRef.current?.getAudioTracks()[0]
        : localStreamRef.current?.getVideoTracks()[0];

    if (existingTrack) return true;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: kind === "audio",
        video: kind === "video",
      });

      const track = kind === "audio" ? stream.getAudioTracks()[0] : stream.getVideoTracks()[0];

      if (!track) return false;

      if (!localStreamRef.current) {
        localStreamRef.current = new MediaStream();
      }

      localStreamRef.current.addTrack(track);

      Object.values(peerConnectionsRef.current).forEach((pc) => {
        if (localStreamRef.current) {
          pc.addTrack(track, localStreamRef.current);
        }
      });

      if (localVideoRef.current && localStreamRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }

      setMediaPermissionDenied(false);
      return true;
    } catch {
      setMediaPermissionDenied(true);
      setError(`${kind === "audio" ? "Microphone" : "Camera"} permission denied.`);
      return false;
    }
  }

  function connectSocket(participantId: string, host: boolean) {
    const encodedParticipantId = encodeURIComponent(participantId);
    const encodedName = encodeURIComponent(displayName);

    const socketPath = `/ws/meetings/${encodeURIComponent(
      meetingId,
    )}?participantId=${encodedParticipantId}&participant_id=${encodedParticipantId}&displayName=${encodedName}&name=${encodedName}&isHost=${
      host ? "true" : "false"
    }&is_host=${host ? "true" : "false"}`;

    const ws = new WebSocket(getWsUrl(socketPath));
    socketRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setError("Real-time meeting connection failed. Please refresh the room.");

    ws.onmessage = async (event) => {
      const data = JSON.parse(event.data);

      if (data.type === "existing-participants") {
        setParticipants(data.roomParticipants || []);

        for (const participant of data.participants || []) {
          if (participant.participantId !== participantId) {
            await createOffer(participant.participantId);
          }
        }
      }

      if (data.type === "participant-joined") {
        setParticipants((old) => {
          const exists = old.some((p) => p.participantId === data.participant.participantId);
          if (exists) return old;
          return [...old, data.participant];
        });
      }

      if (data.type === "participant-left") {
        removePeer(data.participantId);
        setParticipants(data.roomParticipants || []);
      }

      if (data.type === "webrtc-offer") {
        await handleOffer(data.fromId, data.offer);
      }

      if (data.type === "webrtc-answer") {
        await handleAnswer(data.fromId, data.answer);
      }

      if (data.type === "webrtc-ice-candidate") {
        await handleIceCandidate(data.fromId, data.candidate);
      }

      if (data.type === "media-state") {
        setParticipants((old) =>
          old.map((item) =>
            item.participantId === data.participantId
              ? {
                  ...item,
                  isMuted: data.isMuted,
                  cameraOn: data.cameraOn,
                }
              : item,
          ),
        );
      }

      if (data.type === "chat-message") {
        const normalizedMessage = {
          ...data,
          id: data.id || `${Date.now()}-${Math.random()}`,
          senderName: data.senderName || data.sender_name || displayName,
          message: data.message || "",
        } as ChatMessage;

        setMessages((old) => [...old, normalizedMessage]);
      }

      if (data.type === "mute-all") {
        muteFromHost();
      }

      if (data.type === "removed") {
        alert(data.reason || "You were removed from the meeting.");
        router.push("/");
      }
    };
  }

  function createPeerConnection(remoteParticipantId: string) {
    const existing = peerConnectionsRef.current[remoteParticipantId];

    if (existing) return existing;

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    localStreamRef.current?.getTracks().forEach((track) => {
      if (localStreamRef.current) {
        pc.addTrack(track, localStreamRef.current);
      }
    });

    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(
          JSON.stringify({
            type: "webrtc-ice-candidate",
            targetId: remoteParticipantId,
            candidate: event.candidate,
          }),
        );
      }
    };

    pc.ontrack = (event) => {
      const [stream] = event.streams;

      if (stream) {
        setRemoteStreams((old) => ({
          ...old,
          [remoteParticipantId]: stream,
        }));
      }
    };

    peerConnectionsRef.current[remoteParticipantId] = pc;

    return pc;
  }

  async function createOffer(remoteParticipantId: string) {
    const pc = createPeerConnection(remoteParticipantId);

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    socketRef.current?.send(
      JSON.stringify({
        type: "webrtc-offer",
        targetId: remoteParticipantId,
        offer,
      }),
    );
  }

  async function handleOffer(fromId: string, offer: RTCSessionDescriptionInit) {
    const pc = createPeerConnection(fromId);

    await pc.setRemoteDescription(new RTCSessionDescription(offer));

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    socketRef.current?.send(
      JSON.stringify({
        type: "webrtc-answer",
        targetId: fromId,
        answer,
      }),
    );
  }

  async function handleAnswer(fromId: string, answer: RTCSessionDescriptionInit) {
    const pc = peerConnectionsRef.current[fromId];

    if (!pc) return;

    await pc.setRemoteDescription(new RTCSessionDescription(answer));
  }

  async function handleIceCandidate(fromId: string, candidate: RTCIceCandidateInit) {
    const pc = peerConnectionsRef.current[fromId];

    if (!pc || !candidate) return;

    await pc.addIceCandidate(new RTCIceCandidate(candidate));
  }

  function removePeer(participantId: string) {
    peerConnectionsRef.current[participantId]?.close();
    delete peerConnectionsRef.current[participantId];

    setRemoteStreams((old) => {
      const copy = { ...old };
      delete copy[participantId];
      return copy;
    });
  }

  function sendMediaState(nextMuted: boolean, nextCameraOn: boolean) {
    socketRef.current?.send(
      JSON.stringify({
        type: "media-state",
        isMuted: nextMuted,
        cameraOn: nextCameraOn,
      }),
    );
  }

  async function toggleMute() {
    if (isMuted) {
      const ready = await ensureTrack("audio");
      if (!ready) return;
    }

    const next = !isMuted;

    localStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !next;
    });

    setIsMuted(next);
    sendMediaState(next, cameraOn);
  }

  async function toggleCamera() {
    if (!cameraOn) {
      const ready = await ensureTrack("video");
      if (!ready) return;
    }

    const next = !cameraOn;

    localStreamRef.current?.getVideoTracks().forEach((track) => {
      track.enabled = next;
    });

    setCameraOn(next);
    sendMediaState(isMuted, next);
  }

  function muteFromHost() {
    localStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = false;
    });

    setIsMuted(true);
    sendMediaState(true, cameraOn);
  }

  async function toggleScreenShare() {
    if (screenSharing) return;

    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });

      const screenTrack = displayStream.getVideoTracks()[0];

      Object.values(peerConnectionsRef.current).forEach((pc) => {
        const sender = pc.getSenders().find((item) => item.track?.kind === "video");

        if (sender) {
          sender.replaceTrack(screenTrack);
        }
      });

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = displayStream;
      }

      setScreenSharing(true);

      screenTrack.onended = () => {
        const cameraTrack = localStreamRef.current?.getVideoTracks()[0];

        Object.values(peerConnectionsRef.current).forEach((pc) => {
          const sender = pc.getSenders().find((item) => item.track?.kind === "video");

          if (sender && cameraTrack) {
            sender.replaceTrack(cameraTrack);
          }
        });

        if (localVideoRef.current && localStreamRef.current) {
          localVideoRef.current.srcObject = localStreamRef.current;
        }

        setScreenSharing(false);
      };
    } catch {
      setError("Screen sharing cancelled or unavailable.");
    }
  }

  function sendChat(event: FormEvent) {
    event.preventDefault();

    const body = chatInput.trim();

    if (!body || socketRef.current?.readyState !== WebSocket.OPEN) return;

    socketRef.current.send(
      JSON.stringify({
        type: "chat",
        message: body,
      }),
    );

    setChatInput("");
  }

  function sendQuickReaction(reaction: string) {
    if (socketRef.current?.readyState !== WebSocket.OPEN) return;

    socketRef.current.send(
      JSON.stringify({
        type: "chat",
        message: `${reaction}`,
      }),
    );

    setActivePanel("chat");
  }

  function muteAll() {
    socketRef.current?.send(
      JSON.stringify({
        type: "mute-all",
      }),
    );
  }

  function removeParticipant(targetId: string) {
    socketRef.current?.send(
      JSON.stringify({
        type: "remove-participant",
        targetId,
      }),
    );
  }

  async function copyInvite() {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  async function handleLeave() {
    if (participantIdRef.current) {
      await leaveMeeting(meetingId, participantIdRef.current).catch(() => undefined);
    }

    router.push("/dashboard");
  }

  function togglePanel(panel: ActivePanel) {
    setActivePanel((current) => (current === panel ? null : panel));
  }

  const remoteEntries = Object.entries(remoteStreams);
  const visibleParticipantCount = Math.max(participants.length, 1);
  const localInitial = displayName.charAt(0).toUpperCase() || "U";

  return (
    <main className="meeting-room-page zoom-native-shell">
      <header className="zoom-native-topbar">
        <div className="zoom-native-workplace">
          <span>meet</span>
          <strong>MeetSync Workplace</strong>
        </div>

        <div className="zoom-native-top-right">
          <button className="zoom-native-security" title="Secure meeting">
            🛡️
          </button>

          <button
            className="zoom-native-view-button"
            onClick={() => setViewMode((mode) => (mode === "speaker" ? "gallery" : "speaker"))}
          >
            ▦ View
          </button>

          <button className="zoom-native-profile">{localInitial}</button>
        </div>
      </header>

      {error && <div className="zoom-native-toast">{error}</div>}
      {copied && <div className="zoom-native-copy-toast">Invite link copied</div>}

      <section className={activePanel ? "zoom-native-room has-panel" : "zoom-native-room"}>
        <section className={viewMode === "gallery" ? "zoom-native-stage gallery" : "zoom-native-stage"}>
          <div className="zoom-native-local-name">
            <span>{isMuted ? "🔇" : "🎤"}</span>
            {displayName.toUpperCase()} {isHost ? "(HOST)" : ""}
          </div>

          <div className="zoom-native-main-grid">
            <div className="zoom-native-video-tile zoom-native-local-tile">
              <video ref={localVideoRef} autoPlay playsInline muted />
              {(!cameraOn || mediaPermissionDenied) && (
                <div className="zoom-native-avatar-tile">
                  <div>{localInitial}</div>
                </div>
              )}
              <div className="zoom-native-name-badge">
                {displayName} {isHost ? "(Host)" : ""} {isMuted ? "• Muted" : ""}
              </div>
            </div>

            {remoteEntries.map(([participantId, stream]) => {
              const participant = participants.find((item) => item.participantId === participantId);

              return (
                <RemoteVideo
                  key={participantId}
                  stream={stream}
                  name={participant?.displayName || "Participant"}
                />
              );
            })}

            {!remoteEntries.length && (
              <div className="zoom-native-waiting-card">
                <div className="zoom-native-waiting-avatar">👥</div>
                <strong>Waiting for others to join...</strong>
                <p>Share the meeting link or open this room in another tab/window to test real-time WebRTC.</p>
              </div>
            )}
          </div>
        </section>

        {activePanel && (
          <aside className="zoom-native-drawer">
            <div className="zoom-native-drawer-header">
              <strong>
                {activePanel === "participants" && "Participants"}
                {activePanel === "chat" && "Meeting Chat"}
                {activePanel === "recording" && "Recording"}
                {activePanel === "host-tools" && "Host Tools"}
                {activePanel === "ai" && "Meet AI"}
                {activePanel === "more" && "More"}
              </strong>
              <button onClick={() => setActivePanel(null)}>×</button>
            </div>

            {activePanel === "participants" && (
              <div className="zoom-native-panel-body">
                <div className="zoom-native-panel-meta">
                  <span>{visibleParticipantCount} participant(s)</span>
                  <span>{connected ? "Live" : "Offline"}</span>
                </div>

                <div className="zoom-native-participant">
                  <div className="zoom-native-participant-avatar">{localInitial}</div>
                  <div>
                    <strong>{displayName} {isHost ? "(Host)" : ""}</strong>
                    <small>{isMuted ? "Muted" : "Audio on"} • {cameraOn ? "Video on" : "Video off"}</small>
                  </div>
                </div>

                {participants
                  .filter((participant) => participant.participantId !== participantIdRef.current)
                  .map((participant) => (
                    <div className="zoom-native-participant" key={participant.participantId}>
                      <div className="zoom-native-participant-avatar">
                        {participant.displayName?.charAt(0)?.toUpperCase() || "U"}
                      </div>
                      <div>
                        <strong>{participant.displayName}</strong>
                        <small>
                          {participant.isHost ? "Host" : "Guest"} •{" "}
                          {participant.isMuted ? "Muted" : "Audio on"} •{" "}
                          {participant.cameraOn ? "Video on" : "Video off"}
                        </small>
                      </div>

                      {isHost && (
                        <button onClick={() => removeParticipant(participant.participantId)}>
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
              </div>
            )}

            {activePanel === "chat" && (
              <div className="zoom-native-chat-panel">
                <div className="zoom-native-chat-list">
                  {messages.map((message) => (
                    <div className="zoom-native-chat-message" key={message.id}>
                      <strong>{message.senderName}</strong>
                      <p>{message.message}</p>
                    </div>
                  ))}

                  {!messages.length && (
                    <div className="zoom-native-empty">No messages yet. Send the first message.</div>
                  )}
                </div>

                <form className="zoom-native-chat-form" onSubmit={sendChat}>
                  <input
                    value={chatInput}
                    onChange={(event) => setChatInput(event.target.value)}
                    placeholder="Message everyone..."
                  />
                  <button>Send</button>
                </form>
              </div>
            )}

            {activePanel === "recording" && (
              <div className="zoom-native-recording-panel">
                <MeetingRecorder meetingId={meetingId} />
              </div>
            )}

            {activePanel === "host-tools" && (
              <div className="zoom-native-panel-body">
                <button className="zoom-native-host-action" onClick={muteAll}>
                  🔇 Mute all participants
                </button>
                <button className="zoom-native-host-action" onClick={copyInvite}>
                  🔗 Copy meeting invite
                </button>
                <button className="zoom-native-host-action" onClick={() => setActivePanel("participants")}>
                  👥 Manage participants
                </button>
                <div className="zoom-native-info-box">
                  Host privacy note: for production, lock meeting, waiting room approvals, audit logs,
                  and recording consent should be enforced from backend policy.
                </div>
              </div>
            )}

            {activePanel === "ai" && (
              <div className="zoom-native-panel-body">
                <div className="zoom-native-ai-card">
                  <span>✨</span>
                  <h3>Meet AI Assistant</h3>
                  <p>
                    AI meeting summary, action items, transcript search, and smart recording can be
                    connected after transcription and user-consent workflows are added.
                  </p>
                </div>

                <div className="zoom-native-info-box">
                  Current status: AI-ready UI placeholder. No private meeting content is sent to an AI
                  service until backend transcription and consent are implemented.
                </div>
              </div>
            )}

            {activePanel === "more" && (
              <div className="zoom-native-panel-body">
                <button className="zoom-native-host-action" onClick={copyInvite}>
                  🔗 Copy invite link
                </button>
                <button className="zoom-native-host-action" onClick={() => setViewMode("speaker")}>
                  🎥 Speaker view
                </button>
                <button className="zoom-native-host-action" onClick={() => setViewMode("gallery")}>
                  ▦ Gallery view
                </button>
                <Link className="zoom-native-more-link" href="/security">
                  🛡️ Security Center
                </Link>
                <Link className="zoom-native-more-link" href="/privacy">
                  🔐 Privacy Center
                </Link>
              </div>
            )}
          </aside>
        )}
      </section>

      <nav className="zoom-native-toolbar">
        <button className={isMuted ? "danger" : ""} onClick={toggleMute}>
          <span>{isMuted ? "🎙️" : "🎤"}</span>
          {isMuted ? "Unmute" : "Mute"}
        </button>

        <button className={!cameraOn ? "danger" : ""} onClick={toggleCamera}>
          <span>{cameraOn ? "🎥" : "📷"}</span>
          {cameraOn ? "Video" : "Start Video"}
        </button>

        <button className={activePanel === "participants" ? "active" : ""} onClick={() => togglePanel("participants")}>
          <span>👥</span>
          Participants
          <em>{visibleParticipantCount}</em>
        </button>

        <button className={activePanel === "chat" ? "active" : ""} onClick={() => togglePanel("chat")}>
          <span>💬</span>
          Chat
        </button>

        <button onClick={() => sendQuickReaction("👍")}>
          <span>♡</span>
          React
        </button>

        <button className="share" onClick={toggleScreenShare}>
          <span>⬆</span>
          Share
        </button>

        <button className={activePanel === "host-tools" ? "active" : ""} onClick={() => togglePanel("host-tools")}>
          <span>🛡️</span>
          Host tools
        </button>

        <button className={activePanel === "ai" ? "active" : ""} onClick={() => togglePanel("ai")}>
          <span>✨</span>
          Meet AI
        </button>

        <button className={activePanel === "recording" ? "active" : ""} onClick={() => togglePanel("recording")}>
          <span>⏺️</span>
          Record
        </button>

        <button className={activePanel === "more" ? "active" : ""} onClick={() => togglePanel("more")}>
          <span>•••</span>
          More
        </button>

        <button className="end" onClick={handleLeave}>
          <span>✖</span>
          End
        </button>
      </nav>
    </main>
  );
}

export default function MeetingPage() {
  return (
    <Suspense
      fallback={
        <main className="meeting-room-page zoom-native-shell">
          <div className="zoom-native-toast">Loading meeting...</div>
        </main>
      }
    >
      <MeetingRoomContent />
    </Suspense>
  );
}
