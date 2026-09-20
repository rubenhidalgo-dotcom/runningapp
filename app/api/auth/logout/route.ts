import {
  clearSessionCookie,
  deleteCurrentSession,
} from "@/lib/auth";
import { jsonError } from "@/lib/db";

export async function POST(
  request: Request,
): Promise<Response> {
  try {
    await deleteCurrentSession(request);

    return Response.json(
      {
        ok: true,
      },
      {
        headers: {
          "Set-Cookie":
            clearSessionCookie(),
        },
      },
    );
  } catch (error) {
    return jsonError(error);
  }
}