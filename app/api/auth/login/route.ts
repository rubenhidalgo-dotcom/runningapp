import {
  createSession,
  createSessionCookie,
  normalizeEmail,
  verifyPassword,
} from "@/lib/auth";
import { db, jsonError } from "@/lib/db";

type LoginBody = {
  email?: string;
  password?: string;
};

type CredentialRecord = {
  user_id: string;
  email: string;
  display_name: string;
  password_hash: string;
  password_salt: string;
  password_iterations: number;
};

export async function POST(
  request: Request,
): Promise<Response> {
  try {
    const body =
      (await request.json()) as LoginBody;

    const email = normalizeEmail(
      body.email ?? "",
    );

    const password = body.password ?? "";

    if (!email || !password) {
      throw new Error(
        "Enter your email and password.",
      );
    }

    const database = await db();

    const credential = await database
      .prepare(`
        SELECT
          user_id,
          email,
          display_name,
          password_hash,
          password_salt,
          password_iterations
        FROM user_credentials
        WHERE email = ?
        LIMIT 1
      `)
      .bind(email)
      .first<CredentialRecord>();

    if (!credential) {
      return jsonError(
        new Error(
          "Email or password is incorrect.",
        ),
        401,
      );
    }

    const passwordMatches =
      await verifyPassword(
        password,
        credential.password_hash,
        credential.password_salt,
        credential.password_iterations,
      );

    if (!passwordMatches) {
      return jsonError(
        new Error(
          "Email or password is incorrect.",
        ),
        401,
      );
    }

    const token = await createSession(
      database,
      credential.user_id,
    );

    return Response.json(
      {
        user: {
          id: credential.user_id,
          email: credential.email,
          name: credential.display_name,
        },
      },
      {
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