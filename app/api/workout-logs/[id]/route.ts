import { requireUserId } from "@/lib/auth";
import { db, jsonError } from "@/lib/db";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const uid = await requireUserId(request);
    const { id } = await context.params;
    const database = await db();

    const log = await database
      .prepare(`
        SELECT id, planned_workout_id
        FROM workout_logs
        WHERE id = ?
          AND user_id = ?
        LIMIT 1
      `)
      .bind(id, uid)
      .first<{
        id: string;
        planned_workout_id: string | null;
      }>();

    if (!log) {
      return jsonError(new Error("Workout log not found."), 404);
    }

    await database
      .prepare(`
        DELETE FROM workout_logs
        WHERE id = ?
          AND user_id = ?
      `)
      .bind(id, uid)
      .run();

    if (log.planned_workout_id) {
      await database
        .prepare(`
          UPDATE workouts
          SET
            completed = 0,
            actual_distance_km = NULL,
            workout_notes = NULL,
            completed_at = NULL,
            updated_at = ?
          WHERE id = ?
        `)
        .bind(Date.now(), log.planned_workout_id)
        .run();
    }

    return Response.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}