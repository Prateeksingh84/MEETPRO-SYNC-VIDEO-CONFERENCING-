from datetime import datetime

from pydantic import BaseModel, Field


class UserResponse(BaseModel):
    public_id: str
    name: str
    email: str
    created_at: datetime


class SignupRequest(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: str = Field(min_length=5, max_length=180)
    password: str = Field(min_length=6, max_length=100)


class LoginRequest(BaseModel):
    email: str = Field(min_length=5, max_length=180)
    password: str = Field(min_length=6, max_length=100)


class AuthResponse(BaseModel):
    token: str
    user: UserResponse


class MeetingBase(BaseModel):
    title: str = Field(min_length=2, max_length=160)
    description: str | None = None
    start_time: datetime | None = None
    duration_minutes: int = Field(default=60, ge=15, le=480)
    host_name: str = Field(default="Prateek Singh", max_length=120)


class ScheduleMeetingRequest(MeetingBase):
    pass


class InstantMeetingRequest(BaseModel):
    host_name: str = Field(default="Prateek Singh", max_length=120)


class JoinMeetingRequest(BaseModel):
    display_name: str = Field(min_length=2, max_length=120)


class ParticipantResponse(BaseModel):
    public_id: str
    display_name: str
    is_host: bool
    is_muted: bool
    camera_on: bool
    joined_at: datetime


class MeetingResponse(BaseModel):
    meeting_id: str
    title: str
    description: str | None
    start_time: datetime | None
    duration_minutes: int
    host_name: str
    invite_link: str
    meeting_type: str
    created_at: datetime


class JoinMeetingResponse(BaseModel):
    participant_id: str
    meeting: MeetingResponse
    is_host: bool


class DashboardResponse(BaseModel):
    upcoming: list[MeetingResponse]
    recent: list[MeetingResponse]
