"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { MeetingRecorder } from "@/components/MeetingRecorder";

type MeetingPageProps = {
  params: {
    meetingId: string;
  };
  searchParams?: {
    name?: string;
  };
};

type Participant = {
  id: string;
  name: string;
  isHost?: boolean;
  audio?: boolean;
  video?: boolean;
};

type ChatMessage = {
  id: string;
  senderId: string;
  senderName: string;
  message: string;
  createdAt: string;
};

type RemoteTile = {
  participantId: string;
  name: string;
  stream: MediaStream;
};

const API_BASE = (
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  ""
).replace(/\/$/, "");

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:global.stun.twilio.com:3478" },
];

function makeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getClientId() {
  if (typeof window === "undefined") return makeId();

  const key = "meetsync-client-id";
  let value = sessionStorage.getItem(key);

  if (!value) {
    value = makeId();
    sessionStorage.setItem(key, value);
  }

  return value;
}

function getWsBase() {
  if (!API_BASE) return "";

  return API_BASE.replace(/^https:/, "wss:").replace(/^http:/, "ws:");
}

function normalizeParticipant(raw: any): Participant | null {
  const id =
    raw?.id ||
    raw?.participant_id ||
    raw?.participantId ||
    raw?.client_id ||
    raw?.clientId;

  if (!id) return null;

  return {
    id: String(id),
    name: String(raw?.name || raw?.display_name || raw?.displayName || raw?.host_name || "Guest"),
    isHost: Boolean(raw?.is_host || raw?.isHost),
    audio: raw?.audio ?? raw?.audioEnabled ?? true,
    video: raw?.video ?? raw?.videoEnabled ?? true,
  };
}

function getInitials(name: string) {
  const clean = name.trim();

  if (!clean) return "G";

  const parts = clean.split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase()).join("");
}

