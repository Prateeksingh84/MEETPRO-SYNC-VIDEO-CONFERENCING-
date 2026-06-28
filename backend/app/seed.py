from sqlalchemy.orm import Session


def seed_database(db: Session, frontend_origin: str | None = None) -> None:
    """
    No hardcoded demo meetings.

    This keeps the dashboard real:
    - Upcoming meetings appear only after the user schedules them.
    - Recent meetings appear only after the user creates/starts meetings.
    """
    return None