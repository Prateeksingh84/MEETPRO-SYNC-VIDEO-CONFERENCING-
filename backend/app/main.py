import base64
import json
import os
import random
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlencode
from uuid import uuid4

import requests
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, File, Form, HTTPException, Request, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.encoders import jsonable_encoder
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, RedirectResponse
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

load_dotenv()

from . import crud, models
from .database import SessionLocal, engine, get_db

try:
    from .seed import seed_database
except Exception:
    seed_database = None

try:
    from . import integrations
except Exception:
    integrations = None


FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:3000")
CORS_ORIGINS = os.getenv("CORS_ORIGINS", FRONTEND_ORIGIN)
RECORDINGS_DIR = Path("recordings")

models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="MeetSync Pro API",
    description="Real-time video conferencing backend API",
    version="1.0.0",
)

allowed_origins = [origin.strip() for origin in CORS_ORIGINS.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins or [FRONTEND_ORIGIN],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================
# PAYLOADS
# =========================

class SignupPayload(BaseModel):
    name: str
    email: str
    password: str


class LoginPayload(BaseModel):
    email: str
    password: str


class InstantMeetingPayload(BaseModel):
    host_name: str


class ScheduleMeetingPayload(BaseModel):
    title: str
    description: str | None = ""
    start_time: str
    duration_minutes: int = 60


class JoinMeetingPayload(BaseModel):
    display_name: str


class LeaveMeetingPayload(BaseModel):
    participant_public_id: str


class MediaStatePayload(BaseModel):
    participant_public_id: str
    is_muted: bool | None = None
    camera_on: bool | None = None


class ChatMessagePayload(BaseModel):
    participant_public_id: str
    sender_name: str
    message: str


class ProfileUpdatePayload(BaseModel):
    name: str
    bio: str | None = ""
    role: str | None = ""
    location: str | None = ""


class ProfilePhotoPayload(BaseModel):
    profile_photo: str


class VerifyEmailConfirmPayload(BaseModel):
    code: str


class DeleteAccountPayload(BaseModel):
    email: str


class GoogleCalendarEventPayload(BaseModel):
    title: str
    description: str | None = ""
    start_time: str | None = None
    duration_minutes: int | None = 60


class GoogleDriveNotesPayload(BaseModel):
    title: str
    content: str


class SlackSharePayload(BaseModel):
    channel: str
    message: str
    meeting_id: str | None = None


# =========================
# INTEGRATION CONFIG
# =========================

INTEGRATION_CATALOG = [
    {
        "id": "google-calendar",
        "state_key": "calendar",
        "provider": "google",
        "name": "Google Calendar",
        "description": "Sync scheduled meetings with Google Calendar events.",
        "icon": "📅",
        "category": "Calendar",
        "connect_label": "Connect Calendar",
        "required_env": ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REDIRECT_URI"],
    },
    {
        "id": "google-drive",
        "state_key": "drive",
        "provider": "google",
        "name": "Google Drive",
        "description": "Attach meeting notes, documents, and shared files.",
        "icon": "📁",
        "category": "Storage",
        "connect_label": "Connect Drive",
        "required_env": ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REDIRECT_URI"],
    },
    {
        "id": "slack",
        "state_key": "slack",
        "provider": "slack",
        "name": "Slack",
        "description": "Send meeting updates and reminders to Slack channels.",
        "icon": "💬",
        "category": "Communication",
        "connect_label": "Connect Slack",
        "required_env_any": ["SLACK_BOT_TOKEN", "SLACK_WEBHOOK_URL"],
    },
    {
        "id": "notion",
        "state_key": "notion",
        "provider": "notion",
        "name": "Notion",
        "description": "Create meeting notes and action items in Notion workspace.",
        "icon": "📝",
        "category": "Productivity",
        "connect_label": "Connect Notion",
        "required_env": ["NOTION_TOKEN"],
    },
    {
        "id": "github",
        "state_key": "github",
        "provider": "github",
        "name": "GitHub",
        "description": "Link technical meetings with issues, pull requests, and releases.",
        "icon": "🐙",
        "category": "Developer Tools",
        "connect_label": "Connect GitHub",
        "required_env": ["GITHUB_TOKEN"],
    },
    {
        "id": "zoom-import",
        "state_key": "zoom-import",
        "provider": "zoom",
        "name": "Zoom Import",
        "description": "Import real Zoom meetings using Zoom Server-to-Server OAuth.",
        "icon": "🎥",
        "category": "Migration",
        "connect_label": "Connect Zoom",
        "required_env": ["ZOOM_ACCOUNT_ID", "ZOOM_CLIENT_ID", "ZOOM_CLIENT_SECRET"],
    },
]


# =========================
# WEBSOCKET MANAGERS
# =========================

class DashboardConnectionManager:
    def __init__(self) -> None:
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket) -> None:
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast_json(self, payload: dict[str, Any]) -> None:
        disconnected: list[WebSocket] = []

        for connection in self.active_connections:
            try:
                await connection.send_json(jsonable_encoder(payload))
            except Exception:
                disconnected.append(connection)

        for connection in disconnected:
            self.disconnect(connection)

    @property
    def count(self) -> int:
        return len(self.active_connections)


