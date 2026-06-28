"use client";

import { PointerEvent, useEffect, useRef, useState } from "react";
import { DashboardHeader } from "@/components/DashboardHeader";
import { getWorkspaceWsUrl } from "@/lib/api";
import { WhiteboardStroke, WorkspaceUser } from "@/lib/types";

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

function drawStroke(canvas: HTMLCanvasElement, stroke: WhiteboardStroke) {
  const ctx = canvas.getContext("2d");

  if (!ctx) return;

  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = stroke.color;
  ctx.lineWidth = stroke.width;

  ctx.beginPath();
  ctx.moveTo(stroke.x0 * canvas.width, stroke.y0 * canvas.height);
  ctx.lineTo(stroke.x1 * canvas.width, stroke.y1 * canvas.height);
  ctx.stroke();
}

export default function WhiteboardsPage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  const [users, setUsers] = useState<WorkspaceUser[]>([]);
  const [connected, setConnected] = useState(false);
  const [color, setColor] = useState("#0b5cff");
  const [width, setWidth] = useState(4);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) return;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();

      canvas.width = Math.floor(rect.width * window.devicePixelRatio);
      canvas.height = Math.floor(rect.height * window.devicePixelRatio);
    };

    resize();

    window.addEventListener("resize", resize);

    return () => window.removeEventListener("resize", resize);
  }, []);

  useEffect(() => {
    const ws = new WebSocket(getWorkspaceWsUrl("whiteboard-main", getClientId(), "Prateek Singh"));
    socketRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      const canvas = canvasRef.current;

      if (data.type === "workspace-init") {
        setUsers(data.users || []);

        setTimeout(() => {
          (data.strokes || []).forEach((stroke: WhiteboardStroke) => {
            if (canvas) drawStroke(canvas, stroke);
          });
        }, 50);
      }

      if (data.type === "presence") {
        setUsers(data.users || []);
      }

      if (data.type === "whiteboard-draw" && canvas) {
        drawStroke(canvas, data.stroke);
      }

      if (data.type === "whiteboard-clear" && canvas) {
        const ctx = canvas.getContext("2d");
        ctx?.clearRect(0, 0, canvas.width, canvas.height);
      }
    };

    return () => ws.close();
  }, []);

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
      author: "Prateek Singh",
    };

    const canvas = canvasRef.current;

    if (canvas) drawStroke(canvas, stroke);

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
