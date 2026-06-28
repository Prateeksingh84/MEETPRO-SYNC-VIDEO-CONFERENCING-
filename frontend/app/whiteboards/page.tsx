"use client";

import { PointerEvent, useEffect, useMemo, useRef, useState } from "react";
import { DashboardHeader } from "@/components/DashboardHeader";
import { getWsUrl } from "@/lib/api";
import { WhiteboardStroke, WorkspaceUser } from "@/lib/types";

type RawWorkspaceUser = {
  clientId?: string;
  client_id?: string;
  id?: string;
  name?: string;
  displayName?: string;
  display_name?: string;
};

type RawWhiteboardStroke = {
  id?: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  color: string;
  width: number;
  author?: string;
};

function getClientId() {
  if (typeof window === "undefined") return "server-client";

  const key = "meetsync-client-id";
  let value = sessionStorage.getItem(key);

  if (!value) {
    value = crypto.randomUUID();
    sessionStorage.setItem(key, value);
  }

  return value;
}

function getCurrentUserName() {
  if (typeof window === "undefined") return "Guest";

  const possibleKeys = ["meetsync-user-v2", "meetsync-auth-v2", "meetsync-user"];

  for (const key of possibleKeys) {
    const raw = localStorage.getItem(key);

    if (!raw) continue;

    try {
      const parsed = JSON.parse(raw);

      const name =
        parsed?.name ||
        parsed?.user?.name ||
        parsed?.profile?.name ||
        parsed?.displayName ||
        parsed?.display_name;

      if (typeof name === "string" && name.trim()) {
        return name.trim();
      }
    } catch {
      continue;
    }
  }

  return "Guest";
}

function normalizeUser(user: RawWorkspaceUser, fallbackClientId: string, fallbackName: string) {
  return {
    clientId: user.clientId || user.client_id || user.id || fallbackClientId,
    name: user.name || user.displayName || user.display_name || fallbackName,
  } as WorkspaceUser;
}

function normalizeStroke(stroke: RawWhiteboardStroke, fallbackAuthor: string): WhiteboardStroke {
  return {
    id: stroke.id || crypto.randomUUID(),
    x0: stroke.x0,
    y0: stroke.y0,
    x1: stroke.x1,
    y1: stroke.y1,
    color: stroke.color,
    width: stroke.width,
    author: stroke.author || fallbackAuthor,
  };
}

function drawStroke(canvas: HTMLCanvasElement, stroke: WhiteboardStroke) {
  const ctx = canvas.getContext("2d");

  if (!ctx) return;

  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = stroke.color;
  ctx.lineWidth = stroke.width * window.devicePixelRatio;

  ctx.beginPath();
  ctx.moveTo(stroke.x0 * canvas.width, stroke.y0 * canvas.height);
  ctx.lineTo(stroke.x1 * canvas.width, stroke.y1 * canvas.height);
  ctx.stroke();
}