class RoomConnectionManager:
    def __init__(self) -> None:
        self.rooms: dict[str, list[WebSocket]] = {}

    async def connect(self, room_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self.rooms.setdefault(room_id, []).append(websocket)

    def disconnect(self, room_id: str, websocket: WebSocket) -> None:
        if room_id not in self.rooms:
            return

        if websocket in self.rooms[room_id]:
            self.rooms[room_id].remove(websocket)

        if not self.rooms[room_id]:
            del self.rooms[room_id]

    async def broadcast_json(self, room_id: str, payload: dict[str, Any]) -> None:
        if room_id not in self.rooms:
            return

        disconnected: list[WebSocket] = []

        for connection in self.rooms[room_id]:
            try:
                await connection.send_json(jsonable_encoder(payload))
            except Exception:
                disconnected.append(connection)

        for connection in disconnected:
            self.disconnect(room_id, connection)

    @property
    def room_count(self) -> int:
        return len(self.rooms)

    @property
    def connection_count(self) -> int:
        return sum(len(connections) for connections in self.rooms.values())


dashboard_manager = DashboardConnectionManager()
meeting_manager = RoomConnectionManager()
workspace_manager = RoomConnectionManager()


# =========================
# COMMON HELPERS
# =========================

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def env_value(name: str) -> str:
    return os.getenv(name, "").strip()


def has_all_env(names: list[str]) -> bool:
    return all(bool(env_value(name)) for name in names)


def has_any_env(names: list[str]) -> bool:
    return any(bool(env_value(name)) for name in names)


def app_is_configured(item: dict[str, Any]) -> tuple[bool, str]:
    required_env = item.get("required_env", [])
    required_env_any = item.get("required_env_any", [])

    if required_env and not has_all_env(required_env):
        missing = [name for name in required_env if not env_value(name)]
        return False, f"Missing environment variables: {', '.join(missing)}"

    if required_env_any and not has_any_env(required_env_any):
        return False, f"Add at least one environment variable: {', '.join(required_env_any)}"

    return True, "Configured"


def get_catalog_item(app_id: str) -> dict[str, Any]:
    for item in INTEGRATION_CATALOG:
        if item["id"] == app_id:
            return item

    raise HTTPException(status_code=404, detail="Integration app not found")


def platform_summary_data(db: Session) -> dict[str, Any]:
    if hasattr(crud, "get_platform_summary"):
        summary = crud.get_platform_summary(db)
    else:
        summary = {
            "totalMeetings": db.query(models.Meeting).count(),
            "scheduledMeetings": db.query(models.Meeting)
            .filter(models.Meeting.meeting_type == "scheduled")
            .count(),
            "instantMeetings": db.query(models.Meeting)
            .filter(models.Meeting.meeting_type == "instant")
            .count(),
            "totalParticipants": db.query(models.Participant).count(),
            "totalMessages": db.query(models.ChatMessage).count(),
            "updatedAt": now_iso(),
        }

    summary["activeParticipants"] = meeting_manager.connection_count
    summary["liveDashboardClients"] = dashboard_manager.count
    summary["liveWorkspaceRooms"] = workspace_manager.room_count
    summary["updatedAt"] = now_iso()

    return summary


async def broadcast_dashboard_update(db: Session) -> None:
    payload = {
        "type": "dashboard-update",
        "dashboard": crud.get_dashboard(db),
        "summary": platform_summary_data(db),
    }

    await dashboard_manager.broadcast_json(jsonable_encoder(payload))


def auth_response(user: models.User) -> dict[str, Any]:
    return {
        "token": f"local-token-{user.public_id}",
        "user": crud.serialize_user(user),
    }


def parse_start_and_end(start_time: str | None, duration_minutes: int | None) -> tuple[str, str]:
    if start_time:
        cleaned = start_time.replace("Z", "+00:00")
        start_dt = datetime.fromisoformat(cleaned)
    else:
        start_dt = datetime.now(timezone.utc)

    if start_dt.tzinfo is None:
        start_dt = start_dt.replace(tzinfo=timezone.utc)

    duration = max(int(duration_minutes or 60), 1)
    end_dt = start_dt + timedelta(minutes=duration)

    return start_dt.isoformat(), end_dt.isoformat()


def build_google_oauth_url() -> str:
    google_client_id = env_value("GOOGLE_CLIENT_ID")
    google_redirect_uri = env_value("GOOGLE_REDIRECT_URI") or (
        "http://localhost:8000/api/integrations/google/callback"
    )

    if not google_client_id:
        raise HTTPException(
            status_code=400,
            detail="GOOGLE_CLIENT_ID is missing in backend .env file",
        )

    scopes = [
        "https://www.googleapis.com/auth/calendar.events",
        "https://www.googleapis.com/auth/drive.file",
    ]

    query = urlencode(
        {
            "client_id": google_client_id,
            "redirect_uri": google_redirect_uri,
            "response_type": "code",
            "scope": " ".join(scopes),
            "access_type": "offline",
            "prompt": "consent",
            "include_granted_scopes": "true",
        }
    )

    return f"https://accounts.google.com/o/oauth2/v2/auth?{query}"


# =========================
# PROFILE DATABASE HELPERS
# =========================

def ensure_profile_columns() -> None:
    with engine.begin() as connection:
        existing_columns = {
            row[1] for row in connection.execute(text("PRAGMA table_info(users)")).fetchall()
        }

        def add_column(column_name: str, ddl: str) -> None:
            if column_name not in existing_columns:
                connection.execute(text(f"ALTER TABLE users ADD COLUMN {ddl}"))

        add_column("profile_photo", "profile_photo TEXT DEFAULT ''")
        add_column("bio", "bio TEXT DEFAULT ''")
        add_column("role", "role TEXT DEFAULT ''")
        add_column("location", "location TEXT DEFAULT ''")
        add_column("email_verified", "email_verified INTEGER DEFAULT 0")
        add_column("verification_code", "verification_code TEXT DEFAULT ''")
        add_column("updated_at", "updated_at TEXT DEFAULT ''")


def get_user_profile_row(db: Session, public_id: str):
    ensure_profile_columns()

    row = (
        db.execute(
            text(
                """
                SELECT
                    public_id,
                    name,
                    email,
                    profile_photo,
                    bio,
                    role,
                    location,
                    email_verified,
                    verification_code,
                    created_at,
                    updated_at
                FROM users
                WHERE public_id = :public_id
                """
            ),
            {"public_id": public_id},
        )
        .mappings()
        .first()
    )

    return row


def serialize_profile(row: Any) -> dict[str, Any]:
    if not row:
        raise HTTPException(status_code=404, detail="User profile not found")

    data = dict(row)

    return {
        "public_id": data.get("public_id"),
        "name": data.get("name") or "",
        "email": data.get("email") or "",
        "profile_photo": data.get("profile_photo") or "",
        "bio": data.get("bio") or "",
        "role": data.get("role") or "",
        "location": data.get("location") or "",
        "email_verified": bool(data.get("email_verified")),
        "created_at": str(data.get("created_at") or ""),
        "updated_at": str(data.get("updated_at") or ""),
    }


# =========================
# INTEGRATION DATABASE HELPERS
# =========================

def ensure_integration_tables() -> None:
    with engine.begin() as connection:
        connection.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS integration_states (
                    name TEXT PRIMARY KEY
                )
                """
            )
        )

        existing_state_columns = {
            row[1] for row in connection.execute(text("PRAGMA table_info(integration_states)")).fetchall()
        }

        def add_state_column(column_name: str, ddl: str) -> None:
            if column_name not in existing_state_columns:
                connection.execute(text(f"ALTER TABLE integration_states ADD COLUMN {ddl}"))

        add_state_column("connected", "connected INTEGER DEFAULT 0")
        add_state_column("provider", "provider TEXT DEFAULT ''")
        add_state_column("connected_at", "connected_at TEXT DEFAULT ''")
        add_state_column("updated_at", "updated_at TEXT DEFAULT ''")

        if "value" in existing_state_columns:
            connection.execute(
                text(
                    """
                    UPDATE integration_states
                    SET connected = value
                    WHERE connected IS NULL OR connected = 0
                    """
                )
            )

        connection.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS integration_credentials (
                    name TEXT PRIMARY KEY,
                    access_token TEXT DEFAULT '',
                    refresh_token TEXT DEFAULT '',
                    token_type TEXT DEFAULT '',
                    scope TEXT DEFAULT '',
                    expires_at INTEGER DEFAULT 0,
                    updated_at TEXT DEFAULT ''
                )
                """
            )
        )

        connection.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS integration_events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    app TEXT NOT NULL,
                    actor TEXT DEFAULT 'System',
                    action TEXT NOT NULL,
                    status TEXT DEFAULT 'ok',
                    created_at TEXT DEFAULT ''
                )
                """
            )
        )


def record_integration_event(
    db: Session,
    app_name: str,
    action: str,
    actor: str = "System",
    status: str = "ok",
) -> None:
    ensure_integration_tables()

    db.execute(
        text(
            """
            INSERT INTO integration_events (
                app,
                actor,
                action,
                status,
                created_at
            )
            VALUES (
                :app,
                :actor,
                :action,
                :status,
                :created_at
            )
            """
        ),
        {
            "app": app_name,
            "actor": actor,
            "action": action,
            "status": status,
            "created_at": now_iso(),
        },
    )

    db.commit()


def set_integration_state(
    db: Session,
    name: str,
    connected: bool,
    provider: str = "",
    actor: str = "System",
    action: str | None = None,
    status: str = "ok",
) -> None:
    ensure_integration_tables()

    current_time = now_iso()

    db.execute(
        text(
            """
            INSERT INTO integration_states (
                name,
                connected,
                provider,
                connected_at,
                updated_at
            )
            VALUES (
                :name,
                :connected,
                :provider,
                :connected_at,
                :updated_at
            )
            ON CONFLICT(name)
            DO UPDATE SET
                connected = excluded.connected,
                provider = excluded.provider,
                connected_at = excluded.connected_at,
                updated_at = excluded.updated_at
            """
        ),
        {
            "name": name,
            "connected": 1 if connected else 0,
            "provider": provider,
            "connected_at": current_time if connected else "",
            "updated_at": current_time,
        },
    )

    db.commit()

    if action:
        record_integration_event(db, name, action, actor=actor, status=status)


def save_integration_credentials(
    db: Session,
    name: str,
    access_token: str,
    refresh_token: str = "",
    token_type: str = "",
    scope: str = "",
    expires_in: int = 3600,
) -> None:
    ensure_integration_tables()

    expires_at = int(time.time()) + int(expires_in or 3600)

    db.execute(
        text(
            """
            INSERT INTO integration_credentials (
                name,
                access_token,
                refresh_token,
                token_type,
                scope,
                expires_at,
                updated_at
            )
            VALUES (
                :name,
                :access_token,
                :refresh_token,
                :token_type,
                :scope,
                :expires_at,
                :updated_at
            )
            ON CONFLICT(name)
            DO UPDATE SET
                access_token = excluded.access_token,
                refresh_token = CASE
                    WHEN excluded.refresh_token != '' THEN excluded.refresh_token
                    ELSE integration_credentials.refresh_token
                END,
                token_type = excluded.token_type,
                scope = excluded.scope,
                expires_at = excluded.expires_at,
                updated_at = excluded.updated_at
            """
        ),
        {
            "name": name,
            "access_token": access_token,
            "refresh_token": refresh_token or "",
            "token_type": token_type or "",
            "scope": scope or "",
            "expires_at": expires_at,
            "updated_at": now_iso(),
        },
    )

    db.commit()


def delete_integration_credentials(db: Session, name: str) -> None:
    ensure_integration_tables()

    db.execute(text("DELETE FROM integration_credentials WHERE name = :name"), {"name": name})
    db.commit()


def get_integration_credential(db: Session, name: str):
    ensure_integration_tables()

    return (
        db.execute(
            text(
                """
                SELECT
                    name,
                    access_token,
                    refresh_token,
                    token_type,
                    scope,
                    expires_at,
                    updated_at
                FROM integration_credentials
                WHERE name = :name
                """
            ),
            {"name": name},
        )
        .mappings()
        .first()
    )


def get_integration_states(db: Session) -> dict[str, bool]:
    ensure_integration_tables()

    default_state = {
        "google": False,
        "calendar": False,
        "drive": False,
        "slack": False,
        "notion": False,
        "github": False,
        "zoom-import": False,
    }

    rows = db.execute(text("SELECT name, connected FROM integration_states")).fetchall()

    for row in rows:
        name = str(row[0])
        connected = bool(row[1])

        if name in default_state:
            default_state[name] = connected

    google_credential = get_integration_credential(db, "google")

    if not google_credential:
        default_state["google"] = False
        default_state["calendar"] = False
        default_state["drive"] = False

    for item in INTEGRATION_CATALOG:
        configured, _ = app_is_configured(item)

        if not configured:
            default_state[item["state_key"]] = False

            if item["provider"] == "google":
                default_state["google"] = False

    return default_state


def get_recent_integration_events(db: Session, limit: int = 10) -> list[dict[str, Any]]:
    ensure_integration_tables()

    rows = (
        db.execute(
            text(
                """
                SELECT
                    id,
                    app,
                    actor,
                    action,
                    status,
                    created_at
                FROM integration_events
                ORDER BY id DESC
                LIMIT :limit
                """
            ),
            {"limit": limit},
        )
        .mappings()
        .all()
    )

    return [
        {
            "id": str(row["id"]),
            "app": row["app"],
            "actor": row["actor"],
            "action": row["action"],
            "status": row["status"],
            "time": row["created_at"],
        }
        for row in rows
    ]


# =========================
# RECORDING DATABASE HELPERS
# =========================

def ensure_recording_tables() -> None:
    RECORDINGS_DIR.mkdir(parents=True, exist_ok=True)

    with engine.begin() as connection:
        connection.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS meeting_recordings (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    public_id TEXT UNIQUE NOT NULL,
                    meeting_id TEXT NOT NULL,
                    file_name TEXT NOT NULL,
                    original_name TEXT DEFAULT '',
                    content_type TEXT DEFAULT '',
                    size_bytes INTEGER DEFAULT 0,
                    duration_seconds INTEGER DEFAULT 0,
                    storage_path TEXT NOT NULL,
                    created_at TEXT DEFAULT ''
                )
                """
            )
        )


