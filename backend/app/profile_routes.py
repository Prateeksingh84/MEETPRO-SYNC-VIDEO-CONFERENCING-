import random
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from .database import engine, get_db


router = APIRouter(prefix="/api/profile", tags=["profile"])


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


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


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


def serialize_profile(row: Any) -> dict:
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


@router.get("/{public_id}")
def get_profile(public_id: str, db: Session = Depends(get_db)):
    row = get_user_profile_row(db, public_id)
    return serialize_profile(row)


@router.put("/{public_id}")
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


@router.post("/{public_id}/photo")
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


@router.post("/{public_id}/verify-email/request")
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


@router.post("/{public_id}/verify-email/confirm")
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


@router.delete("/{public_id}")
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