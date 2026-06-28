from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    public_id: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(String(180), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(300), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class Meeting(Base):
    __tablename__ = "meetings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    meeting_id: Mapped[str] = mapped_column(String(20), unique=True, index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    start_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    duration_minutes: Mapped[int] = mapped_column(Integer, default=60)
    host_name: Mapped[str] = mapped_column(String(120), default="Prateek Singh")
    invite_link: Mapped[str] = mapped_column(String(500), nullable=False)
    meeting_type: Mapped[str] = mapped_column(String(30), default="scheduled")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    participants: Mapped[list["Participant"]] = relationship(
        back_populates="meeting",
        cascade="all, delete-orphan",
    )

    messages: Mapped[list["ChatMessage"]] = relationship(
        back_populates="meeting",
        cascade="all, delete-orphan",
    )


class Participant(Base):
    __tablename__ = "participants"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    public_id: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    meeting_id: Mapped[int] = mapped_column(ForeignKey("meetings.id"), nullable=False)
    display_name: Mapped[str] = mapped_column(String(120), nullable=False)
    is_host: Mapped[bool] = mapped_column(Boolean, default=False)
    is_muted: Mapped[bool] = mapped_column(Boolean, default=False)
    camera_on: Mapped[bool] = mapped_column(Boolean, default=True)
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    left_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    meeting: Mapped[Meeting] = relationship(back_populates="participants")


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    meeting_id: Mapped[int] = mapped_column(ForeignKey("meetings.id"), nullable=False)
    participant_public_id: Mapped[str] = mapped_column(String(64), nullable=False)
    sender_name: Mapped[str] = mapped_column(String(120), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    meeting: Mapped[Meeting] = relationship(back_populates="messages")


class IntegrationConnection(Base):
    __tablename__ = "integration_connections"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    provider: Mapped[str] = mapped_column(String(80), unique=True, index=True, nullable=False)

    access_token: Mapped[str | None] = mapped_column(Text, nullable=True)
    refresh_token: Mapped[str | None] = mapped_column(Text, nullable=True)
    token_uri: Mapped[str | None] = mapped_column(String(300), nullable=True)
    client_id: Mapped[str | None] = mapped_column(String(300), nullable=True)
    client_secret: Mapped[str | None] = mapped_column(String(300), nullable=True)
    scopes: Mapped[str | None] = mapped_column(Text, nullable=True)
    expiry: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        onupdate=utc_now,
    )