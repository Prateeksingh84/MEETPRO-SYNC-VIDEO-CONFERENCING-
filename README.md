# Zoomly Meetings — Full-Stack Zoom Clone

A functional Zoom-style video conferencing platform built for an SDE Fullstack assignment.

The project focuses on the assignment requirements: Zoom-like dashboard UI, instant meeting creation, meeting joining through ID/invite link, meeting scheduling, SQLite persistence, seed data, real-time participant updates, WebRTC video/audio, chat, and host controls.

## Tech Stack

### Frontend
- Next.js 14 App Router
- React 18
- TypeScript
- Plain CSS with responsive Zoom-inspired UI
- WebRTC using `RTCPeerConnection`
- Browser media APIs: `getUserMedia`, `getDisplayMedia`

### Backend
- Python 3.12
- FastAPI
- FastAPI WebSockets for meeting signaling
- SQLAlchemy ORM
- SQLite database
- Uvicorn ASGI server

## Core Features Implemented

### 1. Landing Dashboard
- Professional Zoom-inspired UI
- Top navbar with profile/settings placeholders
- New Meeting button
- Join Meeting button
- Schedule Meeting button
- Upcoming meetings section
- Recent meetings section
- Seeded sample meetings

### 2. Instant Meeting Creation
- Creates a meeting instantly through FastAPI
- Generates a unique Zoom-style meeting ID such as `821-419-305`
- Generates shareable invite link
- Redirects directly to the meeting room

### 3. Join Meeting
- Join using Meeting ID
- Invite link opens `/join?meetingId=...`
- Display name required before joining
- Backend validates meeting existence
- Pre-join screen with mic/camera preview

### 4. Schedule Meetings
- Title
- Description
- Date and time picker
- Duration selector
- Auto-generated invite link
- Stored in SQLite
- Displayed in Upcoming Meetings

### 5. Real-Time Meeting Room
- WebRTC peer-to-peer audio/video
- FastAPI WebSocket signaling
- Real-time participant join/leave
- Real-time mute/camera status
- Real-time group chat
- Screen sharing
- Copy invite link
- Host controls:
  - Mute all
  - Remove participant

## Database Design

The SQLite schema uses three main tables.

### `meetings`
Stores meeting-level information.

| Column | Purpose |
|---|---|
| `id` | Internal primary key |
| `meeting_id` | Public Zoom-style unique ID |
| `title` | Meeting title |
| `description` | Optional description |
| `start_time` | Scheduled or instant start time |
| `duration_minutes` | Meeting duration |
| `host_name` | Host display name |
| `invite_link` | Shareable meeting invite |
| `meeting_type` | `instant` or `scheduled` |
| `created_at` | Created timestamp |

### `participants`
Tracks users joining meetings.

| Column | Purpose |
|---|---|
| `id` | Internal primary key |
| `public_id` | UUID exposed to client |
| `meeting_id` | Foreign key to meetings |
| `display_name` | Participant name |
| `is_host` | Host permission flag |
| `is_muted` | Last known mute state |
| `camera_on` | Last known camera state |
| `joined_at` | Join timestamp |
| `left_at` | Leave timestamp |

### `chat_messages`
Persists meeting chat messages.

| Column | Purpose |
|---|---|
| `id` | Message primary key |
| `meeting_id` | Foreign key to meetings |
| `participant_public_id` | Sender public UUID |
| `sender_name` | Sender display name |
| `message` | Message body |
| `created_at` | Message timestamp |

## Architecture

```text
Next.js Client
  ├── Dashboard / Join / Meeting Room UI
  ├── REST API calls for meetings and scheduling
  ├── WebRTC media peer connections
  └── WebSocket signaling messages

FastAPI Backend
  ├── REST APIs for meeting CRUD workflows
  ├── SQLite + SQLAlchemy persistence
  ├── WebSocket room manager
  └── WebRTC signaling relay

SQLite Database
  ├── meetings
  ├── participants
  └── chat_messages
```

## Local Setup

### 1. Clone repository

```bash
git clone <your-repo-url>
cd zoom-clone-fullstack
```

### 2. Start backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate     # Windows PowerShell
# source .venv/bin/activate # macOS/Linux
pip install -r requirements.txt
copy .env.example .env      # Windows
# cp .env.example .env      # macOS/Linux
uvicorn app.main:app --reload --port 8000
```

Backend runs at:

```text
http://localhost:8000
```

Swagger docs:

```text
http://localhost:8000/docs
```

### 3. Start frontend

Open another terminal:

```bash
cd frontend
npm install
copy .env.local.example .env.local      # Windows
# cp .env.local.example .env.local      # macOS/Linux
npm run dev
```

Frontend runs at:

```text
http://localhost:3000
```

## Docker Setup

```bash
docker compose up --build
```

Then open:

```text
http://localhost:3000
```

## Deployment Guide

### Backend on Render

1. Push repository to GitHub.
2. Create a new Render Web Service.
3. Set root directory to `backend`.
4. Build command:

```bash
pip install -r requirements.txt
```

5. Start command:

```bash
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

6. Add environment variables:

```text
FRONTEND_ORIGIN=https://your-vercel-app.vercel.app
CORS_ORIGINS=https://your-vercel-app.vercel.app
DATABASE_URL=sqlite:///./zoom_clone.db
```

### Frontend on Vercel

1. Import the GitHub repository on Vercel.
2. Set root directory to `frontend`.
3. Add environment variable:

```text
NEXT_PUBLIC_API_URL=https://your-render-backend.onrender.com
```

4. Deploy.

## Important WebRTC Notes

- Camera and microphone access require `localhost` or HTTPS.
- Deployed frontend/backend should use HTTPS/WSS.
- This project uses peer-to-peer mesh WebRTC, which is good for assignment demos and small rooms.
- Production Zoom-scale systems usually use SFU/media servers such as LiveKit, mediasoup, Janus, or Twilio.
- A TURN server is recommended for better NAT traversal in production.

## Suggested Demo Flow

1. Open dashboard.
2. Click **New Meeting**.
3. Copy invite link.
4. Open the invite in another browser/incognito tab.
5. Join with a second display name.
6. Test:
   - Audio/video tiles
   - Mute/unmute
   - Stop/start camera
   - Chat
   - Screen share
   - Host mute all
   - Host remove participant
7. Go back to dashboard and schedule a meeting.

## Assumptions

- No login required; default user is assumed to be logged in.
- First participant in a meeting becomes host.
- If display name matches host name, that participant is also treated as host.
- SQLite is used as required by the assignment.
- WebSocket room state is stored in memory because it only represents currently connected users.
- Durable meeting, participant, and chat records are stored in SQLite.

## Interview Explanation Summary

I separated the project into frontend, backend, database, and real-time layers. REST APIs handle durable workflows like creating, joining, and scheduling meetings. WebSockets handle temporary real-time events such as signaling, chat, mute state, and participant updates. WebRTC handles actual audio/video streams directly between browsers, while FastAPI acts as the signaling server. SQLite stores meetings, participant sessions, and chat history using normalized relationships.