export default function WhiteboardsPage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const strokesRef = useRef<WhiteboardStroke[]>([]);

  const clientId = useMemo(() => getClientId(), []);
  const displayName = useMemo(() => getCurrentUserName(), []);

  const [users, setUsers] = useState<WorkspaceUser[]>([]);
  const [connected, setConnected] = useState(false);
  const [color, setColor] = useState("#0b5cff");
  const [width, setWidth] = useState(4);
  const [error, setError] = useState("");

  function redrawCanvas() {
    const canvas = canvasRef.current;

    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    strokesRef.current.forEach((stroke) => {
      drawStroke(canvas, stroke);
    });
  }

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) return;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const pixelRatio = window.devicePixelRatio || 1;

      canvas.width = Math.floor(rect.width * pixelRatio);
      canvas.height = Math.floor(rect.height * pixelRatio);

      redrawCanvas();
    };

    resize();

    window.addEventListener("resize", resize);

    return () => window.removeEventListener("resize", resize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const socketPath = `/ws/workspace/whiteboard-main?clientId=${encodeURIComponent(
      clientId,
    )}&displayName=${encodeURIComponent(displayName)}`;

    const ws = new WebSocket(getWsUrl(socketPath));
    socketRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      setError("");

      const currentUser = normalizeUser(
        {
          clientId,
          name: displayName,
        },
        clientId,
        displayName,
      );

      setUsers((old) => {
        const exists = old.some((user) => user.clientId === currentUser.clientId);

        if (exists) return old;

        return [currentUser, ...old];
      });

      ws.send(
        JSON.stringify({
          type: "presence",
          clientId,
          name: displayName,
        }),
      );
    };

    ws.onclose = () => {
      setConnected(false);
    };

    ws.onerror = () => {
      setConnected(false);
      setError("Whiteboard connection failed. Please refresh or check backend WebSocket URL.");
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      const canvas = canvasRef.current;

      if (data.type === "workspace-init") {
        if (Array.isArray(data.users)) {
          setUsers(
            data.users.map((user: RawWorkspaceUser) =>
              normalizeUser(user, clientId, displayName),
            ),
          );
        }

        if (Array.isArray(data.strokes)) {
          strokesRef.current = data.strokes.map((stroke: RawWhiteboardStroke) =>
            normalizeStroke(stroke, displayName),
          );

          setTimeout(() => {
            redrawCanvas();
          }, 50);
        }

        return;
      }

      if (data.type === "presence") {
        if (Array.isArray(data.users)) {
          setUsers(
            data.users.map((user: RawWorkspaceUser) =>
              normalizeUser(user, clientId, displayName),
            ),
          );
          return;
        }

        const user = normalizeUser(data, clientId, displayName);

        setUsers((old) => {
          const exists = old.some((item) => item.clientId === user.clientId);

          if (exists) {
            return old.map((item) => (item.clientId === user.clientId ? user : item));
          }

          return [user, ...old];
        });

        return;
      }

      if (data.type === "whiteboard-draw" && canvas && data.stroke) {
        const stroke = normalizeStroke(data.stroke, displayName);

        strokesRef.current.push(stroke);
        drawStroke(canvas, stroke);

        return;
      }

      if (data.type === "whiteboard-clear" && canvas) {
        strokesRef.current = [];

        const ctx = canvas.getContext("2d");
        ctx?.clearRect(0, 0, canvas.width, canvas.height);

        return;
      }

      if (data.type === "system") {
        return;
      }
    };

    return () => {
      ws.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, displayName]);

  function pointerPosition(event: PointerEvent<HTMLCanvasElement>) {
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();

    return {
      x: (event.clientX - rect.left) / rect.width,
      y: (event.clientY - rect.top) / rect.height,
    };
  }

  function startDrawing(event: PointerEvent<HTMLCanvasElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    lastPointRef.current = pointerPosition(event);
  }

  function draw(event: PointerEvent<HTMLCanvasElement>) {
    if (!lastPointRef.current || socketRef.current?.readyState !== WebSocket.OPEN) return;

    const current = pointerPosition(event);

    const stroke: WhiteboardStroke = {
      id: crypto.randomUUID(),
      x0: lastPointRef.current.x,
      y0: lastPointRef.current.y,
      x1: current.x,
      y1: current.y,
      color,
      width,
      author: displayName,
    };

    const canvas = canvasRef.current;

    if (canvas) {
      strokesRef.current.push(stroke);
      drawStroke(canvas, stroke);
    }

    socketRef.current.send(
      JSON.stringify({
        type: "whiteboard-draw",
        stroke,
      }),
    );

    lastPointRef.current = current;
  }

  function stopDrawing() {
    lastPointRef.current = null;
  }

  function clearBoard() {
    const canvas = canvasRef.current;

    strokesRef.current = [];
    canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);

    socketRef.current?.send(
      JSON.stringify({
        type: "whiteboard-clear",
      }),
    );
  }

  return (
    <main className="dashboard-page">
      <DashboardHeader />

      <section className="workspace-page">
        <div className="workspace-title-row">
          <div>
            <p className="eyebrow">Collaborative canvas</p>
            <h2>Whiteboards</h2>
            <p>Draw on one browser and see it update instantly in another browser/window.</p>
          </div>

          <div className="whiteboard-tools">
            <input
              type="color"
              value={color}
              onChange={(event) => setColor(event.target.value)}
              aria-label="Brush color"
            />

            <select value={width} onChange={(event) => setWidth(Number(event.target.value))}>
              <option value={3}>Thin</option>
              <option value={6}>Medium</option>
              <option value={10}>Bold</option>
            </select>

            <button className="secondary-button" onClick={clearBoard}>
              Clear board
            </button>
          </div>
        </div>

        {error && <div className="error-box">{error}</div>}

        <div className="whiteboard-shell">
          <div className="whiteboard-status">
            <strong>{connected ? "Live collaborative session" : "Connecting..."}</strong>
            <span>{users.length} user(s) online</span>
          </div>

          <canvas
            ref={canvasRef}
            className="whiteboard-canvas"
            onPointerDown={startDrawing}
            onPointerMove={draw}
            onPointerUp={stopDrawing}
            onPointerCancel={stopDrawing}
            onPointerLeave={stopDrawing}
          />
        </div>
      </section>
    </main>
  );
}