def serialize_recording(row: Any) -> dict[str, Any]:
    data = dict(row)

    return {
        "id": data.get("public_id"),
        "meeting_id": data.get("meeting_id"),
        "file_name": data.get("file_name"),
        "original_name": data.get("original_name") or "",
        "content_type": data.get("content_type") or "",
        "size_bytes": int(data.get("size_bytes") or 0),
        "duration_seconds": int(data.get("duration_seconds") or 0),
        "created_at": data.get("created_at") or "",
        "download_url": f"/api/recordings/{data.get('public_id')}/download",
    }


def get_recording_row(db: Session, recording_id: str):
    ensure_recording_tables()

    return (
        db.execute(
            text(
                """
                SELECT
                    public_id,
                    meeting_id,
                    file_name,
                    original_name,
                    content_type,
                    size_bytes,
                    duration_seconds,
                    storage_path,
                    created_at
                FROM meeting_recordings
                WHERE public_id = :public_id
                """
            ),
            {"public_id": recording_id},
        )
        .mappings()
        .first()
    )


# =========================
# REAL API VERIFICATION HELPERS
# =========================

def exchange_google_code_for_token(code: str) -> dict[str, Any]:
    response = requests.post(
        "https://oauth2.googleapis.com/token",
        data={
            "code": code,
            "client_id": env_value("GOOGLE_CLIENT_ID"),
            "client_secret": env_value("GOOGLE_CLIENT_SECRET"),
            "redirect_uri": env_value("GOOGLE_REDIRECT_URI")
            or "http://localhost:8000/api/integrations/google/callback",
            "grant_type": "authorization_code",
        },
        timeout=20,
    )

    data = response.json()

    if not response.ok:
        raise HTTPException(
            status_code=400,
            detail=data.get("error_description") or data.get("error") or "Google token exchange failed",
        )

    return data


