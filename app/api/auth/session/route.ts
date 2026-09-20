import { getSession } from "@/lib/auth";
import { jsonError } from "@/lib/db";

export async function GET(
  request: Request,
): Promise<Response> {
  try {
    const user = await getSession(request);

    if (!user) {
      return Response.json(
        {
          authenticated: false,
          user: null,
        },
        {
          status: 401,
        },
      );
    }

    return Response.json({
      authenticated: true,
      user,
    });
  } catch (error) {
    return jsonError(error);
  }
}