function VideoTile({
  stream,
  name,
  muted,
  isSelf,
  micOn,
  cameraOn,
}: {
  stream: MediaStream | null;
  name: string;
  muted?: boolean;
  isSelf?: boolean;
  micOn?: boolean;
  cameraOn?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const hasLiveVideo = Boolean(
    stream?.getVideoTracks().some((track) => track.enabled && track.readyState === "live"),
  );

  return (
    <div className={`zoom-video-tile ${isSelf ? "self" : ""}`}>
      {hasLiveVideo ? (
        <video ref={videoRef} autoPlay playsInline muted={muted} className="zoom-live-video" />
      ) : (
        <div className="zoom-avatar-tile">
          <div>{getInitials(name)}</div>
          <strong>{name}</strong>
          <span>{cameraOn === false ? "Camera off" : "Waiting for video"}</span>
        </div>
      )}

      <div className="zoom-name-pill">
        <span>{micOn === false ? "🔇" : "🎙️"}</span>
        <b>
          {name}
          {isSelf ? " (You)" : ""}
        </b>
      </div>
    </div>
  );
}

export default function MeetingRoomPage({ params, searchParams }: MeetingPageProps) {
  const meetingId = decodeURIComponent(params.meetingId);
  const urlName = searchParams?.name?.trim();

  const [displayName, setDisplayName] = useState(urlName || "Guest");
  const [meetingTitle, setMeetingTitle] = useState("MeetSync Meeting");
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [remoteTiles, setRemoteTiles] = useState<RemoteTile[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [activePanel, setActivePanel] = useState<"participants" | "chat" | "recording" | null>(null);

  const [connected, setConnected] = useState(false);
  const [joining, setJoining] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);
  const [permissionMessage, setPermissionMessage] = useState("");
  const [copied, setCopied] = useState(false);

  const socketRef = useRef<WebSocket | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const participantIdRef = useRef<string>(getClientId());
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const negotiatedPeersRef = useRef<Set<string>>(new Set());
  const participantsRef = useRef<Participant[]>([]);

  const cleanMeetingLink = useMemo(() => {
    if (typeof window === "undefined") return `/meeting/${meetingId}`;
    return `${window.location.origin}/meeting/${meetingId}`;
  }, [meetingId]);

  useEffect(() => {
    participantsRef.current = participants;
  }, [participants]);

  useEffect(() => {
    let mounted = true;

    async function boot() {
      setJoining(true);
      setPermissionMessage("");

      try {
        await joinMeeting();
        if (!mounted) return;

        await startLocalMedia({ video: true, audio: true, silentFallback: true });
        if (!mounted) return;

        connectMeetingSocket();
      } finally {
        if (mounted) setJoining(false);
      }
    }

    boot();

    return () => {
      mounted = false;
      cleanupMeeting();
    };
  }, [meetingId]);

  useEffect(() => {
    if (localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
  }, [cameraOn, micOn]);

  async function joinMeeting() {
    const selfId = participantIdRef.current;

    if (!API_BASE) {
      setPermissionMessage("Backend URL is missing. Add NEXT_PUBLIC_API_BASE_URL in Vercel.");
      setParticipants([{ id: selfId, name: displayName, isHost: true, audio: micOn, video: cameraOn }]);
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/api/meetings/${meetingId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        mode: "cors",
        cache: "no-store",
        body: JSON.stringify({
          name: displayName,
          display_name: displayName,
          participant_name: displayName,
        }),
      });

      if (!response.ok) {
        throw new Error(`Join failed with status ${response.status}`);
      }

      const data = await response.json();

      const backendParticipant =
        normalizeParticipant(data?.participant) ||
        normalizeParticipant({
          id: data?.participant_id,
          name: displayName,
          is_host: data?.is_host,
        });

      if (backendParticipant?.id) {
        participantIdRef.current = backendParticipant.id;
      }

      const selfParticipant: Participant = {
        id: participantIdRef.current,
        name: backendParticipant?.name || displayName,
        isHost: Boolean(data?.is_host || backendParticipant?.isHost),
        audio: micOn,
        video: cameraOn,
      };

      setDisplayName(selfParticipant.name);
      setMeetingTitle(
        data?.meeting?.title ||
          data?.meeting?.topic ||
          data?.meeting?.name ||
          `${selfParticipant.name}'s Meeting`,
      );

      const backendParticipants = Array.isArray(data?.participants)
        ? data.participants.map(normalizeParticipant).filter(Boolean)
        : [];

      setParticipants(mergeParticipants([selfParticipant, ...backendParticipants]));
    } catch {
      setParticipants([{ id: selfId, name: displayName, isHost: true, audio: micOn, video: cameraOn }]);
    }
  }

  function mergeParticipants(input: Participant[]) {
    const map = new Map<string, Participant>();

    input.forEach((item) => {
      if (!item?.id) return;

      const existing = map.get(item.id);

      map.set(item.id, {
        ...existing,
        ...item,
        name: item.name || existing?.name || "Guest",
      });
    });

    return Array.from(map.values());
  }

  async function startLocalMedia(options: {
    video: boolean;
    audio: boolean;
    silentFallback?: boolean;
  }) {
    if (!navigator.mediaDevices?.getUserMedia) {
      setPermissionMessage("Camera and microphone are not supported in this browser.");
      return null;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: options.video
          ? {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              facingMode: "user",
            }
          : false,
        audio: options.audio
          ? {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            }
          : false,
      });

      localStreamRef.current?.getTracks().forEach((track) => track.stop());
      localStreamRef.current = stream;

      stream.getAudioTracks().forEach((track) => {
        track.enabled = options.audio;
      });

      stream.getVideoTracks().forEach((track) => {
        track.enabled = options.video;
      });

      setMicOn(stream.getAudioTracks().length ? options.audio : false);
      setCameraOn(stream.getVideoTracks().length ? options.video : false);
      setPermissionMessage("");

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      addLocalTracksToPeers(stream);
      broadcastMediaState();

      return stream;
    } catch (error) {
      const message =
        error instanceof DOMException && error.name === "NotAllowedError"
          ? "Camera/microphone permission denied. Click the lock icon in the browser address bar and allow camera + microphone."
          : "Could not access camera/microphone. You can still join with chat, but allow permissions to use audio/video.";

      if (!options.silentFallback) {
        setPermissionMessage(message);
      } else {
        setPermissionMessage("Camera/microphone permission denied. You can still join with chat.");
      }

      try {
        if (options.audio) {
          const audioOnly = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
            video: false,
          });

          localStreamRef.current = audioOnly;
          setMicOn(true);
          setCameraOn(false);
          addLocalTracksToPeers(audioOnly);
          return audioOnly;
        }
      } catch {
        setMicOn(false);
        setCameraOn(false);
      }

      return null;
    }
  }

  function addLocalTracksToPeers(stream: MediaStream) {
    peerConnectionsRef.current.forEach((pc) => {
      const existingSenders = pc.getSenders();

      stream.getTracks().forEach((track) => {
        const alreadyAdded = existingSenders.some((sender) => sender.track?.id === track.id);
        if (!alreadyAdded) {
          pc.addTrack(track, stream);
        }
      });
    });
  }

  function connectMeetingSocket() {
    const wsBase = getWsBase();

    if (!wsBase) {
      setPermissionMessage("Backend WebSocket URL is missing. Add NEXT_PUBLIC_API_BASE_URL in Vercel.");
      return;
    }

    const participantId = participantIdRef.current;
    const url = `${wsBase}/ws/meetings/${encodeURIComponent(meetingId)}?participant_id=${encodeURIComponent(
      participantId,
    )}&name=${encodeURIComponent(displayName)}&is_host=false`;

    const ws = new WebSocket(url);
    socketRef.current = ws;

    ws.onopen = () => {
      setConnected(true);

      sendSocket({
        type: "client-ready",
        participantId,
        participant_id: participantId,
        name: displayName,
      });

      broadcastMediaState();
    };

    ws.onclose = () => {
      setConnected(false);
    };

    ws.onerror = () => {
      setConnected(false);
      setPermissionMessage("Realtime connection failed. Refresh the page or check backend WebSocket deployment.");
    };

    ws.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        await handleSocketMessage(data);
      } catch {
        // Ignore malformed socket messages.
      }
    };
  }

  async function handleSocketMessage(data: any) {
    const selfId = participantIdRef.current;

    if (data.type === "meeting-init" || data.type === "init" || data.type === "participants-update") {
      const incoming = Array.isArray(data.participants)
        ? data.participants.map(normalizeParticipant).filter(Boolean)
        : [];

      setParticipants((old) =>
        mergeParticipants([
          ...old,
          ...incoming,
          { id: selfId, name: displayName, isHost: true, audio: micOn, video: cameraOn },
        ]),
      );

      incoming.forEach((participant: Participant) => {
        if (participant.id !== selfId && shouldCreateOffer(selfId, participant.id)) {
          createOffer(participant.id);
        }
      });
    }

    if (data.type === "participant-joined" || data.type === "user-joined") {
      const participant = normalizeParticipant(data.participant || data);

      if (participant && participant.id !== selfId) {
        setParticipants((old) => mergeParticipants([...old, participant]));

        if (shouldCreateOffer(selfId, participant.id)) {
          await createOffer(participant.id);
        }
      }
    }

    if (data.type === "participant-left" || data.type === "user-left") {
      const id = String(data.participant_id || data.participantId || data.id || "");

      if (id) {
        closePeer(id);
        setParticipants((old) => old.filter((participant) => participant.id !== id));
        setRemoteTiles((old) => old.filter((tile) => tile.participantId !== id));
      }
    }

    if (data.type === "media-state") {
      const id = String(data.participant_id || data.participantId || data.from || "");

      if (id && id !== selfId) {
        setParticipants((old) =>
          old.map((participant) =>
            participant.id === id
              ? {
                  ...participant,
                  audio: data.audio,
                  video: data.video,
                }
              : participant,
          ),
        );
      }
    }

    if (data.type === "webrtc-offer" && isMessageForSelf(data)) {
      await handleOffer(data);
    }

    if (data.type === "webrtc-answer" && isMessageForSelf(data)) {
      await handleAnswer(data);
    }

    if (data.type === "webrtc-ice-candidate" && isMessageForSelf(data)) {
      await handleIceCandidate(data);
    }

    if (data.type === "chat-message") {
      const message: ChatMessage = data.message?.id
        ? data.message
        : {
            id: data.id || makeId(),
            senderId: data.senderId || data.sender_id || data.from || "unknown",
            senderName: data.senderName || data.sender_name || data.name || "Guest",
            message: data.message?.message || data.message || data.text || "",
            createdAt: data.createdAt || data.created_at || new Date().toISOString(),
          };

      if (message.message) {
        setMessages((old) => {
          if (old.some((item) => item.id === message.id)) return old;
          return [...old, message];
        });
      }
    }
  }

  function isMessageForSelf(data: any) {
    const to = data.to || data.target || data.participant_id || data.participantId;
    return !to || String(to) === participantIdRef.current;
  }

  function shouldCreateOffer(selfId: string, remoteId: string) {
    return selfId.localeCompare(remoteId) < 0;
  }

  function getParticipantName(id: string) {
    return participantsRef.current.find((participant) => participant.id === id)?.name || "Guest";
  }

  function createPeer(remoteParticipantId: string) {
    const existing = peerConnectionsRef.current.get(remoteParticipantId);
    if (existing) return existing;

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    peerConnectionsRef.current.set(remoteParticipantId, pc);

    const stream = localStreamRef.current;

    if (stream) {
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendSocket({
          type: "webrtc-ice-candidate",
          from: participantIdRef.current,
          to: remoteParticipantId,
          candidate: event.candidate,
        });
      }
    };

    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;

      if (!remoteStream) return;

      setRemoteTiles((old) => {
        const existingTile = old.find((tile) => tile.participantId === remoteParticipantId);

        if (existingTile) {
          return old.map((tile) =>
            tile.participantId === remoteParticipantId
              ? { ...tile, stream: remoteStream, name: getParticipantName(remoteParticipantId) }
              : tile,
          );
        }

        return [
          ...old,
          {
            participantId: remoteParticipantId,
            name: getParticipantName(remoteParticipantId),
            stream: remoteStream,
          },
        ];
      });
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "closed" || pc.connectionState === "disconnected") {
        setRemoteTiles((old) => old.filter((tile) => tile.participantId !== remoteParticipantId));
      }
    };

    return pc;
  }

  async function createOffer(remoteParticipantId: string) {
    if (remoteParticipantId === participantIdRef.current) return;
    if (negotiatedPeersRef.current.has(remoteParticipantId)) return;

    negotiatedPeersRef.current.add(remoteParticipantId);

    try {
      const pc = createPeer(remoteParticipantId);
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });

      await pc.setLocalDescription(offer);

      sendSocket({
        type: "webrtc-offer",
        from: participantIdRef.current,
        to: remoteParticipantId,
        name: displayName,
        sdp: offer,
      });
    } catch {
      negotiatedPeersRef.current.delete(remoteParticipantId);
    }
  }

  async function handleOffer(data: any) {
    const from = String(data.from || data.senderId || data.sender_id || "");

    if (!from || from === participantIdRef.current) return;

    const participant = normalizeParticipant({
      id: from,
      name: data.name || data.senderName || "Guest",
    });

    if (participant) {
      setParticipants((old) => mergeParticipants([...old, participant]));
    }

    const pc = createPeer(from);
    await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    sendSocket({
      type: "webrtc-answer",
      from: participantIdRef.current,
      to: from,
      name: displayName,
      sdp: answer,
    });
  }

  async function handleAnswer(data: any) {
    const from = String(data.from || data.senderId || data.sender_id || "");

    if (!from) return;

    const pc = peerConnectionsRef.current.get(from);

    if (!pc || !data.sdp) return;

    if (pc.signalingState !== "stable") {
      await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
    }
  }

  async function handleIceCandidate(data: any) {
    const from = String(data.from || data.senderId || data.sender_id || "");

    if (!from || !data.candidate) return;

    const pc = peerConnectionsRef.current.get(from) || createPeer(from);

    try {
      await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
    } catch {
      // Candidate can arrive before remote description in some browsers. Ignore safely.
    }
  }

  function sendSocket(payload: Record<string, any>) {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(payload));
    }
  }

  function broadcastMediaState() {
    sendSocket({
      type: "media-state",
      from: participantIdRef.current,
      participant_id: participantIdRef.current,
      name: displayName,
      audio: micOn,
      video: cameraOn,
    });
  }

  async function toggleMic() {
    let stream = localStreamRef.current;

    if (!stream || !stream.getAudioTracks().length) {
      stream = await startLocalMedia({ video: cameraOn, audio: true });
    }

    if (!stream) return;

    const next = !micOn;
    stream.getAudioTracks().forEach((track) => {
      track.enabled = next;
    });

    setMicOn(next);

    setParticipants((old) =>
      old.map((participant) =>
        participant.id === participantIdRef.current ? { ...participant, audio: next } : participant,
      ),
    );

    setTimeout(broadcastMediaState, 0);
  }

  async function toggleCamera() {
    let stream = localStreamRef.current;

    if (!stream || !stream.getVideoTracks().length) {
      stream = await startLocalMedia({ video: true, audio: micOn });
    }

    if (!stream) return;

    const next = !cameraOn;
    stream.getVideoTracks().forEach((track) => {
      track.enabled = next;
    });

    setCameraOn(next);

    setParticipants((old) =>
      old.map((participant) =>
        participant.id === participantIdRef.current ? { ...participant, video: next } : participant,
      ),
    );

    setTimeout(broadcastMediaState, 0);
  }

  async function shareScreen() {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setPermissionMessage("Screen sharing is not supported in this browser.");
      return;
    }

    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });

      screenStreamRef.current = screenStream;
      const screenTrack = screenStream.getVideoTracks()[0];

      peerConnectionsRef.current.forEach((pc) => {
        const sender = pc.getSenders().find((item) => item.track?.kind === "video");
        sender?.replaceTrack(screenTrack);
      });

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = screenStream;
      }

      setScreenSharing(true);

      screenTrack.onended = () => stopScreenShare();
    } catch {
      setPermissionMessage("Screen share cancelled or blocked by browser permission.");
    }
  }

  function stopScreenShare() {
    const cameraTrack = localStreamRef.current?.getVideoTracks()[0];

    peerConnectionsRef.current.forEach((pc) => {
      const sender = pc.getSenders().find((item) => item.track?.kind === "video");

      if (sender && cameraTrack) {
        sender.replaceTrack(cameraTrack);
      }
    });

    screenStreamRef.current?.getTracks().forEach((track) => track.stop());
    screenStreamRef.current = null;

    if (localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }

    setScreenSharing(false);
  }

  function sendChat(event: FormEvent) {
    event.preventDefault();

    const body = chatInput.trim();
    if (!body) return;

    const message: ChatMessage = {
      id: makeId(),
      senderId: participantIdRef.current,
      senderName: displayName,
      message: body,
      createdAt: new Date().toISOString(),
    };

    setMessages((old) => [...old, message]);

    sendSocket({
      type: "chat-message",
      from: participantIdRef.current,
      name: displayName,
      message,
    });

    setChatInput("");
    setActivePanel("chat");
  }

  async function copyMeetingLink() {
    try {
      await navigator.clipboard.writeText(cleanMeetingLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setPermissionMessage("Could not copy link. Please copy it from the browser address bar.");
    }
  }

  function leaveMeeting() {
    sendSocket({
      type: "participant-left",
      participant_id: participantIdRef.current,
      from: participantIdRef.current,
      name: displayName,
    });

    cleanupMeeting();

    window.location.href = "/dashboard";
  }

  function closePeer(id: string) {
    const pc = peerConnectionsRef.current.get(id);
    pc?.close();
    peerConnectionsRef.current.delete(id);
    negotiatedPeersRef.current.delete(id);
  }

  function cleanupMeeting() {
    socketRef.current?.close();
    socketRef.current = null;

    peerConnectionsRef.current.forEach((pc) => pc.close());
    peerConnectionsRef.current.clear();

    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;

    screenStreamRef.current?.getTracks().forEach((track) => track.stop());
    screenStreamRef.current = null;
  }

  const selfParticipant: Participant = {
    id: participantIdRef.current,
    name: displayName,
    isHost: participants.find((participant) => participant.id === participantIdRef.current)?.isHost ?? true,
    audio: micOn,
    video: cameraOn,
  };

  const allParticipants = mergeParticipants([selfParticipant, ...participants]);
  const participantCount = allParticipants.length;

  return (
    <main className="zoom-room-page">
      <header className="zoom-topbar">
        <div>
          <span>meet</span>
          <strong>MeetSync Workplace</strong>
        </div>

        <div className="zoom-top-actions">
          <span className={connected ? "live" : "offline"}>{connected ? "Live" : "Offline"}</span>
          <button onClick={copyMeetingLink}>{copied ? "Copied" : "Invite"}</button>
          <Link href="/dashboard">Dashboard</Link>
          <div className="zoom-profile-dot">{getInitials(displayName)}</div>
        </div>
      </header>

      {permissionMessage && (
        <div className="zoom-permission-banner">
          <strong>{permissionMessage}</strong>
          <button onClick={() => startLocalMedia({ video: true, audio: true })}>Allow camera/mic</button>
        </div>
      )}

      {joining && <div className="zoom-joining-toast">Joining secure meeting room...</div>}

      <section className={`zoom-meeting-shell ${activePanel ? "panel-open" : ""}`}>
        <div className="zoom-stage">
          <VideoTile
            stream={localStreamRef.current}
            name={displayName}
            muted
            isSelf
            micOn={micOn}
            cameraOn={cameraOn}
          />

          {remoteTiles.map((tile) => {
            const remoteParticipant = allParticipants.find((participant) => participant.id === tile.participantId);

            return (
              <VideoTile
                key={tile.participantId}
                stream={tile.stream}
                name={remoteParticipant?.name || tile.name}
                micOn={remoteParticipant?.audio}
                cameraOn={remoteParticipant?.video}
              />
            );
          })}

          {!remoteTiles.length && (
            <div className="zoom-waiting-card">
              <div>👥</div>
              <h1>Waiting for others to join...</h1>
              <p>Share this meeting link with others. They can join from any modern browser.</p>
              <button onClick={copyMeetingLink}>{copied ? "Link copied" : "Copy meeting link"}</button>
            </div>
          )}
        </div>

        {activePanel && (
          <aside className="zoom-side-panel">
            <div className="zoom-panel-tabs">
              <button className={activePanel === "participants" ? "active" : ""} onClick={() => setActivePanel("participants")}>
                Participants
              </button>
              <button className={activePanel === "chat" ? "active" : ""} onClick={() => setActivePanel("chat")}>
                Chat
              </button>
              <button className={activePanel === "recording" ? "active" : ""} onClick={() => setActivePanel("recording")}>
                Recording
              </button>
              <button onClick={() => setActivePanel(null)}>×</button>
            </div>

            {activePanel === "participants" && (
              <section className="zoom-panel-section">
                <h2>Participants</h2>
                <p>{participantCount} joined</p>

                <div className="zoom-participant-list">
                  {allParticipants.map((participant) => (
                    <div className="zoom-participant-card" key={participant.id}>
                      <div>{getInitials(participant.name)}</div>
                      <span>
                        <strong>
                          {participant.name}
                          {participant.id === participantIdRef.current ? " (You)" : ""}
                          {participant.isHost ? " · Host" : ""}
                        </strong>
                        <small>
                          {participant.audio === false ? "Muted" : "Audio on"} ·{" "}
                          {participant.video === false ? "Camera off" : "Camera on"}
                        </small>
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {activePanel === "chat" && (
              <section className="zoom-panel-section zoom-chat-panel">
                <h2>Meeting Chat</h2>

                <div className="zoom-chat-list">
                  {messages.map((message) => (
                    <div key={message.id} className="zoom-chat-message">
                      <strong>{message.senderName}</strong>
                      <small>{new Date(message.createdAt).toLocaleTimeString()}</small>
                      <p>{message.message}</p>
                    </div>
                  ))}

                  {!messages.length && <div className="zoom-empty">No messages yet.</div>}
                </div>

                <form onSubmit={sendChat} className="zoom-chat-form">
                  <input
                    value={chatInput}
                    onChange={(event) => setChatInput(event.target.value)}
                    placeholder="Write a message..."
                  />
                  <button type="submit">Send</button>
                </form>
              </section>
            )}

            {activePanel === "recording" && (
              <section className="zoom-panel-section">
                <MeetingRecorder meetingId={meetingId} />
              </section>
            )}
          </aside>
        )}
      </section>

      <footer className="zoom-toolbar">
        <button onClick={toggleMic} className={!micOn ? "danger-tool" : ""}>
          <span>{micOn ? "🎙️" : "🔇"}</span>
          <b>{micOn ? "Mute" : "Unmute"}</b>
        </button>

        <button onClick={toggleCamera} className={!cameraOn ? "danger-tool" : ""}>
          <span>{cameraOn ? "📹" : "🚫"}</span>
          <b>{cameraOn ? "Stop Video" : "Start Video"}</b>
        </button>

        <button onClick={() => setActivePanel(activePanel === "participants" ? null : "participants")}>
          <span>👥</span>
          <b>Participants</b>
          <em>{participantCount}</em>
        </button>

        <button onClick={() => setActivePanel(activePanel === "chat" ? null : "chat")}>
          <span>💬</span>
          <b>Chat</b>
          <em>{messages.length}</em>
        </button>

        <button onClick={screenSharing ? stopScreenShare : shareScreen} className={screenSharing ? "share-active" : ""}>
          <span>⬆️</span>
          <b>{screenSharing ? "Stop Share" : "Share"}</b>
        </button>

        <button onClick={() => setActivePanel(activePanel === "recording" ? null : "recording")}>
          <span>⏺️</span>
          <b>Record</b>
        </button>

        <button onClick={copyMeetingLink}>
          <span>🔗</span>
          <b>Invite</b>
        </button>

        <button>
          <span>✨</span>
          <b>Meet AI</b>
        </button>

        <button onClick={leaveMeeting} className="leave-tool">
          <span>⨯</span>
          <b>End</b>
        </button>
      </footer>
    </main>
  );
}
