import { requireUserId } from "@/lib/auth";
import { db, jsonError } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const uid = await requireUserId(request);
    const database = await db();

    const logs = await database
      .prepare(`
        SELECT *
        FROM workout_logs
        WHERE user_id = ?
        ORDER BY workout_date DESC, completed_at DESC
      `)
      .bind(uid)
      .all();

    return Response.json({ logs: logs.results });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const uid = await requireUserId(request);
    const body = (await request.json()) as {
      confirmation?: string;
    };

    if (body.confirmation !== "DELETE") {
      throw new Error('Type "DELETE" to erase workout history.');
    }

    const database = await db();

    const count = await database
      .prepare(`
        SELECT COUNT(*) AS total
        FROM workout_logs
        WHERE user_id = ?
      `)
      .bind(uid)
      .first<{ total: number }>();

    await database.batch([
      database
        .prepare(`
          DELETE FROM workout_logs
          WHERE user_id = ?
        `)
        .bind(uid),
      database
        .prepare(`
          UPDATE workouts
          SET
            completed = 0,
            actual_distance_km = NULL,
            workout_notes = NULL,
            completed_at = NULL,
            updated_at = ?
          WHERE plan_id IN (
            SELECT id
            FROM plans
            WHERE user_id = ?
          )
        `)
        .bind(Date.now(), uid),
    ]);

    return Response.json({
      ok: true,
      deleted: Number(count?.total || 0),
    });
  } catch (error) {
    return jsonError(error);
  }
}