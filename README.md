<div align="center">

<!-- Animated Banner -->
<img src="https://capsule-render.vercel.app/api?type=waving&color=0:2D8CFF,100:00C2FF&height=200&section=header&text=Zoomly%20Meetings&fontSize=60&fontColor=ffffff&animation=fadeIn&fontAlignY=38&desc=A%20Full-Stack%20Zoom%20Clone&descAlignY=58&descSize=20&descColor=d0eaff" width="100%"/>

<!-- Animated Typing -->
<img src="https://readme-typing-svg.demolab.com?font=Fira+Code&weight=600&size=22&pause=1000&color=2D8CFF&center=true&vCenter=true&width=600&lines=Real-Time+Video+Conferencing+%F0%9F%8E%A5;WebRTC+Peer-to-Peer+Mesh+%F0%9F%94%97;FastAPI+%2B+Next.js+14+%F0%9F%9A%80;WebSocket+Signaling+%E2%9A%A1;Built+for+SDE+Fullstack+Assignment+%F0%9F%92%AA" alt="Typing SVG" />

<br/>

<!-- Badges Row 1 -->
[![Next.js](https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Python](https://img.shields.io/badge/Python-3.12-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org/)

<!-- Badges Row 2 -->
[![WebRTC](https://img.shields.io/badge/WebRTC-P2P_Mesh-333333?style=for-the-badge&logo=webrtc&logoColor=white)](https://webrtc.org/)
[![SQLite](https://img.shields.io/badge/SQLite-Database-003B57?style=for-the-badge&logo=sqlite&logoColor=white)](https://sqlite.org/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](./LICENSE)

</div>

---

## 🌊 Overview

> **Zoomly Meetings** is a production-inspired video conferencing platform built from the ground up — covering everything from real-time WebRTC peer connections to a FastAPI WebSocket signaling layer and a full SQLite-backed scheduling system.

This was built for **MEETPRO_SYNC_VIDEO_CONFERENCING**, and it nails all the key requirements:

| ✅ Feature | Description |
|---|---|
| 🖥️ Dashboard UI | Zoom-style top navbar, meeting cards, schedule view |
| ⚡ Instant Meetings | One-click creation with unique `XXX-XXX-XXX` meeting IDs |
| 🔗 Join by ID / Link | ID entry or invite link, display name gate, camera preview |
| 📅 Schedule Meetings | Title, description, date/time, duration — all persisted |
| 🎥 WebRTC Video/Audio | Full peer-to-peer mesh with `RTCPeerConnection` |
| 💬 Real-Time Chat | Group chat with message persistence in SQLite |
| 👑 Host Controls | Mute all, remove participant, screen share |
| 🗄️ SQLite Persistence | Meetings, participants, and chat messages |
| 🌱 Seed Data | Pre-loaded sample meetings for demo |

---

## 🏗️ Tech Stack

<div align="center">

```
┌─────────────────────────────────────────────────────────┐
│                     ZOOMLY STACK                        │
│                                                         │
│  🌐 FRONTEND              ⚙️  BACKEND                   │
│  ─────────────────        ─────────────────────         │
│  Next.js 14 (App Router)  FastAPI (Python 3.12)         │
│  React 18                 FastAPI WebSockets            │
│  TypeScript               SQLAlchemy ORM                │
│  Plain CSS (Zoom UI)      SQLite Database               │
│  WebRTC (RTCPeerConn)     Uvicorn ASGI                  │
│  getUserMedia             REST + WS APIs                │
│  getDisplayMedia                                        │
│                                                         │
│  📡 REAL-TIME LAYER       🗄️  DATABASE                  │
│  ─────────────────        ─────────────────             │
│  WebSocket Signaling      meetings                      │
│  SDP Offer/Answer         participants                  │
│  ICE Candidate Relay      chat_messages                 │
└─────────────────────────────────────────────────────────┘
```

</div>

---

## ✨ Core Features

<details>
<summary><b>🏠 Landing Dashboard</b></summary>

<br/>

- Professional Zoom-inspired UI with full top navbar
- **New Meeting**, **Join Meeting**, and **Schedule Meeting** quick-access buttons
- Upcoming meetings section with time & join links
- Recent meetings section
- Pre-loaded seed data so the dashboard never feels empty

</details>

<details>
<summary><b>⚡ Instant Meeting Creation</b></summary>

<br/>

- One click → meeting created via FastAPI REST
- Auto-generates a unique **Zoom-style ID**: `821-419-305`
- Generates a shareable **invite link** instantly
- Redirects you straight to the live meeting room

</details>

<details>
<summary><b>🔗 Join Meeting</b></summary>

<br/>

- Join with **Meeting ID** or open an **invite link** (`/join?meetingId=...`)
- **Display name required** — no anonymous joining
- Backend validates meeting existence before allowing entry
- **Pre-join screen** with live mic/camera preview

</details>

<details>
<summary><b>📅 Schedule Meetings</b></summary>

<br/>

- Fields: Title, Description, Date & Time, Duration
- Auto-generated invite link on save
- Stored in SQLite, shown in **Upcoming Meetings**

</details>

<details>
<summary><b>🎥 Real-Time Meeting Room</b></summary>

<br/>

- **WebRTC P2P** audio/video with `RTCPeerConnection`
- **FastAPI WebSocket** signaling (SDP + ICE)
- Live participant join/leave events
- Real-time mute & camera status sync
- **Group chat** with history
- **Screen sharing** via `getDisplayMedia`
- Copy invite link from inside the room
- **Host Controls**: Mute all · Remove participant

</details>

---

## 🗄️ Database Design

### `meetings`

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

| Column | Purpose |
|---|---|
| `id` | Message primary key |
| `meeting_id` | Foreign key to meetings |
| `participant_public_id` | Sender public UUID |
| `sender_name` | Sender display name |
| `message` | Message body |
| `created_at` | Message timestamp |

---

## 🏛️ Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                      Next.js Client                          │
│  ┌─────────────┐  ┌────────────┐  ┌──────────────────────┐  │
│  │  Dashboard  │  │  Join UI   │  │    Meeting Room       │  │
│  │  /schedule  │  │  /join     │  │  /meeting/[id]        │  │
│  └─────────────┘  └────────────┘  └──────────────────────┘  │
│        │ REST             │ REST         │ WebSocket + WebRTC │
└────────┼─────────────────┼─────────────┼────────────────────┘
         │                 │             │
         ▼                 ▼             ▼
┌──────────────────────────────────────────────────────────────┐
│                     FastAPI Backend                          │
│  ┌─────────────────────┐   ┌──────────────────────────────┐  │
│  │   REST API Routes   │   │   WebSocket Room Manager     │  │
│  │  /meetings          │   │  SDP Offer / Answer relay    │  │
│  │  /participants      │   │  ICE candidate relay         │  │
│  │  /chat              │   │  Join / Leave / Chat events  │  │
│  └─────────────────────┘   └──────────────────────────────┘  │
│               │                        │                      │
│               ▼                        ▼                      │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │              SQLAlchemy ORM + SQLite                    │  │
│  │   meetings  ·  participants  ·  chat_messages           │  │
│  └─────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start

### 🔧 Local Setup

**1. Clone the repository**

```bash
git clone <your-repo-url>
cd zoom-clone-fullstack
```

**2. Start the backend**

```bash
cd backend
python -m venv .venv

# Windows
.venv\Scripts\activate
copy .env.example .env

# macOS / Linux
source .venv/bin/activate
cp .env.example .env

pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

> 🟢 Backend: `http://localhost:8000`
> 📖 Swagger Docs: `http://localhost:8000/docs`

**3. Start the frontend**

```bash
cd frontend
npm install

# Windows
copy .env.local.example .env.local

# macOS / Linux
cp .env.local.example .env.local

npm run dev
```

> 🟢 Frontend: `http://localhost:3000`

---

### 🐳 Docker (One Command)

```bash
docker compose up --build
```

Then open **http://localhost:3000** — everything is wired up.

---

## ☁️ Deployment

<details>
<summary><b>🟣 Backend → Render</b></summary>

<br/>

1. Push repo to GitHub
2. Create a new **Render Web Service**
3. Set root directory to `backend`
4. **Build command:**
   ```bash
   pip install -r requirements.txt
   ```
5. **Start command:**
   ```bash
   uvicorn app.main:app --host 0.0.0.0 --port $PORT
   ```
6. **Environment variables:**
   ```
   FRONTEND_ORIGIN=https://your-vercel-app.vercel.app
   CORS_ORIGINS=https://your-vercel-app.vercel.app
   DATABASE_URL=sqlite:///./zoom_clone.db
   ```

</details>

<details>
<summary><b>▲ Frontend → Vercel</b></summary>

<br/>

1. Import the GitHub repo on Vercel
2. Set root directory to `frontend`
3. **Environment variable:**
   ```
   NEXT_PUBLIC_API_URL=https://your-render-backend.onrender.com
   ```
4. Deploy 🚀

</details>

---

## 📡 WebRTC Notes

> ⚠️ **Camera and microphone** access require `localhost` or **HTTPS** in production.

| Consideration | Detail |
|---|---|
| 🔒 Security | Deploy frontend/backend with HTTPS + WSS |
| 🕸️ Topology | P2P mesh — great for demos, small rooms |
| 🏭 Production Scale | Use SFU media servers: LiveKit, mediasoup, Janus, or Twilio |
| 🛰️ NAT Traversal | A TURN server is recommended for reliable cross-network connections |

---

## 🎬 Demo Walkthrough

```
1. 🏠  Open Dashboard
        ↓
2. ➕  Click "New Meeting"
        ↓
3. 🔗  Copy the invite link
        ↓
4. 🕵️  Open link in incognito / second browser
        ↓
5. 📝  Join with a second display name
        ↓
6. 🧪  Test the full feature set:
        ├── 🎥  Audio/video tiles
        ├── 🔇  Mute/unmute
        ├── 📷  Stop/start camera
        ├── 💬  Group chat
        ├── 🖥️  Screen share
        ├── 👑  Host: mute all
        └── ❌  Host: remove participant
        ↓
7. 📅  Go back to dashboard → Schedule a meeting
```

---

## 📝 Assumptions

- **No login required** — a default user is assumed to be logged in
- **First participant** in a room automatically becomes the host
- **Display name match** → treated as host if it matches the host name
- **SQLite** used as required by the assignment spec
- **WebSocket room state** is in-memory (represents live connected users only)
- **Durable data** (meetings, participants, chat) is persisted in SQLite

---

## 🧠 Architecture Summary

> *REST APIs handle durable workflows (create, join, schedule). WebSockets handle ephemeral real-time events (signaling, chat, mute state, participant updates). WebRTC carries actual audio/video directly between browsers. FastAPI acts as the signaling relay. SQLite stores all durable state in normalized relationships.*

---

<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:00C2FF,100:2D8CFF&height=120&section=footer&animation=fadeIn" width="100%"/>


</div>