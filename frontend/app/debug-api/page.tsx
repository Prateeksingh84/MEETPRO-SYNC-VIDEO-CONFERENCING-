"use client";

import { useEffect, useState } from "react";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE;

export default function DebugApiPage() {
  const [result, setResult] = useState("Testing backend connection...");

  useEffect(() => {
    async function testBackend() {
      try {
        if (!API_BASE) {
          setResult("Missing NEXT_PUBLIC_API_BASE_URL in Vercel environment variables.");
          return;
        }

        const cleanBase = API_BASE.replace(/\/$/, "");
        const response = await fetch(`${cleanBase}/api/health`, {
          method: "GET",
          mode: "cors",
          cache: "no-store",
        });

        const text = await response.text();

        setResult(
          `API_BASE: ${cleanBase}\nStatus: ${response.status}\nResponse: ${text}`,
        );
      } catch (error) {
        setResult(
          `Backend fetch failed: ${
            error instanceof Error ? error.message : "Unknown error"
          }\nAPI_BASE: ${API_BASE || "MISSING"}`,
        );
      }
    }

    testBackend();
  }, []);

  return (
    <main style={{ padding: 32, fontFamily: "Arial, sans-serif", whiteSpace: "pre-wrap" }}>
      <h1>Backend API Debug</h1>
      <p>{result}</p>
    </main>
  );
}
