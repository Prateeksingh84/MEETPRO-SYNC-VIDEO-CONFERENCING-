import { Dashboard, Meeting, PlatformSummary, User } from "@/lib/types";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  "http://localhost:8000";

function buildUrl(path: string) {
  if (path.startsWith("http")) {
    return path;
  }

  return `${API_BASE}${path}`;
}

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(buildUrl(path), {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.detail || data?.message || "API request failed");
  }

  return data as T;
}

/* =========================
   AUTH
   ========================= */

export type AuthResponse = {
  token: string;
  user: User;
};

export type SignupPayload = {
  name: string;
  email: string;
  password: string;
};

export type LoginPayload = {
  email: string;
  password: string;
};

export async function signup(payload: SignupPayload): Promise<AuthResponse> {
  return apiRequest<AuthResponse>("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function login(payload: LoginPayload): Promise<AuthResponse> {
  return apiRequest<AuthResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/* =========================
   DASHBOARD
   ========================= */

export async function getDashboard(): Promise<Dashboard> {
  return apiRequest<Dashboard>("/api/dashboard");
}

export async function getPlatformSummary(): Promise<PlatformSummary> {
  return apiRequest<PlatformSummary>("/api/platform-summary");
}

export function getDashboardWsUrl(): string {
  const wsBase = API_BASE.replace("http://", "ws://").replace("https://", "wss://");
  return `${wsBase}/ws/dashboard`;
}

/* =========================
   MEETINGS
   ========================= */

export type ScheduleMeetingPayload = {
  title: string;
  description?: string;
  start_time: string;
  duration_minutes: number;
};

export type JoinMeetingResponse = {
  meeting: Meeting;
  participant: {
    public_id: string;
    display_name: string;
    is_host: boolean;
    is_muted: boolean;
    camera_on: boolean;
    joined_at?: string;
  };
};

export type ChatMessage = {
  id?: number;
  sender_name: string;
  message: string;
  created_at?: string;
};

export async function createInstantMeeting(hostName: string): Promise<Meeting> {
  return apiRequest<Meeting>("/api/meetings/instant", {
    method: "POST",
    body: JSON.stringify({
      host_name: hostName,
    }),
  });
}

export async function scheduleMeeting(payload: ScheduleMeetingPayload): Promise<Meeting> {
  return apiRequest<Meeting>("/api/meetings/schedule", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getMeeting(meetingId: string): Promise<Meeting> {
  return apiRequest<Meeting>(`/api/meetings/${meetingId}`);
}

export async function joinMeeting(
  meetingId: string,
  displayName: string,
): Promise<JoinMeetingResponse> {
  return apiRequest<JoinMeetingResponse>(`/api/meetings/${meetingId}/join`, {
    method: "POST",
    body: JSON.stringify({
      display_name: displayName,
    }),
  });
}

export async function leaveMeeting(
  meetingId: string,
  participantPublicId: string,
): Promise<{ message: string }> {
  return apiRequest<{ message: string }>(`/api/meetings/${meetingId}/leave`, {
    method: "POST",
    body: JSON.stringify({
      participant_public_id: participantPublicId,
    }),
  });
}

export async function updateParticipantMediaState(
  meetingId: string,
  payload: {
    participant_public_id: string;
    is_muted?: boolean;
    camera_on?: boolean;
  },
): Promise<{ message: string }> {
  return apiRequest<{ message: string }>(`/api/meetings/${meetingId}/media`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function sendMeetingChatMessage(
  meetingId: string,
  payload: {
    participant_public_id: string;
    sender_name: string;
    message: string;
  },
): Promise<ChatMessage> {
  return apiRequest<ChatMessage>(`/api/meetings/${meetingId}/chat`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getMeetingWsUrl(meetingId: string): string {
  const wsBase = API_BASE.replace("http://", "ws://").replace("https://", "wss://");
  return `${wsBase}/ws/meetings/${meetingId}`;
}

export function getWsUrl(meetingId: string): string {
  return getMeetingWsUrl(meetingId);
}

/* =========================
   WORKSPACE
   ========================= */

export function getWorkspaceWsUrl(roomId: string): string {
  const wsBase = API_BASE.replace("http://", "ws://").replace("https://", "wss://");
  return `${wsBase}/ws/workspace/${roomId}`;
}

/* =========================
   PROFILE
   ========================= */

export type UserProfile = {
  public_id: string;
  name: string;
  email: string;
  profile_photo: string;
  bio: string;
  role: string;
  location: string;
  email_verified: boolean;
  created_at: string;
  updated_at: string;
};

export async function getProfile(publicId: string): Promise<UserProfile> {
  return apiRequest<UserProfile>(`/api/profile/${publicId}`);
}

export async function updateProfile(
  publicId: string,
  payload: {
    name: string;
    bio: string;
    role: string;
    location: string;
  },
): Promise<UserProfile> {
  return apiRequest<UserProfile>(`/api/profile/${publicId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function updateProfilePhoto(
  publicId: string,
  profilePhoto: string,
): Promise<UserProfile> {
  return apiRequest<UserProfile>(`/api/profile/${publicId}/photo`, {
    method: "POST",
    body: JSON.stringify({
      profile_photo: profilePhoto,
    }),
  });
}

export async function requestEmailVerification(publicId: string): Promise<{
  message: string;
  code: string;
  note: string;
}> {
  return apiRequest(`/api/profile/${publicId}/verify-email/request`, {
    method: "POST",
  });
}

export async function confirmEmailVerification(
  publicId: string,
  code: string,
): Promise<UserProfile> {
  return apiRequest<UserProfile>(`/api/profile/${publicId}/verify-email/confirm`, {
    method: "POST",
    body: JSON.stringify({
      code,
    }),
  });
}

export async function deleteProfileAccount(
  publicId: string,
  email: string,
): Promise<{ message: string }> {
  return apiRequest<{ message: string }>(`/api/profile/${publicId}`, {
    method: "DELETE",
    body: JSON.stringify({
      email,
    }),
  });
}

/* =========================
   APPS / INTEGRATIONS
   ========================= */

export type IntegrationApp = {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  status: "connected" | "not_connected" | "oauth_required";
  actionLabel: string;
};

export type AppsResponse = {
  apps: IntegrationApp[];
};

export type IntegrationStatus = {
  google: boolean;
  slack: boolean;
  drive: boolean;
  calendar: boolean;
};

export async function getApps(): Promise<AppsResponse> {
  return apiRequest<AppsResponse>("/api/apps");
}

export async function getIntegrationStatus(): Promise<IntegrationStatus> {
  return apiRequest<IntegrationStatus>("/api/integrations/status");
}

export async function connectApp(appId: string): Promise<{
  message: string;
  status: string;
}> {
  return apiRequest(`/api/integrations/${appId}/connect`, {
    method: "POST",
  });
}

export async function disconnectApp(appId: string): Promise<{
  message: string;
  status: string;
}> {
  return apiRequest(`/api/integrations/${appId}/disconnect`, {
    method: "POST",
  });
}

export async function getGoogleAuthUrl(): Promise<string> {
  const data = await apiRequest<{ url?: string; auth_url?: string }>(
    "/api/integrations/google/connect",
  );

  return data.url || data.auth_url || "";
}

export async function getGoogleConnectUrl(): Promise<{ url: string }> {
  const url = await getGoogleAuthUrl();

  return {
    url,
  };
}

export function openGoogleConnect() {
  window.location.href = `${API_BASE}/api/integrations/google/connect`;
}

export async function testSlackConnection(): Promise<{
  message: string;
  status: string;
}> {
  return apiRequest<{ message: string; status: string }>("/api/integrations/slack/test", {
    method: "POST",
  });
}

export async function testSlackIntegration(): Promise<{
  message: string;
  status: string;
}> {
  return testSlackConnection();
}

export async function createGoogleCalendarEvent(payload: {
  title?: string;
  description?: string;
  start_time?: string;
  duration_minutes?: number;
} = {}): Promise<{
  message: string;
  status: string;
  event?: unknown;
}> {
  return apiRequest("/api/integrations/google/calendar-event", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function createGoogleDriveNotes(payload: {
  title?: string;
  content?: string;
} = {}): Promise<{
  message: string;
  status: string;
  file?: unknown;
}> {
  return apiRequest("/api/integrations/google/drive-notes", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function shareMeetingToSlack(payload: {
  channel?: string;
  message?: string;
  meeting_id?: string;
} = {}): Promise<{
  message: string;
  status: string;
}> {
  return apiRequest("/api/integrations/slack/share", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
export type MeetingRecording = {
  id: string;
  meeting_id: string;
  file_name: string;
  original_name: string;
  content_type: string;
  size_bytes: number;
  duration_seconds: number;
  created_at: string;
  download_url: string;
};

export type MeetingRecordingsResponse = {
  recordings: MeetingRecording[];
};

export async function getMeetingRecordings(
  meetingId: string,
): Promise<MeetingRecordingsResponse> {
  return apiRequest<MeetingRecordingsResponse>(`/api/meetings/${meetingId}/recordings`);
}

export async function uploadMeetingRecording(
  meetingId: string,
  recordingBlob: Blob,
  fileName: string,
  durationSeconds: number,
): Promise<MeetingRecording> {
  const formData = new FormData();

  formData.append("file", recordingBlob, fileName);
  formData.append("duration_seconds", String(durationSeconds));

  const response = await fetch(`${API_BASE}/api/meetings/${meetingId}/recordings`, {
    method: "POST",
    body: formData,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.detail || data?.message || "Recording upload failed");
  }

  return data as MeetingRecording;
}

export async function deleteMeetingRecording(recordingId: string): Promise<{ message: string }> {
  return apiRequest<{ message: string }>(`/api/recordings/${recordingId}`, {
    method: "DELETE",
  });
}

export function getRecordingDownloadUrl(recordingId: string): string {
  return `${API_BASE}/api/recordings/${recordingId}/download`;
}