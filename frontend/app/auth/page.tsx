"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/ThemeToggle";
import { login, signup } from "@/lib/api";

const TOKEN_KEY = "meetsync-auth-v2";
const USER_KEY = "meetsync-user-v2";

export default function AuthPage() {
  const router = useRouter();

  const [mode, setMode] = useState<"login" | "signup">("login");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();

    setError("");
    setSuccess("");
    setLoading(true);

    try {
      if (mode === "signup") {
        await signup({
          name: name.trim(),
          email: email.trim(),
          password,
        });

        setSuccess("Account created successfully. Please login to continue.");

        setMode("login");
        setName("");
        setPassword("");

        return;
      }

      const response = await login({
        email: email.trim(),
        password,
      });

      localStorage.setItem(TOKEN_KEY, response.token);
      localStorage.setItem(USER_KEY, JSON.stringify(response.user));

      localStorage.removeItem("meetsync-token");
      localStorage.removeItem("meetsync-user");

      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  function switchMode(nextMode: "login" | "signup") {
    setMode(nextMode);
    setError("");
    setSuccess("");
    setName("");
    setEmail("");
    setPassword("");
  }

  return (
    <main className="auth-page">
      <div className="auth-theme-corner">
        <ThemeToggle />
      </div>

      <section className="auth-card auth-card-polished">
        <Link href="/" className="auth-brand">
          <div className="brand-logo">M</div>

          <div>
            <p className="eyebrow">Video Conferencing Platform</p>
            <h2>MeetSync Pro</h2>
          </div>
        </Link>

        <div className="auth-tabs">
          <button
            type="button"
            className={mode === "login" ? "active" : ""}
            onClick={() => switchMode("login")}
          >
            Login
          </button>

          <button
            type="button"
            className={mode === "signup" ? "active" : ""}
            onClick={() => switchMode("signup")}
          >
            Signup
          </button>
        </div>

        <div>
          <h1>{mode === "login" ? "Login" : "Create account"}</h1>

          <p>
            {mode === "login"
              ? "Login to continue to your MeetSync Pro dashboard."
              : "Create your account first. After successful signup, you can login to access the dashboard."}
          </p>
        </div>

        {success && <div className="success-box">{success}</div>}
        {error && <div className="error-box">{error}</div>}

        <form className="form-stack" onSubmit={submit}>
          {mode === "signup" && (
            <label>
              Name
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Enter your name"
                required
              />
            </label>
          )}

          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Enter your email"
              required
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
              required
              minLength={6}
            />
          </label>

          <button className="primary-button auth-submit-button" type="submit" disabled={loading}>
            {loading
              ? mode === "login"
                ? "Logging in..."
                : "Creating account..."
              : mode === "login"
                ? "Login"
                : "Create Account"}
          </button>
        </form>
      </section>
    </main>
  );
}