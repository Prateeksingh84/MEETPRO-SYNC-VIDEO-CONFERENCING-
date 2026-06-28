"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { DashboardHeader } from "@/components/DashboardHeader";

export default function SettingsPage() {
  const [displayName, setDisplayName] = useState("Prateek Singh");
  const [videoQuality, setVideoQuality] = useState("HD 720p");
  const [defaultMute, setDefaultMute] = useState(false);
  const [joinWithCamera, setJoinWithCamera] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem("meetsync-settings");

    if (raw) {
      const settings = JSON.parse(raw);

      setDisplayName(settings.displayName || "Prateek Singh");
      setVideoQuality(settings.videoQuality || "HD 720p");
      setDefaultMute(Boolean(settings.defaultMute));
      setJoinWithCamera(settings.joinWithCamera !== false);
    }
  }, []);

  function save(event: FormEvent) {
    event.preventDefault();

    localStorage.setItem(
      "meetsync-settings",
      JSON.stringify({
        displayName,
        videoQuality,
        defaultMute,
        joinWithCamera,
      }),
    );

    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <main className="dashboard-page">
      <DashboardHeader />

      <section className="settings-page">
        <div className="workspace-title-row">
          <div>
            <p className="eyebrow">Profile / Settings</p>
            <h2>Settings</h2>

            <p>
              Zoom-style settings page for profile, video, audio, and meeting preferences.
              Values are saved locally for demo purposes.
            </p>
          </div>

          <Link href="/" className="secondary-button">
            Back to Dashboard
          </Link>
        </div>

        <form className="settings-grid" onSubmit={save}>
          <section className="workspace-card">
            <h3>Profile</h3>

            <label>
              Display name
              <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
            </label>

            <label>
              Status
              <select defaultValue="Available">
                <option>Available</option>
                <option>Busy</option>
                <option>In a meeting</option>
              </select>
            </label>
          </section>

          <section className="workspace-card">
            <h3>Video</h3>

            <label>
              Default video quality
              <select value={videoQuality} onChange={(event) => setVideoQuality(event.target.value)}>
                <option>HD 720p</option>
                <option>Full HD 1080p</option>
                <option>Bandwidth Saver</option>
              </select>
            </label>

            <label className="switch-row">
              <input
                type="checkbox"
                checked={joinWithCamera}
                onChange={(event) => setJoinWithCamera(event.target.checked)}
              />
              Join meetings with camera on
            </label>
          </section>

          <section className="workspace-card">
            <h3>Audio</h3>

            <label className="switch-row">
              <input
                type="checkbox"
                checked={defaultMute}
                onChange={(event) => setDefaultMute(event.target.checked)}
              />
              Join meetings muted
            </label>

            <div className="success-box">Microphone and speaker selection placeholder added.</div>
          </section>

          <section className="workspace-card">
            <h3>Meeting Controls</h3>

            <p className="muted-text">
              Host controls are available inside the meeting room: mute all and remove participant.
            </p>

            <button className="primary-button" type="submit">
              Save Settings
            </button>

            {saved && <div className="success-box">Settings saved successfully.</div>}
          </section>
        </form>
      </section>
    </main>
  );
}
