"use client";

import { useEffect, useState } from "react";
import RunApp from "@/components/run-app";

type Tab =
  | "today"
  | "week"
  | "plan"
  | "settings";

export default function ProtectedRunApp({
  initialTab = "today",
}: {
  initialTab?: Tab;
}) {
  const [authenticated, setAuthenticated] =
    useState(false);

  const [checking, setChecking] =
    useState(true);

  useEffect(() => {
    async function checkSession() {
      try {
        const response = await fetch(
          "/api/auth/session",
          {
            credentials: "include",
            cache: "no-store",
          },
        );

        if (!response.ok) {
          window.location.replace("/login");
          return;
        }

        setAuthenticated(true);
      } catch {
        window.location.replace("/login");
      } finally {
        setChecking(false);
      }
    }

    void checkSession();
  }, []);

  if (checking || !authenticated) {
    return (
      <main className="app">
        <div className="loading">
          Checking your session…
        </div>
      </main>
    );
  }

  return <RunApp initialTab={initialTab} />;
}