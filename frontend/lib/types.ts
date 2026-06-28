export type User = {
  public_id: string;
  name: string;
  email: string;
  created_at: string;
};

export type AuthResponse = {
  token: string;
  user: User;
};

export type Meeting = {
  meeting_id: string;
  title: string;
  description?: string | null;
  start_time?: string | null;
  duration_minutes: number;
  host_name: string;
  invite_link: string;
  meeting_type: "instant" | "scheduled";
  created_at: string;
};

export type Dashboard = {
  upcoming: Meeting[];
  recent: Meeting[];
};

export type PlatformSummary = {
  totalMeetings: number;
  scheduledMeetings: number;
  instantMeetings: number;
  totalParticipants: number;
  activeParticipants: number;
  totalMessages: number;
  liveDashboardClients: number;
  liveWorkspaceRooms: number;
  updatedAt: string;
};

export type JoinResponse = {
  participant_id: string;
  meeting: Meeting;
  is_host: boolean;
};

export type RoomParticipant = {
  participantId: string;
  displayName: string;
  isHost: boolean;
  isMuted: boolean;
  cameraOn: boolean;
};

export type ChatMessage = {
  id: string | number;
  participantId: string;
  senderName: string;
  message: string;
  createdAt: string;
};

export type WorkspaceUser = {
  clientId: string;
  name: string;
  joinedAt: string;
};

export type WorkspaceChatMessage = {
  id: string;
  senderName: string;
  message: string;
  createdAt: string;
};

export type WhiteboardStroke = {
  id: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  color: string;
  width: number;
  author: string;
};

export type AppEvent = {
  id: string;
  app: string;
  action: string;
  actor: string;
  createdAt: string;
};
