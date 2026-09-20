import type { D1Database } from "@cloudflare/workers-types";
import { db } from "@/lib/db";

const COOKIE_NAME = "__Host-run_session";
const SESSION_LIFETIME_SECONDS =
  60 * 60 * 24 * 30;

const PASSWORD_ITERATIONS = 600_000;
const MINIMUM_PASSWORD_LENGTH = 12;

export type AuthUser = {
  id: string;
  email: string;
  name: string;
};

type SessionRecord = {
  user_id: string;
  email: string;
  display_name: string;
  expires_at: number;
};

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function randomBase64(byteLength: number): string {
  const bytes = crypto.getRandomValues(
    new Uint8Array(byteLength),
  );

  return bytesToBase64(bytes);
}

async function sha256(value: string): Promise<string> {
  const encoded = new TextEncoder().encode(value);

  const digest = await crypto.subtle.digest(
    "SHA-256",
    encoded,
  );

  return bytesToBase64(new Uint8Array(digest));
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function validatePassword(
  password: string,
): void {
  if (password.length < MINIMUM_PASSWORD_LENGTH) {
    throw new Error(
      `Password must contain at least ${MINIMUM_PASSWORD_LENGTH} characters.`,
    );
  }

  if (password.length > 128) {
    throw new Error(
      "Password must contain no more than 128 characters.",
    );
  }
}

export async function hashPassword(
  password: string,
  salt = randomBase64(16),
  iterations = PASSWORD_ITERATIONS,
): Promise<{
  hash: string;
  salt: string;
  iterations: number;
}> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: base64ToBytes(salt).buffer as ArrayBuffer,
      iterations,
    },
    keyMaterial,
    256,
  );

  return {
    hash: bytesToBase64(
      new Uint8Array(derivedBits),
    ),
    salt,
    iterations,
  };
}

function constantTimeEqual(
  first: string,
  second: string,
): boolean {
  const firstBytes = base64ToBytes(first);
  const secondBytes = base64ToBytes(second);

  if (firstBytes.length !== secondBytes.length) {
    return false;
  }

  let difference = 0;

  for (
    let index = 0;
    index < firstBytes.length;
    index += 1
  ) {
    difference |=
      firstBytes[index] ^ secondBytes[index];
  }

  return difference === 0;
}

export async function verifyPassword(
  password: string,
  expectedHash: string,
  salt: string,
  iterations: number,
): Promise<boolean> {
  const candidate = await hashPassword(
    password,
    salt,
    iterations,
  );

  return constantTimeEqual(
    candidate.hash,
    expectedHash,
  );
}

function getCookie(
  request: Request,
  name: string,
): string | null {
  const cookieHeader = request.headers.get("cookie");

  if (!cookieHeader) {
    return null;
  }

  const cookies = cookieHeader.split(";");

  for (const cookie of cookies) {
    const separator = cookie.indexOf("=");

    if (separator === -1) {
      continue;
    }

    const cookieName = cookie
      .slice(0, separator)
      .trim();

    if (cookieName === name) {
      return decodeURIComponent(
        cookie.slice(separator + 1).trim(),
      );
    }
  }

  return null;
}

export function createSessionCookie(
  token: string,
): string {
  return [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    `Max-Age=${SESSION_LIFETIME_SECONDS}`,
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
  ].join("; ");
}

export function clearSessionCookie(): string {
  return [
    `${COOKIE_NAME}=`,
    "Path=/",
    "Max-Age=0",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
  ].join("; ");
}

export async function createSession(
  database: D1Database,
  userId: string,
): Promise<string> {
  const token = randomBase64(32);
  const tokenHash = await sha256(token);
  const now = Date.now();

  await database
    .prepare(`
      INSERT INTO user_sessions (
        id,
        user_id,
        token_hash,
        expires_at,
        created_at,
        last_seen_at
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    .bind(
      crypto.randomUUID(),
      userId,
      tokenHash,
      now + SESSION_LIFETIME_SECONDS * 1000,
      now,
      now,
    )
    .run();

  return token;
}

export async function getSession(
  request: Request,
): Promise<AuthUser | null> {
  const token = getCookie(request, COOKIE_NAME);

  if (!token) {
    return null;
  }

  const tokenHash = await sha256(token);
  const database = await db();
  const now = Date.now();

  const session = await database
    .prepare(`
      SELECT
        s.user_id,
        s.expires_at,
        c.email,
        c.display_name
      FROM user_sessions s
      INNER JOIN user_credentials c
        ON c.user_id = s.user_id
      WHERE s.token_hash = ?
      LIMIT 1
    `)
    .bind(tokenHash)
    .first<SessionRecord>();

  if (!session) {
    return null;
  }

  if (session.expires_at <= now) {
    await database
      .prepare(`
        DELETE FROM user_sessions
        WHERE token_hash = ?
      `)
      .bind(tokenHash)
      .run();

    return null;
  }

  await database
    .prepare(`
      UPDATE user_sessions
      SET last_seen_at = ?
      WHERE token_hash = ?
    `)
    .bind(now, tokenHash)
    .run();

  return {
    id: session.user_id,
    email: session.email,
    name: session.display_name,
  };
}

export async function requireUserId(
  request: Request,
): Promise<string> {
  const user = await getSession(request);

  if (!user) {
    throw new Error("UNAUTHENTICATED");
  }

  return user.id;
}

export async function deleteCurrentSession(
  request: Request,
): Promise<void> {
  const token = getCookie(request, COOKIE_NAME);

  if (!token) {
    return;
  }

  const tokenHash = await sha256(token);
  const database = await db();

  await database
    .prepare(`
      DELETE FROM user_sessions
      WHERE token_hash = ?
    `)
    .bind(tokenHash)
    .run();
}
