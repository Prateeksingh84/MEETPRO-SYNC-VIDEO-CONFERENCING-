import hashlib
import os
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.orm import Session

from .models import ChatMessage, Meeting, Participant, User


FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:3000")


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def to_utc_safe(value: datetime | None) -> datetime | None:
    if value is None:
        return None

    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)

    return value.astimezone(timezone.utc)


def parse_datetime(value: Any) -> datetime | None:
    if value is None:
        return None

    if isinstance(value, datetime):
        return value

    if isinstance(value, str):
        cleaned = value.replace("Z", "+00:00")
        return datetime.fromisoformat(cleaned)

    return None


def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


def verify_password(password: str, password_hash: str) -> bool:
    return hash_password(password) == password_hash


def generate_meeting_id() -> str:
    raw = str(uuid.uuid4().int)[:9]
    return f"{raw[:3]}-{raw[3:6]}-{raw[6:9]}"


def build_invite_link(meeting_id: str) -> str:
    return f"{FRONTEND_ORIGIN}/join?meetingId={meeting_id}"


def serialize_user(user: User) -> dict[str, Any]:
    return {
        "public_id": user.public_id,
        "name": user.name,
        "email": user.email,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }


def create_user(db: Session, payload: Any) -> User:
    email = str(payload.email).strip().lower()
    name = str(payload.name).strip()
    password = str(payload.password)

    if not name:
        raise ValueError("Name is required")

    if not email:
        raise ValueError("Email is required")

    if len(password) < 6:
        raise ValueError("Password must be at least 6 characters")

    existing = db.query(User).filter(User.email == email).first()

    if existing:
        raise ValueError("Account already exists. Please login instead.")

    user = User(
        public_id=str(uuid.uuid4()),
        name=name,
        email=email,
        password_hash=hash_password(password),
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    return user


def authenticate_user(db: Session, email: str, password: str) -> User | None:
    cleaned_email = str(email).strip().lower()

    user = db.query(User).filter(User.email == cleaned_email).first()

    if not user:
        return None

    if not verify_password(password, user.password_hash):
        return None

    return user


def serialize_meeting(meeting: Meeting) -> dict[str, Any]:
    return {
        "meeting_id": meeting.meeting_id,
        "title": meeting.title,
        "description": meeting.description,
        "start_time": meeting.start_time.isoformat() if meeting.start_time else None,
        "duration_minutes": meeting.duration_minutes,
        "host_name": meeting.host_name,
        "invite_link": meeting.invite_link,
        "meeting_type": meeting.meeting_type,
        "created_at": meeting.created_at.isoformat() if meeting.created_at else None,
    }


def get_meeting_by_public_id(db: Session, meeting_id: str) -> Meeting | None:
    return db.query(Meeting).filter(Meeting.meeting_id == meeting_id).first()


def create_instant_meeting(db: Session, payload: Any) -> Meeting:
    host_name = getattr(payload, "host_name", None) or "User"

    meeting_id = generate_meeting_id()

    while get_meeting_by_public_id(db, meeting_id):
        meeting_id = generate_meeting_id()

    meeting = Meeting(
        meeting_id=meeting_id,
        title=f"{host_name}'s Instant Meeting",
        description="Instant meeting created from dashboard.",
        start_time=utc_now(),
        duration_minutes=60,
        host_name=host_name,
        invite_link=build_invite_link(meeting_id),
        meeting_type="instant",
    )

    db.add(meeting)
    db.commit()
    db.refresh(meeting)

    return meeting


def schedule_meeting(db: Session, payload: Any) -> Meeting:
    title = str(getattr(payload, "title", "")).strip()
    description = str(getattr(payload, "description", "") or "").strip()
    duration_minutes = int(getattr(payload, "duration_minutes", 60) or 60)
    start_time = parse_datetime(getattr(payload, "start_time", None))

    if not title:
        raise ValueError("Meeting title is required")

    if start_time is None:
        raise ValueError("Meeting start time is required")

    meeting_id = generate_meeting_id()

    while get_meeting_by_public_id(db, meeting_id):
        meeting_id = generate_meeting_id()

    meeting = Meeting(
        meeting_id=meeting_id,
        title=title,
        description=description,
        start_time=start_time,
        duration_minutes=duration_minutes,
        host_name="Host",
        invite_link=build_invite_link(meeting_id),
        meeting_type="scheduled",
    )

    db.add(meeting)
    db.commit()
    db.refresh(meeting)

    return meeting


def join_meeting(db: Session, meeting: Meeting, display_name: str) -> Participant:
    active_count = (
        db.query(Participant)
        .filter(
            Participant.meeting_id == meeting.id,
            Participant.left_at.is_(None),
        )
        .count()
    )

    participant = Participant(
        public_id=str(uuid.uuid4()),
        meeting_id=meeting.id,
        display_name=display_name.strip() or "Guest",
        is_host=active_count == 0,
        is_muted=False,
        camera_on=True,
    )

    db.add(participant)
    db.commit()
    db.refresh(participant)

    return participant


def mark_left(db: Session, participant_public_id: str) -> None:
    participant = (
        db.query(Participant)
        .filter(Participant.public_id == participant_public_id)
        .first()
    )

    if participant and participant.left_at is None:
        participant.left_at = utc_now()
        db.commit()


def update_participant_media_state(
    db: Session,
    participant_public_id: str,
    is_muted: bool | None,
    camera_on: bool | None,
) -> None:
    participant = (
        db.query(Participant)
        .filter(Participant.public_id == participant_public_id)
        .first()
    )

    if not participant:
        return

    if is_muted is not None:
        participant.is_muted = bool(is_muted)

    if camera_on is not None:
        participant.camera_on = bool(camera_on)

    db.commit()


def persist_chat_message(
    db: Session,
    meeting: Meeting,
    participant_public_id: str,
    sender_name: str,
    message: str,
) -> ChatMessage:
    chat = ChatMessage(
        meeting_id=meeting.id,
        participant_public_id=participant_public_id,
        sender_name=sender_name,
        message=message,
    )

    db.add(chat)
    db.commit()
    db.refresh(chat)

    return chat


def get_dashboard(db: Session) -> dict[str, list[dict[str, Any]]]:
    now = utc_now()

    scheduled_meetings = (
        db.query(Meeting)
        .filter(Meeting.meeting_type == "scheduled")
        .order_by(Meeting.start_time.asc())
        .all()
    )

    upcoming: list[dict[str, Any]] = []

    for meeting in scheduled_meetings:
        start_time = to_utc_safe(meeting.start_time)

        if start_time and start_time >= now:
            upcoming.append(serialize_meeting(meeting))

    recent_meetings = (
        db.query(Meeting)
        .filter(Meeting.meeting_type == "instant")
        .order_by(Meeting.created_at.desc())
        .limit(10)
        .all()
    )

    return {
        "upcoming": upcoming,
        "recent": [serialize_meeting(meeting) for meeting in recent_meetings],
    }


def get_platform_summary(db: Session) -> dict[str, Any]:
    total_meetings = db.query(Meeting).count()

    scheduled_meetings = (
        db.query(Meeting)
        .filter(Meeting.meeting_type == "scheduled")
        .count()
    )

    instant_meetings = (
        db.query(Meeting)
        .filter(Meeting.meeting_type == "instant")
        .count()
    )

    total_participants = db.query(Participant).count()

    active_participants = (
        db.query(Participant)
        .filter(Participant.left_at.is_(None))
        .count()
    )

    total_messages = db.query(ChatMessage).count()

    return {
        "totalMeetings": total_meetings,
        "scheduledMeetings": scheduled_meetings,
        "instantMeetings": instant_meetings,
        "totalParticipants": total_participants,
        "activeParticipants": active_participants,
        "totalMessages": total_messages,
        "updatedAt": datetime.now(timezone.utc).isoformat(),
    }