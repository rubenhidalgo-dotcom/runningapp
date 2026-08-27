import { db, jsonError, userId } from "@/lib/db";

type UpdateWorkoutBody = {
  completed?: boolean;
  actualDistanceKm?: number | string | null;
  notes?: string | null;
};

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const uid = userId(request);
    const { id } = await context.params;
    const body = (await request.json()) as UpdateWorkoutBody;
    const database = await db();

    const completed = Boolean(body.completed);
    let actualDistanceKm: number | null = null;

    if (completed) {
      const parsedDistance = Number(body.actualDistanceKm);

      if (!Number.isFinite(parsedDistance) || parsedDistance < 0) {
        throw new Error("Enter a valid actual distance");
      }

      actualDistanceKm = parsedDistance;
    }

    const result = await database
      .prepare(`
        UPDATE workouts
        SET
          completed = ?,
          actual_distance_km = ?,
          workout_notes = ?,
          completed_at = ?,
          updated_at = ?
        WHERE id = ?
          AND plan_id IN (
            SELECT id
            FROM plans
            WHERE user_id = ?
          )
      `)
      .bind(
        completed ? 1 : 0,
        actualDistanceKm,
        completed ? body.notes || null : null,
        completed ? Date.now() : null,
        Date.now(),
        id,
        uid,
      )
      .run();

    if (!result.meta.changes) {
      return jsonError(new Error("Workout not found"), 404);
    }

    return Response.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