def get_valid_google_access_token(db: Session) -> str:
    credential = get_integration_credential(db, "google")

    if not credential:
        raise HTTPException(status_code=400, detail="Google is not connected")

    access_token = str(credential["access_token"] or "")
    refresh_token = str(credential["refresh_token"] or "")
    expires_at = int(credential["expires_at"] or 0)

    if access_token and expires_at > int(time.time()) + 60:
        return access_token

    if not refresh_token:
        raise HTTPException(status_code=400, detail="Google refresh token missing. Reconnect Google.")

    response = requests.post(
        "https://oauth2.googleapis.com/token",
        data={
            "client_id": env_value("GOOGLE_CLIENT_ID"),
            "client_secret": env_value("GOOGLE_CLIENT_SECRET"),
            "refresh_token": refresh_token,
            "grant_type": "refresh_token",
        },
        timeout=20,
    )

    data = response.json()

    if not response.ok:
        raise HTTPException(
            status_code=400,
            detail=data.get("error_description") or data.get("error") or "Google token refresh failed",
        )

    save_integration_credentials(
        db,
        "google",
        access_token=data.get("access_token", ""),
        refresh_token=refresh_token,
        token_type=data.get("token_type", "Bearer"),
        scope=str(credential["scope"] or ""),
        expires_in=int(data.get("expires_in", 3600)),
    )

    return data.get("access_token", "")


def verify_slack_connection() -> str:
    bot_token = env_value("SLACK_BOT_TOKEN")
    webhook_url = env_value("SLACK_WEBHOOK_URL")

    if bot_token:
        response = requests.post(
            "https://slack.com/api/auth.test",
            headers={"Authorization": f"Bearer {bot_token}"},
            timeout=20,
        )

        data = response.json()

        if not data.get("ok"):
            raise HTTPException(
                status_code=400,
                detail=data.get("error", "Slack token verification failed"),
            )

        return "bot_token"

    if webhook_url:
        response = requests.post(
            webhook_url,
            json={"text": "MeetSync Pro Slack connection test successful."},
            timeout=20,
        )

        if response.status_code >= 400:
            raise HTTPException(status_code=400, detail="Slack webhook verification failed")

        return "webhook"

    raise HTTPException(status_code=400, detail="SLACK_BOT_TOKEN or SLACK_WEBHOOK_URL is missing")


def verify_notion_connection() -> None:
    token = env_value("NOTION_TOKEN")

    if not token:
        raise HTTPException(status_code=400, detail="NOTION_TOKEN is missing in backend .env")

    response = requests.get(
        "https://api.notion.com/v1/users/me",
        headers={
            "Authorization": f"Bearer {token}",
            "Notion-Version": "2022-06-28",
        },
        timeout=20,
    )

    if not response.ok:
        raise HTTPException(status_code=400, detail="Notion token verification failed")


def verify_github_connection() -> None:
    token = env_value("GITHUB_TOKEN")

    if not token:
        raise HTTPException(status_code=400, detail="GITHUB_TOKEN is missing in backend .env")

    response = requests.get(
        "https://api.github.com/user",
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
        },
        timeout=20,
    )

    if not response.ok:
        raise HTTPException(status_code=400, detail="GitHub token verification failed")


def verify_zoom_connection(db: Session) -> None:
    account_id = env_value("ZOOM_ACCOUNT_ID")
    client_id = env_value("ZOOM_CLIENT_ID")
    client_secret = env_value("ZOOM_CLIENT_SECRET")

    if not account_id or not client_id or not client_secret:
        raise HTTPException(
            status_code=400,
            detail="ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, and ZOOM_CLIENT_SECRET are required",
        )

    basic_token = base64.b64encode(f"{client_id}:{client_secret}".encode()).decode()

    response = requests.post(
        "https://zoom.us/oauth/token",
        params={
            "grant_type": "account_credentials",
            "account_id": account_id,
        },
        headers={
            "Authorization": f"Basic {basic_token}",
        },
        timeout=20,
    )

    data = response.json()

    if not response.ok:
        raise HTTPException(status_code=400, detail=data.get("reason") or "Zoom verification failed")

    save_integration_credentials(
        db,
        "zoom-import",
        access_token=data.get("access_token", ""),
        token_type=data.get("token_type", "bearer"),
        scope=data.get("scope", ""),
        expires_in=int(data.get("expires_in", 3600)),
    )


# =========================
# STARTUP
# =========================

@app.on_event("startup")
def startup_event() -> None:
    ensure_profile_columns()
    ensure_integration_tables()
    ensure_recording_tables()

    seed_demo_data = env_value("SEED_DEMO_DATA").lower() == "true"

    if not seed_demo_data or seed_database is None:
        return

    db = SessionLocal()

    try:
        try:
            seed_database(db, FRONTEND_ORIGIN)
        except TypeError:
            seed_database(db)
    finally:
        db.close()


# =========================
# HEALTH
# =========================

@app.get("/")
def root() -> dict[str, str]:
    return {
        "message": "MeetSync Pro backend is running",
        "status": "ok",
    }


@app.get("/api/health")
def health() -> dict[str, str]:
    return {
        "status": "healthy",
        "service": "MeetSync Pro API",
    }


