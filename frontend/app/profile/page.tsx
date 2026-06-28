"use client";

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardHeader } from "@/components/DashboardHeader";
import {
  confirmEmailVerification,
  deleteProfileAccount,
  getProfile,
  requestEmailVerification,
  updateProfile,
  updateProfilePhoto,
  UserProfile,
} from "@/lib/api";

const TOKEN_KEY = "meetsync-auth-v2";
const USER_KEY = "meetsync-user-v2";

type LocalUser = {
  public_id: string;
  name: string;
  email: string;
  profile_photo?: string;
};

export default function ProfilePage() {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [authReady, setAuthReady] = useState(false);
  const [localUser, setLocalUser] = useState<LocalUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [role, setRole] = useState("");
  const [location, setLocation] = useState("");

  const [sourceImage, setSourceImage] = useState("");
  const [editedPhoto, setEditedPhoto] = useState("");
  const [isPhotoEditing, setIsPhotoEditing] = useState(false);

  const [zoom, setZoom] = useState(1.15);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [cropX, setCropX] = useState(0);
  const [cropY, setCropY] = useState(0);

  const [verificationCode, setVerificationCode] = useState("");
  const [visibleCode, setVisibleCode] = useState("");
  const [deleteEmail, setDeleteEmail] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    const rawUser = localStorage.getItem(USER_KEY);

    if (!token || !rawUser) {
      router.replace("/auth");
      return;
    }

    const parsedUser = JSON.parse(rawUser) as LocalUser;

    setLocalUser(parsedUser);
    setAuthReady(true);
  }, [router]);

  useEffect(() => {
    if (!authReady || !localUser?.public_id) return;

    loadProfile(localUser.public_id);
  }, [authReady, localUser?.public_id]);

  useEffect(() => {
    drawEditedPhoto();
  }, [sourceImage, zoom, brightness, contrast, cropX, cropY]);

  async function loadProfile(publicId: string) {
    setLoading(true);
    setError("");

    try {
      const data = await getProfile(publicId);

      setProfile(data);
      setName(data.name);
      setBio(data.bio || "");
      setRole(data.role || "");
      setLocation(data.location || "");
      setDeleteEmail(data.email || "");

      if (data.profile_photo) {
        setEditedPhoto(data.profile_photo);
      }

      setIsPhotoEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load profile");
    } finally {
      setLoading(false);
    }
  }

  function updateLocalProfile(data: UserProfile) {
    if (!localUser) return;

    const updatedUser = {
      ...localUser,
      name: data.name,
      email: data.email,
      profile_photo: data.profile_photo,
    };

    setLocalUser(updatedUser);
    localStorage.setItem(USER_KEY, JSON.stringify(updatedUser));
  }

  async function saveBasicProfile(event: FormEvent) {
    event.preventDefault();

    if (!localUser) return;

    setError("");
    setSuccess("");

    try {
      const updated = await updateProfile(localUser.public_id, {
        name,
        bio,
        role,
        location,
      });

      setProfile(updated);
      updateLocalProfile(updated);
      setSuccess("Profile updated successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update profile");
    }
  }

  function handleImageUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please upload a valid image file.");
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      setSourceImage(String(reader.result));
      setZoom(1.15);
      setBrightness(100);
      setContrast(100);
      setCropX(0);
      setCropY(0);
      setIsPhotoEditing(true);
      setSuccess("");
      setError("");
    };

    reader.readAsDataURL(file);
  }

  function drawEditedPhoto() {
    if (!sourceImage || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");

    if (!context) return;

    const image = new Image();

    image.onload = () => {
      const size = 420;

      canvas.width = size;
      canvas.height = size;

      context.clearRect(0, 0, size, size);
      context.save();

      context.beginPath();
      context.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
      context.clip();

      context.filter = `brightness(${brightness}%) contrast(${contrast}%)`;

      const baseScale = Math.max(size / image.width, size / image.height);
      const finalScale = baseScale * zoom;

      const drawWidth = image.width * finalScale;
      const drawHeight = image.height * finalScale;

      const x = (size - drawWidth) / 2 + cropX;
      const y = (size - drawHeight) / 2 + cropY;

      context.drawImage(image, x, y, drawWidth, drawHeight);
      context.restore();

      const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
      setEditedPhoto(dataUrl);
    };

    image.src = sourceImage;
  }

  async function savePhoto() {
    if (!localUser) return;

    if (!editedPhoto) {
      setError("Please upload a photo first.");
      return;
    }

    setError("");
    setSuccess("");

    try {
      const updated = await updateProfilePhoto(localUser.public_id, editedPhoto);

      setProfile(updated);
      updateLocalProfile(updated);

      setSourceImage("");
      setIsPhotoEditing(false);

      setSuccess("Profile photo updated successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update profile photo");
    }
  }

  async function removePhoto() {
    if (!localUser) return;

    setError("");
    setSuccess("");

    try {
      const updated = await updateProfilePhoto(localUser.public_id, "");

      setProfile(updated);
      updateLocalProfile(updated);

      setSourceImage("");
      setEditedPhoto("");
      setIsPhotoEditing(false);

      setSuccess("Profile photo removed successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove photo");
    }
  }

  async function sendVerificationCode() {
    if (!localUser) return;

    setError("");
    setSuccess("");
    setVisibleCode("");

    try {
      const data = await requestEmailVerification(localUser.public_id);

      setVisibleCode(data.code);
      setSuccess("Verification code generated. Use the code shown below for local MVP.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate verification code");
    }
  }

  async function verifyEmail(event: FormEvent) {
    event.preventDefault();

    if (!localUser) return;

    setError("");
    setSuccess("");

    try {
      const updated = await confirmEmailVerification(localUser.public_id, verificationCode);

      setProfile(updated);
      updateLocalProfile(updated);
      setVerificationCode("");
      setVisibleCode("");
      setSuccess("Email verified successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not verify email");
    }
  }

  async function deleteAccount(event: FormEvent) {
    event.preventDefault();

    if (!localUser) return;

    const confirmed = window.confirm(
      "This will permanently delete your account from this local project database. Continue?",
    );

    if (!confirmed) return;

    setError("");
    setSuccess("");

    try {
      await deleteProfileAccount(localUser.public_id, deleteEmail);

      localStorage.removeItem("meetsync-token");
      localStorage.removeItem("meetsync-user");
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);

      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete account");
    }
  }

  if (!authReady) {
    return null;
  }

  const avatarInitial = profile?.name?.trim()?.charAt(0)?.toUpperCase() || "U";

  return (
    <main className="dashboard-page">
      <DashboardHeader />

      <section className="profile-page">
        <div className="workspace-title-row">
          <div>
            <p className="eyebrow">User Profile</p>
            <h2>Manage your profile</h2>
            <p>
              Update your profile, photo, email verification, and account security from one place.
            </p>
          </div>
        </div>

        {loading && <div className="empty-state">Loading profile...</div>}
        {success && <div className="success-box">{success}</div>}
        {error && <div className="error-box">{error}</div>}

        <div className="profile-layout">
          <section className="profile-card profile-summary-card">
            <div className="profile-avatar-large">
              {editedPhoto || profile?.profile_photo ? (
                <img src={editedPhoto || profile?.profile_photo} alt="Profile" />
              ) : (
                <span>{avatarInitial}</span>
              )}
            </div>

            <canvas ref={canvasRef} className="hidden-crop-canvas" />

            <h3>{profile?.name || "User"}</h3>
            <p>{profile?.email}</p>

            <div className={profile?.email_verified ? "verified-pill" : "unverified-pill"}>
              {profile?.email_verified ? "✅ Email Verified" : "⚠️ Email Not Verified"}
            </div>

            <div className="profile-mini-info">
              <div>
                <strong>{profile?.role || "Role not added"}</strong>
                <span>Role</span>
              </div>

              <div>
                <strong>{profile?.location || "Location not added"}</strong>
                <span>Location</span>
              </div>
            </div>

            <div className="inline-photo-editor">
              <h4>Profile Photo</h4>

              <label className="inline-upload-button">
                {editedPhoto || profile?.profile_photo ? "Change Photo" : "Upload Photo"}
                <input type="file" accept="image/*" onChange={handleImageUpload} />
              </label>

              {isPhotoEditing && sourceImage && (
                <>
                  <div className="inline-editor-controls">
                    <label>
                      Zoom
                      <input
                        type="range"
                        min="1"
                        max="3"
                        step="0.05"
                        value={zoom}
                        onChange={(event) => setZoom(Number(event.target.value))}
                      />
                    </label>

                    <label>
                      Move X
                      <input
                        type="range"
                        min="-160"
                        max="160"
                        value={cropX}
                        onChange={(event) => setCropX(Number(event.target.value))}
                      />
                    </label>

                    <label>
                      Move Y
                      <input
                        type="range"
                        min="-160"
                        max="160"
                        value={cropY}
                        onChange={(event) => setCropY(Number(event.target.value))}
                      />
                    </label>

                    <label>
                      Brightness
                      <input
                        type="range"
                        min="50"
                        max="160"
                        value={brightness}
                        onChange={(event) => setBrightness(Number(event.target.value))}
                      />
                    </label>

                    <label>
                      Contrast
                      <input
                        type="range"
                        min="50"
                        max="170"
                        value={contrast}
                        onChange={(event) => setContrast(Number(event.target.value))}
                      />
                    </label>
                  </div>

                  <div className="profile-action-row compact-profile-actions">
                    <button className="primary-button" type="button" onClick={savePhoto}>
                      Save Photo
                    </button>

                    <button className="secondary-button" type="button" onClick={removePhoto}>
                      Remove
                    </button>
                  </div>
                </>
              )}

              {!isPhotoEditing && (editedPhoto || profile?.profile_photo) && (
                <div className="profile-action-row compact-profile-actions">
                  <button className="secondary-button" type="button" onClick={removePhoto}>
                    Remove Photo
                  </button>
                </div>
              )}
            </div>
          </section>

          <section className="profile-card">
            <h3>Basic information</h3>

            <form className="form-stack" onSubmit={saveBasicProfile}>
              <label>
                Name
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Enter your name"
                  required
                />
              </label>

              <label>
                Role
                <input
                  value={role}
                  onChange={(event) => setRole(event.target.value)}
                  placeholder="Example: Software Engineer"
                />
              </label>

              <label>
                Location
                <input
                  value={location}
                  onChange={(event) => setLocation(event.target.value)}
                  placeholder="Example: New Delhi, India"
                />
              </label>

              <label>
                Bio
                <textarea
                  rows={4}
                  value={bio}
                  onChange={(event) => setBio(event.target.value)}
                  placeholder="Write a short profile bio"
                />
              </label>

              <button className="primary-button" type="submit">
                Save Profile
              </button>
            </form>
          </section>

          <section className="profile-card">
            <h3>Email verification</h3>

            <p className="muted-text">
              Verify your email for account trust and future meeting notifications.
            </p>

            <button className="secondary-button" type="button" onClick={sendVerificationCode}>
              Generate Verification Code
            </button>

            {visibleCode && (
              <div className="local-code-box">
                Local MVP verification code: <strong>{visibleCode}</strong>
              </div>
            )}

            <form className="form-stack" onSubmit={verifyEmail}>
              <label>
                Enter verification code
                <input
                  value={verificationCode}
                  onChange={(event) => setVerificationCode(event.target.value)}
                  placeholder="Enter 6-digit code"
                />
              </label>

              <button className="primary-button" type="submit">
                Verify Email
              </button>
            </form>
          </section>

          <section className="profile-card danger-zone-card">
            <h3>Delete account</h3>

            <p>
              This removes your account from the local backend database. Enter your email
              to confirm deletion.
            </p>

            <form className="form-stack" onSubmit={deleteAccount}>
              <label>
                Confirm email
                <input
                  type="email"
                  value={deleteEmail}
                  onChange={(event) => setDeleteEmail(event.target.value)}
                  placeholder="Enter your account email"
                  required
                />
              </label>

              <button className="danger-button" type="submit">
                Delete Account
              </button>
            </form>
          </section>
        </div>
      </section>
    </main>
  );
}