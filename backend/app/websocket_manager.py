from typing import Any

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self) -> None:
        self.active_connections: dict[str, dict[str, WebSocket]] = {}
        self.participants: dict[str, dict[str, dict[str, Any]]] = {}

    async def connect(
        self,
        meeting_id: str,
        participant_id: str,
        websocket: WebSocket,
        participant_meta: dict[str, Any],
    ) -> list[dict[str, Any]]:
        await websocket.accept()

        if meeting_id not in self.active_connections:
            self.active_connections[meeting_id] = {}

        if meeting_id not in self.participants:
            self.participants[meeting_id] = {}

        existing_participants = list(self.participants[meeting_id].values())

        self.active_connections[meeting_id][participant_id] = websocket
        self.participants[meeting_id][participant_id] = participant_meta

        return existing_participants

    async def disconnect(self, meeting_id: str, participant_id: str) -> None:
        if meeting_id in self.active_connections:
            self.active_connections[meeting_id].pop(participant_id, None)

            if not self.active_connections[meeting_id]:
                self.active_connections.pop(meeting_id, None)

        if meeting_id in self.participants:
            self.participants[meeting_id].pop(participant_id, None)

            if not self.participants[meeting_id]:
                self.participants.pop(meeting_id, None)

    def get_participants(self, meeting_id: str) -> list[dict[str, Any]]:
        return list(self.participants.get(meeting_id, {}).values())

    def update_participant(
        self,
        meeting_id: str,
        participant_id: str,
        updates: dict[str, Any],
    ) -> None:
        if meeting_id in self.participants and participant_id in self.participants[meeting_id]:
            self.participants[meeting_id][participant_id].update(updates)

    async def send_personal_message(
        self,
        websocket: WebSocket,
        message: dict[str, Any],
    ) -> None:
        await websocket.send_json(message)

    async def send_to_participant(
        self,
        meeting_id: str,
        participant_id: str,
        message: dict[str, Any],
    ) -> None:
        socket = self.active_connections.get(meeting_id, {}).get(participant_id)

        if socket:
            await socket.send_json(message)

    async def broadcast(
        self,
        meeting_id: str,
        message: dict[str, Any],
        exclude_participant_id: str | None = None,
    ) -> None:
        for participant_id, websocket in list(
            self.active_connections.get(meeting_id, {}).items()
        ):
            if participant_id == exclude_participant_id:
                continue

            await websocket.send_json(message)