# =========================
# AUTH
# =========================

@app.post("/api/auth/signup")
def signup(payload: SignupPayload, db: Session = Depends(get_db)):
    email = payload.email.strip()

    if "@" not in email or "." not in email:
        raise HTTPException(status_code=400, detail="Please enter a valid email address")

    try:
        user = crud.create_user(db, payload)
        return auth_response(user)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Signup failed: {exc}") from exc


@app.post("/api/auth/login")
def login(payload: LoginPayload, db: Session = Depends(get_db)):
    email = payload.email.strip()

    if "@" not in email or "." not in email:
        raise HTTPException(status_code=400, detail="Please enter a valid email address")

    user = crud.authenticate_user(db, email, payload.password)

    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    return auth_response(user)


# =========================
# DASHBOARD
# =========================

@app.get("/api/dashboard")
def get_dashboard(db: Session = Depends(get_db)):
    return crud.get_dashboard(db)


@app.get("/api/platform-summary")
def get_platform_summary(db: Session = Depends(get_db)):
    return platform_summary_data(db)


@app.websocket("/ws/dashboard")
async def dashboard_socket(websocket: WebSocket):
    await dashboard_manager.connect(websocket)

    db = SessionLocal()

    try:
        await dashboard_manager.broadcast_json(
            jsonable_encoder(
                {
                    "type": "dashboard-update",
                    "dashboard": crud.get_dashboard(db),
                    "summary": platform_summary_data(db),
                }
            )
        )

        while True:
            await websocket.receive_text()

    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        dashboard_manager.disconnect(websocket)

        try:
            await dashboard_manager.broadcast_json(
                jsonable_encoder(
                    {
                        "type": "dashboard-update",
                        "dashboard": crud.get_dashboard(db),
                        "summary": platform_summary_data(db),
                    }
                )
            )
        except Exception:
            pass

        db.close()


# =========================
# MEETINGS
# =========================

@app.post("/api/meetings/instant")
async def create_instant_meeting(payload: InstantMeetingPayload, db: Session = Depends(get_db)):
    meeting = crud.create_instant_meeting(db, payload)

    await broadcast_dashboard_update(db)

    return crud.serialize_meeting(meeting)


