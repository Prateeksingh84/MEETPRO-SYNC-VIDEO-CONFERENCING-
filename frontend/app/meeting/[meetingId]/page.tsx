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

function RemoteVideo({ stream, name }: { stream: MediaStream; name: string }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="video-tile">
      <video ref={videoRef} autoPlay playsInline />
      <span>{name}</span>
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
    const socketPath = `/ws/meetings/${encodeURIComponent(
      meetingId,
    )}?participantId=${encodeURIComponent(participantId)}&displayName=${encodeURIComponent(
      displayName,
    )}&isHost=${host ? "true" : "false"}`;

    const ws = new WebSocket(getWsUrl(socketPath));
    socketRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);

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

  const remoteEntries = Object.entries(remoteStreams);

  return (
    <main className="meeting-room-page">
      <header className="meeting-topbar">
        <div>
          <strong>{meeting?.title || "Meeting Room"}</strong>
          <span>{meetingId}</span>
        </div>

        <button className="danger-button" onClick={() => router.push("/")}>
          Leave
        </button>
      </header>

      {error && <div className="meeting-error">{error}</div>}

      <section className="meeting-layout">
        <div className="video-stage">
          <div className="video-grid">
            <div className="video-tile local">
              <video ref={localVideoRef} autoPlay playsInline muted />
              <span>
                You {isHost ? "(Host)" : ""} {isMuted ? "• Muted" : ""}
              </span>
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
              <div className="video-tile placeholder">
                <strong>Waiting for others to join...</strong>
                <p>Open this meeting link in another tab/window to test real-time WebRTC.</p>
              </div>
            )}
          </div>

          <div className="meeting-controls">
            <button onClick={toggleMute}>{isMuted ? "Unmute" : "Mute"}</button>
            <button onClick={toggleCamera}>{cameraOn ? "Stop Video" : "Start Video"}</button>
            <button onClick={toggleScreenShare}>
              {screenSharing ? "Sharing Screen" : "Share Screen"}
            </button>
            <button onClick={() => navigator.clipboard.writeText(window.location.href)}>
              Copy Link
            </button>
            {isHost && <button onClick={muteAll}>Mute All</button>}
          </div>
        </div>

        <aside className="meeting-sidebar">
          <section className="meeting-panel">
            <div className="section-title">
              <h2>Participants</h2>
              <span>{connected ? "Live" : "Connecting"}</span>
            </div>

            <div className="participant-list">
              {participants.map((participant) => (
                <div className="participant-row" key={participant.participantId}>
                  <div>
                    <strong>{participant.displayName}</strong>
                    <small>
                      {participant.isHost ? "Host" : "Guest"} •{" "}
                      {participant.isMuted ? "Muted" : "Audio on"} •{" "}
                      {participant.cameraOn ? "Camera on" : "Camera off"}
                    </small>
                  </div>

                  {isHost && participant.participantId !== participantIdRef.current && (
                    <button onClick={() => removeParticipant(participant.participantId)}>
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>

          <MeetingRecorder meetingId={meetingId} />

          <section className="meeting-panel chat-panel">
            <div className="section-title">
              <h2>Chat</h2>
              <span>{messages.length}</span>
            </div>

            <div className="meeting-chat-list">
              {messages.map((message) => (
                <div className="meeting-chat-message" key={message.id}>
                  <strong>{message.senderName}</strong>
                  <p>{message.message}</p>
                </div>
              ))}
            </div>

            <form className="meeting-chat-form" onSubmit={sendChat}>
              <input
                value={chatInput}
                onChange={(event) => setChatInput(event.target.value)}
                placeholder="Type message..."
              />
              <button>Send</button>
            </form>
          </section>
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


