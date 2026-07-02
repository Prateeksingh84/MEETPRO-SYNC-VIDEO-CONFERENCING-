"use client";

import { FormEvent, Suspense, useEffect, useRef, useState } from "react";
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

type SidePanel = "participants" | "chat" | "recording";

function RemoteVideo({ stream, name }: { stream: MediaStream; name: string }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="video-tile meetsync-video-tile">
      <video ref={videoRef} autoPlay playsInline />
      <div className="tile-name-badge">{name}</div>
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
  const [sidePanel, setSidePanel] = useState<SidePanel>("participants");

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

        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: true,
          });

          localStreamRef.current = stream;

          if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
          }
        } catch {
          setError("Camera/microphone permission denied. You can still join with chat.");
        }

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
          createdAt: data.createdAt || data.created_at || new Date().toISOString(),
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

  function toggleMute() {
    const next = !isMuted;

    localStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !next;
    });

    setIsMuted(next);
    sendMediaState(next, cameraOn);
  }

  function toggleCamera() {
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
        message: `${reaction} reaction from ${displayName}`,
      }),
    );

    setSidePanel("chat");
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
  }

  async function handleLeave() {
    if (participantIdRef.current) {
      await leaveMeeting(meetingId, participantIdRef.current).catch(() => undefined);
    }

    router.push("/dashboard");
  }

  const remoteEntries = Object.entries(remoteStreams);
  const totalParticipants = Math.max(participants.length, 1);

  return (
    <main className="meeting-room-page zoom-room-shell">
      <header className="meeting-topbar zoom-meeting-topbar">
        <div className="zoom-meeting-brand">
          <div className="zoom-brand-dot">M</div>
          <div>
            <strong>{meeting?.title || "MeetSync Pro Meeting"}</strong>
            <span>Meeting ID: {meetingId}</span>
          </div>
        </div>

        <div className="zoom-top-actions">
          <span className={connected ? "zoom-live-pill" : "zoom-offline-pill"}>
            {connected ? "Live" : "Connecting"}
          </span>
          <button className="zoom-ghost-button" onClick={copyInvite}>
            Copy invite
          </button>
          <button className="zoom-danger-top-button" onClick={handleLeave}>
            End
          </button>
        </div>
      </header>

      {error && <div className="meeting-error zoom-error-banner">{error}</div>}

      <section className="meeting-layout zoom-meeting-layout">
        <div className="video-stage zoom-video-stage">
          <div className="zoom-stage-header">
            <div>
              <p>Professional Meeting Room</p>
              <h1>{meeting?.title || "Live Video Conference"}</h1>
            </div>

            <div className="zoom-stage-meta">
              <span>{totalParticipants} participant(s)</span>
              <span>{remoteEntries.length ? "Gallery View" : "Waiting Room"}</span>
            </div>
          </div>

          <div className="video-grid zoom-video-grid">
            <div className="video-tile local meetsync-video-tile">
              <video ref={localVideoRef} autoPlay playsInline muted />
              {!cameraOn && <div className="camera-off-avatar">{displayName.charAt(0).toUpperCase()}</div>}
              <div className="tile-name-badge">
                You {isHost ? "(Host)" : ""} {isMuted ? "• Muted" : ""}
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
              <div className="video-tile placeholder zoom-waiting-tile">
                <div className="waiting-icon">👥</div>
                <strong>Waiting for others to join...</strong>
                <p>Share the meeting link or open this room in another tab/window to test real-time WebRTC.</p>
              </div>
            )}
          </div>

          <div className="meeting-controls zoom-control-bar">
            <button className={isMuted ? "zoom-control danger-state" : "zoom-control"} onClick={toggleMute}>
              <span>{isMuted ? "🎙️" : "🎤"}</span>
              {isMuted ? "Unmute" : "Mute"}
            </button>

            <button className={!cameraOn ? "zoom-control danger-state" : "zoom-control"} onClick={toggleCamera}>
              <span>{cameraOn ? "🎥" : "📷"}</span>
              {cameraOn ? "Stop Video" : "Start Video"}
            </button>

            <button className="zoom-control share-state" onClick={toggleScreenShare}>
              <span>🖥️</span>
              {screenSharing ? "Sharing" : "Share Screen"}
            </button>

            <button className="zoom-control" onClick={() => setSidePanel("participants")}>
              <span>👥</span>
              Participants
            </button>

            <button className="zoom-control" onClick={() => setSidePanel("chat")}>
              <span>💬</span>
              Chat
            </button>

            <button className="zoom-control" onClick={() => setSidePanel("recording")}>
              <span>⏺️</span>
              Record
            </button>

            <button className="zoom-control" onClick={() => sendQuickReaction("👍")}>
              <span>👍</span>
              React
            </button>

            {isHost && (
              <button className="zoom-control host-state" onClick={muteAll}>
                <span>🔇</span>
                Mute All
              </button>
            )}

            <button className="zoom-control leave-state" onClick={handleLeave}>
              Leave
            </button>
          </div>
        </div>

        <aside className="meeting-sidebar zoom-side-panel">
          <div className="zoom-side-tabs">
            <button
              className={sidePanel === "participants" ? "active" : ""}
              onClick={() => setSidePanel("participants")}
            >
              Participants
            </button>
            <button
              className={sidePanel === "chat" ? "active" : ""}
              onClick={() => setSidePanel("chat")}
            >
              Chat
            </button>
            <button
              className={sidePanel === "recording" ? "active" : ""}
              onClick={() => setSidePanel("recording")}
            >
              Recording
            </button>
          </div>

          {sidePanel === "participants" && (
            <section className="meeting-panel zoom-side-card">
              <div className="section-title zoom-panel-title">
                <div>
                  <h2>Participants</h2>
                  <p>{totalParticipants} joined</p>
                </div>
                <span>{connected ? "Live" : "Offline"}</span>
              </div>

              <div className="participant-list zoom-participant-list">
                <div className="participant-row zoom-participant-row">
                  <div className="participant-avatar">{displayName.charAt(0).toUpperCase()}</div>
                  <div>
                    <strong>{displayName} {isHost ? "(Host)" : ""}</strong>
                    <small>
                      {isMuted ? "Muted" : "Audio on"} • {cameraOn ? "Camera on" : "Camera off"}
                    </small>
                  </div>
                </div>

                {participants
                  .filter((participant) => participant.participantId !== participantIdRef.current)
                  .map((participant) => (
                    <div className="participant-row zoom-participant-row" key={participant.participantId}>
                      <div className="participant-avatar">
                        {participant.displayName?.charAt(0)?.toUpperCase() || "U"}
                      </div>

                      <div>
                        <strong>{participant.displayName}</strong>
                        <small>
                          {participant.isHost ? "Host" : "Guest"} •{" "}
                          {participant.isMuted ? "Muted" : "Audio on"} •{" "}
                          {participant.cameraOn ? "Camera on" : "Camera off"}
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
            </section>
          )}

          {sidePanel === "chat" && (
            <section className="meeting-panel chat-panel zoom-side-card zoom-chat-card">
              <div className="section-title zoom-panel-title">
                <div>
                  <h2>Meeting Chat</h2>
                  <p>Live messages</p>
                </div>
                <span>{messages.length}</span>
              </div>

              <div className="meeting-chat-list zoom-chat-list">
                {messages.map((message) => (
                  <div className="meeting-chat-message zoom-chat-message" key={message.id}>
                    <strong>{message.senderName}</strong>
                    <p>{message.message}</p>
                  </div>
                ))}

                {!messages.length && (
                  <div className="empty-state zoom-empty-state">
                    No messages yet. Start the conversation.
                  </div>
                )}
              </div>

              <form className="meeting-chat-form zoom-chat-form" onSubmit={sendChat}>
                <input
                  value={chatInput}
                  onChange={(event) => setChatInput(event.target.value)}
                  placeholder="Message everyone..."
                />
                <button>Send</button>
              </form>
            </section>
          )}

          {sidePanel === "recording" && (
            <section className="zoom-recording-wrapper">
              <MeetingRecorder meetingId={meetingId} />
            </section>
          )}
        </aside>
      </section>
    </main>
  );
}

export default function MeetingPage() {
  return (
    <Suspense
      fallback={
        <main className="meeting-room-page">
          <div className="meeting-error">Loading meeting...</div>
        </main>
      }
    >
      <MeetingRoomContent />
    </Suspense>
  );
}
