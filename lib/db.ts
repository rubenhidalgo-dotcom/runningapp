import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { D1Database } from "@cloudflare/workers-types";

type CloudflareEnv = Record<string, unknown> & {
  DB: D1Database;
};

export async function db(): Promise<D1Database> {
  const context = await getCloudflareContext({
    async: true,
  });

  const env = context.env as CloudflareEnv;

  return env.DB;
}

export function userId(request: Request): string {
  const id = request.headers.get("x-user-id");

  if (!id || !/^[a-zA-Z0-9-]{8,80}$/.test(id)) {
    throw new Error("Missing or invalid anonymous user ID");
  }

  return id;
}

export function jsonError(
  error: unknown,
  status?: number,
): Response {
  const message =
    error instanceof Error
      ? error.message
      : "Unexpected error";

  const responseStatus =
    status ??
    (message === "UNAUTHENTICATED"
      ? 401
      : 400);

  return Response.json(
    {
      error:
        message === "UNAUTHENTICATED"
          ? "You need to sign in."
          : message,
    },
    {
      status: responseStatus,
    },
  );
}
