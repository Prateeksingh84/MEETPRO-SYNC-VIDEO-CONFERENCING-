"use client";

import { useEffect, useRef, useState } from "react";
import {
  deleteMeetingRecording,
  getMeetingRecordings,
  getRecordingDownloadUrl,
  MeetingRecording,
  uploadMeetingRecording,
} from "@/lib/api";

type MeetingRecorderProps = {
  meetingId: string;
};

function formatDuration(seconds: number) {
  const safeSeconds = Math.max(seconds, 0);
  const mins = Math.floor(safeSeconds / 60);
  const secs = safeSeconds % 60;

  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function formatBytes(bytes: number) {
  if (!bytes) return "0 KB";

  const kb = bytes / 1024;

  if (kb < 1024) {
    return `${kb.toFixed(1)} KB`;
  }

  return `${(kb / 1024).toFixed(1)} MB`;
}

function getSupportedMimeType() {
  const options = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];

  for (const option of options) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(option)) {
      return option;
    }
  }

  return "";
}

export function MeetingRecorder({ meetingId }: MeetingRecorderProps) {
  const [recordings, setRecordings] = useState<MeetingRecording[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const displayStreamRef = useRef<MediaStream | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<number | null>(null);
  const startedAtRef = useRef<number>(0);
  const elapsedBeforePauseRef = useRef<number>(0);
  const elapsedSecondsRef = useRef<number>(0);
  const saveInProgressRef = useRef(false);

  useEffect(() => {
    loadRecordings();

    return () => {
      stopAllTracks();

      if (timerRef.current) {
        window.clearInterval(timerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetingId]);

  useEffect(() => {
    elapsedSecondsRef.current = elapsedSeconds;
  }, [elapsedSeconds]);

  async function loadRecordings() {
    try {
      const data = await getMeetingRecordings(meetingId);
      setRecordings(data.recordings || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load recordings");
    }
  }

  function stopAllTracks() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    displayStreamRef.current?.getTracks().forEach((track) => track.stop());
    micStreamRef.current?.getTracks().forEach((track) => track.stop());

    audioContextRef.current?.close().catch(() => undefined);

    streamRef.current = null;
    displayStreamRef.current = null;
    micStreamRef.current = null;
    audioContextRef.current = null;
  }

  function clearTimer() {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  function startTimer() {
    clearTimer();
    startedAtRef.current = Date.now();

    timerRef.current = window.setInterval(() => {
      const activeSeconds = Math.floor((Date.now() - startedAtRef.current) / 1000);
      const nextElapsed = elapsedBeforePauseRef.current + activeSeconds;

      elapsedSecondsRef.current = nextElapsed;
      setElapsedSeconds(nextElapsed);
    }, 1000);
  }

  function pauseTimer() {
    clearTimer();
    elapsedBeforePauseRef.current = elapsedSecondsRef.current;
  }

  function resumeTimer() {
    startedAtRef.current = Date.now();

    timerRef.current = window.setInterval(() => {
      const activeSeconds = Math.floor((Date.now() - startedAtRef.current) / 1000);
      const nextElapsed = elapsedBeforePauseRef.current + activeSeconds;

      elapsedSecondsRef.current = nextElapsed;
      setElapsedSeconds(nextElapsed);
    }, 1000);
  }

  async function buildRecordingStream() {
    const displayStream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        frameRate: 30,
      },
      audio: true,
    });

    displayStreamRef.current = displayStream;

    let micStream: MediaStream | null = null;

    try {
      micStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      micStreamRef.current = micStream;
    } catch {
      micStream = null;
    }

    const finalStream = new MediaStream();

    displayStream.getVideoTracks().forEach((track) => {
      finalStream.addTrack(track);
    });

    const displayAudioTracks = displayStream.getAudioTracks();
    const micAudioTracks = micStream?.getAudioTracks() || [];

    if (displayAudioTracks.length || micAudioTracks.length) {
      const audioContext = new AudioContext();
      const destination = audioContext.createMediaStreamDestination();

      audioContextRef.current = audioContext;

      if (displayAudioTracks.length) {
        const displayAudioSource = audioContext.createMediaStreamSource(
          new MediaStream(displayAudioTracks),
        );
        displayAudioSource.connect(destination);
      }

      if (micAudioTracks.length) {
        const micAudioSource = audioContext.createMediaStreamSource(
          new MediaStream(micAudioTracks),
        );
        micAudioSource.connect(destination);
      }

      destination.stream.getAudioTracks().forEach((track) => {
        finalStream.addTrack(track);
      });
    }

    return finalStream;
  }

  async function startRecording() {
    setError("");
    setMessage("");

    if (!navigator.mediaDevices?.getDisplayMedia) {
      setError("Screen recording is not supported in this browser.");
      return;
    }

    if (typeof MediaRecorder === "undefined") {
      setError("MediaRecorder API is not supported in this browser.");
      return;
    }

    try {
      const stream = await buildRecordingStream();
      streamRef.current = stream;

      chunksRef.current = [];
      saveInProgressRef.current = false;

      const mimeType = getSupportedMimeType();

      const recorder = new MediaRecorder(
        stream,
        mimeType
          ? {
              mimeType,
            }
          : undefined,
      );

      recorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        await saveRecording();
      };

      stream.getVideoTracks()[0]?.addEventListener("ended", () => {
        if (
          recorderRef.current &&
          recorderRef.current.state !== "inactive" &&
          !saveInProgressRef.current
        ) {
          stopRecording();
        }
      });

      setElapsedSeconds(0);
      elapsedSecondsRef.current = 0;
      elapsedBeforePauseRef.current = 0;
      setIsRecording(true);
      setIsPaused(false);

      recorder.start(1000);
      startTimer();
    } catch (err) {
      stopAllTracks();
      setIsRecording(false);
      setIsPaused(false);
      setError(err instanceof Error ? err.message : "Recording start failed");
    }
  }

  async function saveRecording() {
    if (saveInProgressRef.current) {
      return;
    }

    saveInProgressRef.current = true;
    clearTimer();

    const duration = elapsedSecondsRef.current;

    setUploading(true);
    setIsRecording(false);
    setIsPaused(false);

    try {
      const mimeType = chunksRef.current[0]?.type || "video/webm";
      const blob = new Blob(chunksRef.current, {
        type: mimeType,
      });

      if (!blob.size) {
        throw new Error("Recording is empty.");
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const fileName = `meetsync-recording-${meetingId}-${timestamp}.webm`;

      await uploadMeetingRecording(meetingId, blob, fileName, duration);

      setMessage("Recording saved successfully.");
      chunksRef.current = [];
      setElapsedSeconds(0);
      elapsedSecondsRef.current = 0;
      elapsedBeforePauseRef.current = 0;

      await loadRecordings();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Recording save failed");
    } finally {
      setUploading(false);
      stopAllTracks();
      saveInProgressRef.current = false;
    }
  }

  function stopRecording() {
    setError("");
    setMessage("");

    if (!recorderRef.current) {
      return;
    }

    if (recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }

    clearTimer();
  }

  function pauseRecording() {
    if (!recorderRef.current || recorderRef.current.state !== "recording") {
      return;
    }

    recorderRef.current.pause();
    setIsPaused(true);
    pauseTimer();
  }

  function resumeRecording() {
    if (!recorderRef.current || recorderRef.current.state !== "paused") {
      return;
    }

    recorderRef.current.resume();
    setIsPaused(false);
    resumeTimer();
  }

  async function removeRecording(recordingId: string) {
    setError("");
    setMessage("");

    try {
      await deleteMeetingRecording(recordingId);
      setMessage("Recording deleted successfully.");
      await loadRecordings();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Recording delete failed");
    }
  }

  return (
    <section className="recording-card">
      <div className="recording-header">
        <div>
          <p className="eyebrow">Recording</p>
          <h3>Meeting Recording</h3>
        </div>

        {isRecording && (
          <div className="recording-live-badge">
            <span />
            REC {formatDuration(elapsedSeconds)}
          </div>
        )}
      </div>

      <p className="recording-help">
        This records the actual browser tab/window you select. For meeting recording, choose the
        current MeetSync meeting tab when the browser asks what to share.
      </p>

      {message && <div className="success-box">{message}</div>}
      {error && <div className="error-box">{error}</div>}

      <div className="recording-actions">
        {!isRecording ? (
          <button className="danger-button" onClick={startRecording} disabled={uploading}>
            {uploading ? "Saving..." : "Start Recording"}
          </button>
        ) : (
          <>
            {!isPaused ? (
              <button className="secondary-button" onClick={pauseRecording}>
                Pause
              </button>
            ) : (
              <button className="primary-button" onClick={resumeRecording}>
                Resume
              </button>
            )}

            <button className="danger-button" onClick={stopRecording}>
              Stop & Save
            </button>
          </>
        )}
      </div>

      <div className="recording-list">
        <div className="section-title compact-section-title">
          <h3>Saved Recordings</h3>
          <span>{recordings.length}</span>
        </div>

        {recordings.length ? (
          recordings.map((recording) => (
            <div className="recording-item" key={recording.id}>
              <div>
                <strong>{recording.original_name || recording.file_name}</strong>
                <p>
                  {formatDuration(recording.duration_seconds)} · {formatBytes(recording.size_bytes)}
                </p>
              </div>

              <div className="recording-item-actions">
                <a
                  className="secondary-button"
                  href={getRecordingDownloadUrl(recording.id)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Download
                </a>

                <button
                  className="danger-outline-button"
                  onClick={() => removeRecording(recording.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="empty-state">No recordings saved for this meeting yet.</div>
        )}
      </div>
    </section>
  );
}
