import {
  createSession,
  createSessionCookie,
  hashPassword,
  normalizeEmail,
  validatePassword,
} from "@/lib/auth";
import { db, jsonError } from "@/lib/db";

type RegisterBody = {
  name?: string;
  email?: string;
  password?: string;
  guestUserId?: string | null;
};

export async function POST(
  request: Request,
): Promise<Response> {
  try {
    const body =
      (await request.json()) as RegisterBody;

    const name = body.name?.trim() ?? "";
    const email = normalizeEmail(
      body.email ?? "",
    );

    const password = body.password ?? "";
    const guestUserId =
      body.guestUserId?.trim() || null;

    if (name.length < 2 || name.length > 80) {
      throw new Error(
        "Name must contain between 2 and 80 characters.",
      );
    }

    if (
      !email ||
      !email.includes("@") ||
      email.length > 254
    ) {
      throw new Error(
        "Enter a valid email address.",
      );
    }

    validatePassword(password);

    if (
      guestUserId &&
      !/^[a-zA-Z0-9-]{8,80}$/.test(guestUserId)
    ) {
      throw new Error(
        "Existing guest account identifier is invalid.",
      );
    }

    const database = await db();

    const existing = await database
      .prepare(`
        SELECT user_id
        FROM user_credentials
        WHERE email = ?
        LIMIT 1
      `)
      .bind(email)
      .first();

    if (existing) {
      return jsonError(
        new Error(
          "An account already exists for this email.",
        ),
        409,
      );
    }

    const userId = crypto.randomUUID();
    const now = Date.now();

    const passwordData =
      await hashPassword(password);

    await database.batch([
      database
        .prepare(`
          INSERT INTO users (
            id,
            created_at
          )
          VALUES (?, ?)
        `)
        .bind(userId, now),

      database
        .prepare(`
          INSERT INTO user_credentials (
            user_id,
            email,
            display_name,
            password_hash,
            password_salt,
            password_iterations,
            created_at,
            updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(
          userId,
          email,
          name,
          passwordData.hash,
          passwordData.salt,
          passwordData.iterations,
          now,
          now,
        ),
    ]);

    /*
     * Transfer plans belonging to the current
     * browser's anonymous account.
     *
     * Workouts belong to plans, so they transfer
     * automatically when the plan's user_id changes.
     */
    if (guestUserId && guestUserId !== userId) {
      await database
        .prepare(`
          UPDATE plans
          SET user_id = ?
          WHERE user_id = ?
        `)
        .bind(userId, guestUserId)
        .run();
    }

    const token = await createSession(
      database,
      userId,
    );

    return Response.json(
      {
        user: {
          id: userId,
          email,
          name,
        },
      },
      {
        status: 201,
        headers: {
          "Set-Cookie":
            createSessionCookie(token),
        },
      },
    );
  } catch (error) {
    return jsonError(error);
  }
}