@app.post("/api/meetings/schedule")
async def schedule_meeting(payload: ScheduleMeetingPayload, db: Session = Depends(get_db)):
    try:
        meeting = crud.schedule_meeting(db, payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    await broadcast_dashboard_update(db)

    return crud.serialize_meeting(meeting)


@app.get("/api/meetings/{meeting_id}")
def get_meeting(meeting_id: str, db: Session = Depends(get_db)):
    meeting = crud.get_meeting_by_public_id(db, meeting_id)

    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    return crud.serialize_meeting(meeting)


@app.post("/api/meetings/{meeting_id}/join")
async def join_meeting(meeting_id: str, payload: JoinMeetingPayload, db: Session = Depends(get_db)):
    meeting = crud.get_meeting_by_public_id(db, meeting_id)

    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    participant = crud.join_meeting(db, meeting, payload.display_name)

    participant_payload = {
        "public_id": participant.public_id,
        "display_name": participant.display_name,
        "is_host": participant.is_host,
        "is_muted": participant.is_muted,
        "camera_on": participant.camera_on,
        "joined_at": participant.joined_at.isoformat() if participant.joined_at else None,
    }

    await meeting_manager.broadcast_json(
        meeting_id,
        {
            "type": "participant-joined",
            "participant": participant_payload,
        },
    )

    await broadcast_dashboard_update(db)

    return {
        "meeting": crud.serialize_meeting(meeting),
        "participant": participant_payload,
    }


@app.post("/api/meetings/{meeting_id}/leave")
async def leave_meeting(
    meeting_id: str,
    payload: LeaveMeetingPayload,
    db: Session = Depends(get_db),
):
    meeting = crud.get_meeting_by_public_id(db, meeting_id)

    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    crud.mark_left(db, payload.participant_public_id)

    await meeting_manager.broadcast_json(
        meeting_id,
        {
            "type": "participant-left",
            "participant_public_id": payload.participant_public_id,
        },
    )

    await broadcast_dashboard_update(db)

    return {
        "message": "Participant left meeting successfully",
    }


@app.post("/api/meetings/{meeting_id}/media")
async def update_media_state(
    meeting_id: str,
    payload: MediaStatePayload,
    db: Session = Depends(get_db),
):
    meeting = crud.get_meeting_by_public_id(db, meeting_id)

    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    crud.update_participant_media_state(
        db,
        payload.participant_public_id,
        payload.is_muted,
        payload.camera_on,
    )

    await meeting_manager.broadcast_json(
        meeting_id,
        {
            "type": "media-state-updated",
            "participant_public_id": payload.participant_public_id,
            "is_muted": payload.is_muted,
            "camera_on": payload.camera_on,
        },
    )

    return {
        "message": "Media state updated",
    }


@app.post("/api/meetings/{meeting_id}/chat")
async def persist_meeting_chat(
    meeting_id: str,
    payload: ChatMessagePayload,
    db: Session = Depends(get_db),
):
    meeting = crud.get_meeting_by_public_id(db, meeting_id)

    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    chat = crud.persist_chat_message(
        db,
        meeting,
        payload.participant_public_id,
        payload.sender_name,
        payload.message,
    )

    chat_payload = {
        "id": chat.id,
        "sender_name": chat.sender_name,
        "message": chat.message,
        "created_at": chat.created_at.isoformat() if chat.created_at else None,
    }

    await meeting_manager.broadcast_json(
        meeting_id,
        {
            "type": "chat-message",
            "message": chat_payload,
        },
    )

    await broadcast_dashboard_update(db)

    return chat_payload


# =========================
# MEETING RECORDINGS
# =========================

@app.post("/api/meetings/{meeting_id}/recordings")
async def upload_meeting_recording(
    meeting_id: str,
    duration_seconds: int = Form(0),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    ensure_recording_tables()

    meeting = crud.get_meeting_by_public_id(db, meeting_id)

    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    content_type = file.content_type or "application/octet-stream"

    is_valid_video = (
        content_type.startswith("video/webm")
        or content_type.startswith("video/mp4")
        or content_type == "application/octet-stream"
    )

    if not is_valid_video:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported recording format: {content_type}",
        )

    recording_public_id = str(uuid4())
    meeting_folder = RECORDINGS_DIR / meeting_id
    meeting_folder.mkdir(parents=True, exist_ok=True)

    extension = ".webm"

    if file.filename and file.filename.lower().endswith(".mp4"):
        extension = ".mp4"

    saved_file_name = f"{recording_public_id}{extension}"
    storage_path = meeting_folder / saved_file_name

    size_bytes = 0

    with storage_path.open("wb") as output:
        while True:
            chunk = await file.read(1024 * 1024)

            if not chunk:
                break

            size_bytes += len(chunk)
            output.write(chunk)

    db.execute(
        text(
            """
            INSERT INTO meeting_recordings (
                public_id,
                meeting_id,
                file_name,
                original_name,
                content_type,
                size_bytes,
                duration_seconds,
                storage_path,
                created_at
            )
            VALUES (
                :public_id,
                :meeting_id,
                :file_name,
                :original_name,
                :content_type,
                :size_bytes,
                :duration_seconds,
                :storage_path,
                :created_at
            )
            """
        ),
        {
            "public_id": recording_public_id,
            "meeting_id": meeting_id,
            "file_name": saved_file_name,
            "original_name": file.filename or saved_file_name,
            "content_type": content_type,
            "size_bytes": size_bytes,
            "duration_seconds": max(int(duration_seconds or 0), 0),
            "storage_path": str(storage_path),
            "created_at": now_iso(),
        },
    )

    db.commit()

    row = get_recording_row(db, recording_public_id)

    await meeting_manager.broadcast_json(
        meeting_id,
        {
            "type": "recording-saved",
            "recording": serialize_recording(row),
        },
    )

    await broadcast_dashboard_update(db)

    return serialize_recording(row)


@app.get("/api/meetings/{meeting_id}/recordings")
def list_meeting_recordings(meeting_id: str, db: Session = Depends(get_db)):
    ensure_recording_tables()

    meeting = crud.get_meeting_by_public_id(db, meeting_id)

    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    rows = (
        db.execute(
            text(
                """
                SELECT
                    public_id,
                    meeting_id,
                    file_name,
                    original_name,
                    content_type,
                    size_bytes,
                    duration_seconds,
                    storage_path,
                    created_at
                FROM meeting_recordings
                WHERE meeting_id = :meeting_id
                ORDER BY id DESC
                """
            ),
            {"meeting_id": meeting_id},
        )
        .mappings()
        .all()
    )

    return {
        "recordings": [serialize_recording(row) for row in rows],
    }


@app.get("/api/recordings/{recording_id}/download")
def download_recording(recording_id: str, db: Session = Depends(get_db)):
    row = get_recording_row(db, recording_id)

    if not row:
        raise HTTPException(status_code=404, detail="Recording not found")

    storage_path = Path(row["storage_path"])

    if not storage_path.exists():
        raise HTTPException(status_code=404, detail="Recording file missing from storage")

    return FileResponse(
        path=str(storage_path),
        media_type=row["content_type"] or "video/webm",
        filename=row["original_name"] or row["file_name"],
    )


@app.delete("/api/recordings/{recording_id}")
def delete_recording(recording_id: str, db: Session = Depends(get_db)):
    row = get_recording_row(db, recording_id)

    if not row:
        raise HTTPException(status_code=404, detail="Recording not found")

    storage_path = Path(row["storage_path"])

    if storage_path.exists():
        storage_path.unlink()

    db.execute(
        text("DELETE FROM meeting_recordings WHERE public_id = :public_id"),
        {"public_id": recording_id},
    )

    db.commit()

    return {
        "message": "Recording deleted successfully",
    }


@app.websocket("/ws/meetings/{meeting_id}")
async def meeting_socket(websocket: WebSocket, meeting_id: str):
    await meeting_manager.connect(meeting_id, websocket)

    db = SessionLocal()

    try:
        await broadcast_dashboard_update(db)

        while True:
            data = await websocket.receive_json()
            await meeting_manager.broadcast_json(meeting_id, data)

    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        meeting_manager.disconnect(meeting_id, websocket)

        try:
            await broadcast_dashboard_update(db)
        except Exception:
            pass

        db.close()


# =========================
# WORKSPACE / TEAM CHAT
# =========================

@app.websocket("/ws/workspace/{room_id}")
async def workspace_socket(websocket: WebSocket, room_id: str):
    await workspace_manager.connect(room_id, websocket)

    db = SessionLocal()

    try:
        await broadcast_dashboard_update(db)

        await workspace_manager.broadcast_json(
            room_id,
            {
                "type": "system",
                "message": "A user joined the workspace",
                "created_at": now_iso(),
            },
        )

        while True:
            data = await websocket.receive_json()
            data["created_at"] = data.get("created_at") or now_iso()
            await workspace_manager.broadcast_json(room_id, data)

    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        workspace_manager.disconnect(room_id, websocket)

        try:
            await broadcast_dashboard_update(db)
        except Exception:
            pass

        db.close()


# =========================
# PROFILE
# =========================

@app.get("/api/profile/{public_id}")
def get_profile(public_id: str, db: Session = Depends(get_db)):
    row = get_user_profile_row(db, public_id)
    return serialize_profile(row)


@app.put("/api/profile/{public_id}")
def update_profile(
    public_id: str,
    payload: ProfileUpdatePayload,
    db: Session = Depends(get_db),
):
    ensure_profile_columns()

    name = payload.name.strip()
    bio = (payload.bio or "").strip()
    role = (payload.role or "").strip()
    location = (payload.location or "").strip()

    if not name:
        raise HTTPException(status_code=400, detail="Name is required")

    existing = get_user_profile_row(db, public_id)

    if not existing:
        raise HTTPException(status_code=404, detail="User profile not found")

    db.execute(
        text(
            """
            UPDATE users
            SET
                name = :name,
                bio = :bio,
                role = :role,
                location = :location,
                updated_at = :updated_at
            WHERE public_id = :public_id
            """
        ),
        {
            "public_id": public_id,
            "name": name,
            "bio": bio,
            "role": role,
            "location": location,
            "updated_at": now_iso(),
        },
    )

    db.commit()

    updated = get_user_profile_row(db, public_id)
    return serialize_profile(updated)


@app.post("/api/profile/{public_id}/photo")
def update_profile_photo(
    public_id: str,
    payload: ProfilePhotoPayload,
    db: Session = Depends(get_db),
):
    ensure_profile_columns()

    existing = get_user_profile_row(db, public_id)

    if not existing:
        raise HTTPException(status_code=404, detail="User profile not found")

    db.execute(
        text(
            """
            UPDATE users
            SET profile_photo = :profile_photo,
                updated_at = :updated_at
            WHERE public_id = :public_id
            """
        ),
        {
            "public_id": public_id,
            "profile_photo": payload.profile_photo,
            "updated_at": now_iso(),
        },
    )

    db.commit()

    updated = get_user_profile_row(db, public_id)
    return serialize_profile(updated)


@app.post("/api/profile/{public_id}/verify-email/request")
def request_email_verification(public_id: str, db: Session = Depends(get_db)):
    ensure_profile_columns()

    existing = get_user_profile_row(db, public_id)

    if not existing:
        raise HTTPException(status_code=404, detail="User profile not found")

    code = str(random.randint(100000, 999999))

    db.execute(
        text(
            """
            UPDATE users
            SET verification_code = :code,
                updated_at = :updated_at
            WHERE public_id = :public_id
            """
        ),
        {
            "public_id": public_id,
            "code": code,
            "updated_at": now_iso(),
        },
    )

    db.commit()

    return {
        "message": "Verification code generated successfully.",
        "code": code,
        "note": "For local MVP, show this code in UI. In production, send it by email.",
    }


@app.post("/api/profile/{public_id}/verify-email/confirm")
def confirm_email_verification(
    public_id: str,
    payload: VerifyEmailConfirmPayload,
    db: Session = Depends(get_db),
):
    ensure_profile_columns()

    row = get_user_profile_row(db, public_id)

    if not row:
        raise HTTPException(status_code=404, detail="User profile not found")

    data = dict(row)
    saved_code = str(data.get("verification_code") or "").strip()
    entered_code = payload.code.strip()

    if not saved_code:
        raise HTTPException(status_code=400, detail="Please request verification code first")

    if entered_code != saved_code:
        raise HTTPException(status_code=400, detail="Invalid verification code")

    db.execute(
        text(
            """
            UPDATE users
            SET email_verified = 1,
                verification_code = '',
                updated_at = :updated_at
            WHERE public_id = :public_id
            """
        ),
        {
            "public_id": public_id,
            "updated_at": now_iso(),
        },
    )

    db.commit()

    updated = get_user_profile_row(db, public_id)
    return serialize_profile(updated)


@app.delete("/api/profile/{public_id}")
def delete_account(
    public_id: str,
    payload: DeleteAccountPayload,
    db: Session = Depends(get_db),
):
    ensure_profile_columns()

    row = get_user_profile_row(db, public_id)

    if not row:
        raise HTTPException(status_code=404, detail="User profile not found")

    data = dict(row)

    if payload.email.strip().lower() != str(data.get("email") or "").strip().lower():
        raise HTTPException(status_code=400, detail="Email confirmation does not match account email")

    db.execute(text("DELETE FROM users WHERE public_id = :public_id"), {"public_id": public_id})
    db.commit()

    return {
        "message": "Account deleted successfully",
    }


# =========================
# APPS / INTEGRATIONS
# =========================

@app.get("/api/apps")
def get_apps(db: Session = Depends(get_db)):
    states = get_integration_states(db)

    apps: list[dict[str, Any]] = []

    for item in INTEGRATION_CATALOG:
        configured, config_message = app_is_configured(item)
        connected = configured and states.get(item["state_key"], False)

        if not configured:
            status = "not_configured"
            action_label = "Add credentials in .env"
        elif connected:
            status = "connected"
            action_label = "Disconnect"
        else:
            status = "not_connected"
            action_label = item["connect_label"]

        apps.append(
            {
                "id": item["id"],
                "name": item["name"],
                "description": item["description"],
                "icon": item["icon"],
                "category": item["category"],
                "status": status,
                "actionLabel": action_label,
                "configured": configured,
                "configurationMessage": config_message,
            }
        )

    return {"apps": apps}


@app.get("/api/integrations/status")
def get_integration_status(db: Session = Depends(get_db)):
    states = get_integration_states(db)

    return {
        "google": states["google"],
        "calendar": states["calendar"],
        "drive": states["drive"],
        "slack": states["slack"],
        "notion": states["notion"],
        "github": states["github"],
        "zoomImport": states["zoom-import"],
    }


@app.get("/api/integrations/activity")
def get_integration_activity(db: Session = Depends(get_db)):
    return {
        "events": get_recent_integration_events(db),
    }


@app.post("/api/integrations/{app_id}/connect")
def connect_app(app_id: str, db: Session = Depends(get_db)):
    item = get_catalog_item(app_id)
    configured, config_message = app_is_configured(item)

    if not configured:
        raise HTTPException(status_code=400, detail=config_message)

    if app_id in ["google-calendar", "google-drive"]:
        return {
            "message": "Google OAuth is required for this integration.",
            "status": "oauth_required",
            "auth_url": build_google_oauth_url(),
        }

    if app_id == "slack":
        provider = verify_slack_connection()

        set_integration_state(
            db,
            "slack",
            True,
            provider=provider,
            actor="User",
            action="Slack verified with real credentials",
            status="connected",
        )

        return {"message": "Slack connected successfully.", "status": "connected"}

    if app_id == "notion":
        verify_notion_connection()

        set_integration_state(
            db,
            "notion",
            True,
            provider="notion",
            actor="User",
            action="Notion verified with real token",
            status="connected",
        )

        return {"message": "Notion connected successfully.", "status": "connected"}

    if app_id == "github":
        verify_github_connection()

        set_integration_state(
            db,
            "github",
            True,
            provider="github",
            actor="User",
            action="GitHub verified with real token",
            status="connected",
        )

        return {"message": "GitHub connected successfully.", "status": "connected"}

    if app_id == "zoom-import":
        verify_zoom_connection(db)

        set_integration_state(
            db,
            "zoom-import",
            True,
            provider="zoom",
            actor="User",
            action="Zoom verified with Server-to-Server OAuth",
            status="connected",
        )

        return {"message": "Zoom Import connected successfully.", "status": "connected"}

    raise HTTPException(status_code=404, detail="Integration app not found")


@app.post("/api/integrations/{app_id}/disconnect")
def disconnect_app(app_id: str, db: Session = Depends(get_db)):
    item = get_catalog_item(app_id)

    set_integration_state(
        db,
        item["state_key"],
        False,
        provider=item["provider"],
        actor="User",
        action=f"{item['name']} disconnected",
        status="not_connected",
    )

    if item["provider"] == "google":
        states = get_integration_states(db)

        if not states["calendar"] and not states["drive"]:
            set_integration_state(
                db,
                "google",
                False,
                provider="google",
                actor="System",
                action="Google disconnected because Calendar and Drive are disconnected",
                status="not_connected",
            )
            delete_integration_credentials(db, "google")

    if app_id == "zoom-import":
        delete_integration_credentials(db, "zoom-import")

    return {"message": f"{item['name']} disconnected successfully.", "status": "not_connected"}


@app.get("/api/integrations/google/connect")
def google_connect():
    auth_url = build_google_oauth_url()

    return {
        "url": auth_url,
        "auth_url": auth_url,
        "message": "Google authorization URL generated successfully",
    }


@app.get("/api/integrations/google/callback")
def google_callback(request: Request, db: Session = Depends(get_db)):
    google_error = request.query_params.get("error")
    code = request.query_params.get("code")

    if google_error:
        record_integration_event(
            db,
            "google",
            f"Google OAuth failed: {google_error}",
            actor="Google",
            status="error",
        )

        return RedirectResponse(url=f"{FRONTEND_ORIGIN}/apps?google=failed")

    if not code:
        record_integration_event(
            db,
            "google",
            "Google OAuth callback received without authorization code",
            actor="Google",
            status="error",
        )

        return RedirectResponse(url=f"{FRONTEND_ORIGIN}/apps?google=missing-code")

    try:
        token_data = exchange_google_code_for_token(code)
    except HTTPException as exc:
        record_integration_event(
            db,
            "google",
            f"Google OAuth token exchange failed: {exc.detail}",
            actor="Google",
            status="error",
        )

        return RedirectResponse(url=f"{FRONTEND_ORIGIN}/apps?google=failed")

    scope = token_data.get("scope", "")

    save_integration_credentials(
        db,
        "google",
        access_token=token_data.get("access_token", ""),
        refresh_token=token_data.get("refresh_token", ""),
        token_type=token_data.get("token_type", "Bearer"),
        scope=scope,
        expires_in=int(token_data.get("expires_in", 3600)),
    )

    calendar_connected = "calendar" in scope
    drive_connected = "drive" in scope

    set_integration_state(
        db,
        "google",
        True,
        provider="google",
        actor="Google",
        action="Google OAuth token exchange successful",
        status="connected",
    )

    set_integration_state(
        db,
        "calendar",
        calendar_connected,
        provider="google",
        actor="Google",
        action="Google Calendar connected through OAuth"
        if calendar_connected
        else "Google Calendar scope not granted",
        status="connected" if calendar_connected else "not_connected",
    )

    set_integration_state(
        db,
        "drive",
        drive_connected,
        provider="google",
        actor="Google",
        action="Google Drive connected through OAuth"
        if drive_connected
        else "Google Drive scope not granted",
        status="connected" if drive_connected else "not_connected",
    )

    return RedirectResponse(url=f"{FRONTEND_ORIGIN}/apps?google=connected")


@app.post("/api/integrations/google/calendar-event")
def create_google_calendar_event(
    payload: GoogleCalendarEventPayload,
    db: Session = Depends(get_db),
):
    states = get_integration_states(db)

    if not states["calendar"]:
        raise HTTPException(
            status_code=400,
            detail="Google Calendar is not connected. Connect Google Calendar first.",
        )

    access_token = get_valid_google_access_token(db)
    start_time, end_time = parse_start_and_end(payload.start_time, payload.duration_minutes)

    event_payload = {
        "summary": payload.title,
        "description": payload.description,
        "start": {
            "dateTime": start_time,
            "timeZone": "Asia/Kolkata",
        },
        "end": {
            "dateTime": end_time,
            "timeZone": "Asia/Kolkata",
        },
    }

    response = requests.post(
        "https://www.googleapis.com/calendar/v3/calendars/primary/events",
        headers={
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        },
        json=event_payload,
        timeout=20,
    )

    data = response.json()

    if not response.ok:
        raise HTTPException(
            status_code=400,
            detail=data.get("error", {}).get("message", "Google Calendar event creation failed"),
        )

    record_integration_event(
        db,
        "calendar",
        f"Calendar event created: {payload.title}",
        actor="User",
        status="created",
    )

    return {
        "message": "Google Calendar event created successfully.",
        "status": "created",
        "event": data,
    }


@app.post("/api/integrations/google/drive-notes")
def create_google_drive_notes(
    payload: GoogleDriveNotesPayload,
    db: Session = Depends(get_db),
):
    states = get_integration_states(db)

    if not states["drive"]:
        raise HTTPException(
            status_code=400,
            detail="Google Drive is not connected. Connect Google Drive first.",
        )

    access_token = get_valid_google_access_token(db)

    metadata = {
        "name": f"{payload.title}.txt",
        "mimeType": "text/plain",
    }

    files = {
        "metadata": (
            "metadata",
            json.dumps(metadata),
            "application/json",
        ),
        "file": (
            f"{payload.title}.txt",
            payload.content,
            "text/plain",
        ),
    }

    response = requests.post(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
        headers={"Authorization": f"Bearer {access_token}"},
        files=files,
        timeout=20,
    )

    data = response.json()

    if not response.ok:
        raise HTTPException(
            status_code=400,
            detail=data.get("error", {}).get("message", "Google Drive notes creation failed"),
        )

    record_integration_event(
        db,
        "drive",
        f"Drive notes created: {payload.title}",
        actor="User",
        status="created",
    )

    return {
        "message": "Google Drive notes created successfully.",
        "status": "created",
        "file": data,
    }


@app.post("/api/integrations/slack/test")
def slack_test(db: Session = Depends(get_db)):
    provider = verify_slack_connection()

    set_integration_state(
        db,
        "slack",
        True,
        provider=provider,
        actor="User",
        action="Slack verified with real credentials",
        status="connected",
    )

    return {
        "message": "Slack connected successfully.",
        "status": "connected",
    }


@app.post("/api/integrations/slack/share")
def share_meeting_to_slack(
    payload: SlackSharePayload,
    db: Session = Depends(get_db),
):
    states = get_integration_states(db)

    if not states["slack"]:
        raise HTTPException(
            status_code=400,
            detail="Slack is not connected. Connect Slack first.",
        )

    bot_token = env_value("SLACK_BOT_TOKEN")
    webhook_url = env_value("SLACK_WEBHOOK_URL")

    if bot_token:
        response = requests.post(
            "https://slack.com/api/chat.postMessage",
            headers={
                "Authorization": f"Bearer {bot_token}",
                "Content-Type": "application/json",
            },
            json={
                "channel": payload.channel,
                "text": payload.message,
            },
            timeout=20,
        )

        data = response.json()

        if not data.get("ok"):
            raise HTTPException(status_code=400, detail=data.get("error", "Slack message failed"))

    elif webhook_url:
        response = requests.post(
            webhook_url,
            json={"text": payload.message},
            timeout=20,
        )

        if response.status_code >= 400:
            raise HTTPException(status_code=400, detail="Slack webhook message failed")

    else:
        raise HTTPException(status_code=400, detail="Slack credentials missing")

    record_integration_event(
        db,
        "slack",
        f"Message shared to {payload.channel}",
        actor="User",
        status="sent",
    )

    return {
        "message": "Meeting shared to Slack successfully.",
        "status": "sent",
        "channel": payload.channel,
        "meeting_id": payload.meeting_id,
    }