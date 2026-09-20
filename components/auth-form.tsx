"use client";

import {
  ArrowRight,
  LockKeyhole,
  UserRound,
} from "lucide-react";
import { useState } from "react";

type AuthMode = "login" | "register";

export default function AuthForm({
  mode,
}: {
  mode: AuthMode;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setBusy(true);
    setError("");

    const form = new FormData(
      event.currentTarget,
    );

    const password = String(
      form.get("password") ?? "",
    );

    if (mode === "register") {
      const confirmation = String(
        form.get("passwordConfirmation") ?? "",
      );

      if (password !== confirmation) {
        setError("The passwords do not match.");
        setBusy(false);
        return;
      }
    }

    const guestUserId =
      localStorage.getItem("run-user-id");

    const body =
      mode === "register"
        ? {
            name: form.get("name"),
            email: form.get("email"),
            password,
            guestUserId,
          }
        : {
            email: form.get("email"),
            password,
          };

    try {
      const response = await fetch(
        `/api/auth/${mode}`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify(body),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ?? "Authentication failed.",
        );
      }

      if (mode === "register") {
        localStorage.removeItem("run-user-id");
      }

      window.location.href = "/";
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Authentication failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  const registering = mode === "register";

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-logo">RUN</div>

        <div className="auth-icon">
          {registering ? (
            <UserRound size={29} />
          ) : (
            <LockKeyhole size={29} />
          )}
        </div>

        <h1>
          {registering
            ? "Create your account"
            : "Welcome back"}
        </h1>

        <p className="auth-intro">
          {registering
            ? "Create an account to keep your plans and completed runs available across devices."
            : "Sign in to access your training plans and progress."}
        </p>

        <form onSubmit={submit}>
          {registering && (
            <div className="field">
              <label htmlFor="name">
                NAME
              </label>

              <input
                id="name"
                name="name"
                autoComplete="name"
                minLength={2}
                maxLength={80}
                required
              />
            </div>
          )}

          <div className="field">
            <label htmlFor="email">
              EMAIL
            </label>

            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
            />
          </div>

          <div className="field">
            <label htmlFor="password">
              PASSWORD
            </label>

            <input
              id="password"
              name="password"
              type="password"
              autoComplete={
                registering
                  ? "new-password"
                  : "current-password"
              }
              minLength={12}
              maxLength={128}
              required
            />
          </div>

          {registering && (
            <div className="field">
              <label htmlFor="passwordConfirmation">
                CONFIRM PASSWORD
              </label>

              <input
                id="passwordConfirmation"
                name="passwordConfirmation"
                type="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={128}
                required
              />
            </div>
          )}

          {error && (
            <div className="error">{error}</div>
          )}

                    <button
            className="primary"
            disabled={busy}
            type="submit"
          >
            {busy
              ? "Please wait…"
              : registering
                ? "Create account"
                : "Sign in"}

            {!busy && <ArrowRight size={18} />}
          </button>
        </form>

        <div className="auth-switch">
  <span>
    {registering
      ? "Already have an account?"
      : "New to RUN?"}
  </span>

  <button
    type="button"
    onClick={() => {
      window.location.href = registering
        ? "/login"
        : "/register";
    }}
  >
    {registering
      ? "Sign in"
      : "Create an account"}
  </button>
</div>
      </section>
    </main>
  );
}