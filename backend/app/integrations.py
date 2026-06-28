import io
import json
import os
from datetime import timedelta
from typing import Any

from dotenv import load_dotenv

load_dotenv()

import requests
from google.auth.transport.requests import Request as GoogleAuthRequest
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload
from sqlalchemy.orm import Session

from .models import IntegrationConnection, Meeting

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
GOOGLE_REDIRECT_URI = os.getenv(
    "GOOGLE_REDIRECT_URI",
    "http://localhost:8000/api/integrations/google/callback",
)

FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:3000")
SLACK_WEBHOOK_URL = os.getenv("SLACK_WEBHOOK_URL", "")

GOOGLE_SCOPES = [
    "https://www.googleapis.com/auth/calendar.events",
    "https://www.googleapis.com/auth/drive.file",
]


def google_client_config() -> dict[str, Any]:
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        raise RuntimeError("Google client ID/secret missing in backend .env")

    return {
        "web": {
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [GOOGLE_REDIRECT_URI],
        }
    }


def create_google_flow() -> Flow:
    try:
        return Flow.from_client_config(
            google_client_config(),
            scopes=GOOGLE_SCOPES,
            redirect_uri=GOOGLE_REDIRECT_URI,
            autogenerate_code_verifier=False,
        )
    except TypeError:
        flow = Flow.from_client_config(
            google_client_config(),
            scopes=GOOGLE_SCOPES,
            redirect_uri=GOOGLE_REDIRECT_URI,
        )
        flow.autogenerate_code_verifier = False
        return flow


def get_google_auth_url() -> str:
    flow = create_google_flow()

    auth_url, _state = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",
    )

    return auth_url


def store_google_credentials(db: Session, credentials: Credentials) -> IntegrationConnection:
    connection = (
        db.query(IntegrationConnection)
        .filter(IntegrationConnection.provider == "google")
        .first()
    )

    if not connection:
        connection = IntegrationConnection(provider="google")
        db.add(connection)

    connection.access_token = credentials.token
    connection.refresh_token = credentials.refresh_token or connection.refresh_token
    connection.token_uri = credentials.token_uri
    connection.client_id = credentials.client_id
    connection.client_secret = credentials.client_secret
    connection.scopes = json.dumps(credentials.scopes or GOOGLE_SCOPES)
    connection.expiry = credentials.expiry

    db.commit()
    db.refresh(connection)

    return connection


def handle_google_callback(db: Session, authorization_response_url: str) -> None:
    try:
        flow = create_google_flow()
        flow.fetch_token(authorization_response=authorization_response_url)
        store_google_credentials(db, flow.credentials)
    except Exception as exc:
        raise RuntimeError(f"Google OAuth callback failed: {exc}") from exc


def get_google_credentials(db: Session) -> Credentials:
    connection = (
        db.query(IntegrationConnection)
        .filter(IntegrationConnection.provider == "google")
        .first()
    )

    if not connection or not connection.access_token:
        raise RuntimeError("Google is not connected")

    credentials = Credentials(
        token=connection.access_token,
        refresh_token=connection.refresh_token,
        token_uri=connection.token_uri,
        client_id=connection.client_id,
        client_secret=connection.client_secret,
        scopes=json.loads(connection.scopes or "[]"),
    )

    if credentials.expired and credentials.refresh_token:
        credentials.refresh(GoogleAuthRequest())

        connection.access_token = credentials.token
        connection.expiry = credentials.expiry

        db.commit()

    return credentials


def create_calendar_event(db: Session, meeting: Meeting) -> dict[str, Any]:
    credentials = get_google_credentials(db)
    service = build("calendar", "v3", credentials=credentials)

    start_time = meeting.start_time
    if not start_time:
        raise RuntimeError("Meeting has no start time")

    end_time = start_time + timedelta(minutes=meeting.duration_minutes)

    event_body = {
        "summary": meeting.title,
        "description": (
            f"{meeting.description or ''}\n\n"
            f"Join MeetSync meeting:\n{meeting.invite_link}\n\n"
            f"Meeting ID: {meeting.meeting_id}"
        ),
        "start": {
            "dateTime": start_time.isoformat(),
            "timeZone": "Asia/Kolkata",
        },
        "end": {
            "dateTime": end_time.isoformat(),
            "timeZone": "Asia/Kolkata",
        },
    }

    event = (
        service.events()
        .insert(calendarId="primary", body=event_body)
        .execute()
    )

    return {
        "id": event.get("id"),
        "htmlLink": event.get("htmlLink"),
        "summary": event.get("summary"),
    }


def create_drive_notes_file(db: Session, meeting: Meeting) -> dict[str, Any]:
    credentials = get_google_credentials(db)
    service = build("drive", "v3", credentials=credentials)

    content = f"""MeetSync Pro Meeting Notes

Title: {meeting.title}
Meeting ID: {meeting.meeting_id}
Host: {meeting.host_name}
Duration: {meeting.duration_minutes} minutes
Invite Link: {meeting.invite_link}

Agenda:
- Project updates
- Action items
- Blockers
- Next steps

Notes:
Write your notes here.
"""

    file_metadata = {
        "name": f"MeetSync Notes - {meeting.meeting_id}.txt",
        "mimeType": "text/plain",
    }

    media = MediaIoBaseUpload(
        io.BytesIO(content.encode("utf-8")),
        mimetype="text/plain",
        resumable=False,
    )

    file = (
        service.files()
        .create(
            body=file_metadata,
            media_body=media,
            fields="id,name,webViewLink",
        )
        .execute()
    )

    return {
        "id": file.get("id"),
        "name": file.get("name"),
        "webViewLink": file.get("webViewLink"),
    }


def send_slack_message(text: str) -> dict[str, Any]:
    if not SLACK_WEBHOOK_URL:
        raise RuntimeError("SLACK_WEBHOOK_URL missing in backend .env")

    response = requests.post(
        SLACK_WEBHOOK_URL,
        json={"text": text},
        timeout=15,
    )

    if response.status_code >= 400:
        raise RuntimeError(f"Slack webhook failed: {response.text}")

    return {"ok": True}


def send_meeting_to_slack(meeting: Meeting) -> dict[str, Any]:
    text = (
        f"📹 *MeetSync Pro Meeting Created*\n"
        f"*Title:* {meeting.title}\n"
        f"*Meeting ID:* {meeting.meeting_id}\n"
        f"*Host:* {meeting.host_name}\n"
        f"*Join Link:* {meeting.invite_link}"
    )

    return send_slack_message(text)


def integration_status(db: Session) -> dict[str, Any]:
    google = (
        db.query(IntegrationConnection)
        .filter(IntegrationConnection.provider == "google")
        .first()
    )

    return {
        "googleConnected": bool(google and google.access_token),
        "calendarConnected": bool(google and google.access_token),
        "driveConnected": bool(google and google.access_token),
        "slackConfigured": bool(SLACK_WEBHOOK_URL),
    }