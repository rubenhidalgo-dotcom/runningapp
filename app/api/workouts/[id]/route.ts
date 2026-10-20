import { requireUserId } from "@/lib/auth";
import { db, jsonError } from "@/lib/db";

type UpdateWorkoutBody = {
  completed?: boolean;
  actualDistanceKm?: number | string | null;
  actualDurationMin?: number | string | null;
  notes?: string | null;
};

type PlannedWorkout = {
  id: string;
  plan_id: string;
  workout_date: string;
  workout_type: string | null;
  title: string;
  duration_min: number | null;
};

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const uid = await requireUserId(request);
    const { id } = await context.params;
    const body = (await request.json()) as UpdateWorkoutBody;
    const database = await db();

    const workout = await database
      .prepare(`
        SELECT
          w.id,
          w.plan_id,
          w.workout_date,
          w.workout_type,
          w.title,
          w.duration_min
        FROM workouts w
        JOIN plans p ON p.id = w.plan_id
        WHERE w.id = ?
          AND p.user_id = ?
        LIMIT 1
      `)
      .bind(id, uid)
      .first<PlannedWorkout>();

    if (!workout) {
      return jsonError(new Error("Workout not found."), 404);
    }

    const existingLog = await database
      .prepare(`
        SELECT id
        FROM workout_logs
        WHERE user_id = ?
          AND planned_workout_id = ?
        ORDER BY completed_at DESC
        LIMIT 1
      `)
      .bind(uid, workout.id)
      .first<{ id: string }>();

    if (!body.completed) {
      if (existingLog) {
        await database
          .prepare(`
            DELETE FROM workout_logs
            WHERE id = ?
              AND user_id = ?
          `)
          .bind(existingLog.id, uid)
          .run();
      }

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
        .bind(Date.now(), workout.id)
        .run();

      return Response.json({ ok: true });
    }

    const isStrength =
      String(workout.workout_type || "").toLowerCase() === "strength";

    let distance: number | null = null;

    if (
      body.actualDistanceKm !== undefined &&
      body.actualDistanceKm !== null &&
      body.actualDistanceKm !== ""
    ) {
      distance = Number(body.actualDistanceKm);
    }

    if (
      !isStrength &&
      (distance === null || !Number.isFinite(distance) || distance < 0)
    ) {
      throw new Error("Enter a valid actual distance.");
    }

    const duration =
      body.actualDurationMin === undefined ||
      body.actualDurationMin === null ||
      body.actualDurationMin === ""
        ? workout.duration_min
        : Number(body.actualDurationMin);

    if (
      duration !== null &&
      (!Number.isFinite(duration) || duration < 0)
    ) {
      throw new Error("Enter a valid duration.");
    }

    const now = Date.now();
    const logId = existingLog?.id || crypto.randomUUID();

    if (existingLog) {
      await database
        .prepare(`
          UPDATE workout_logs
          SET
            workout_date = ?,
            workout_type = ?,
            title = ?,
            completion_status = 'completed',
            actual_distance_km = ?,
            actual_duration_min = ?,
            notes = ?,
            completed_at = ?,
            updated_at = ?
          WHERE id = ?
            AND user_id = ?
        `)
        .bind(
          workout.workout_date,
          isStrength ? "strength" : "run",
          workout.title,
          distance,
          duration,
          body.notes || null,
          now,
          now,
          logId,
          uid,
        )
        .run();
    } else {
      await database
        .prepare(`
          INSERT INTO workout_logs (
            id,
            user_id,
            planned_workout_id,
            original_plan_id,
            workout_date,
            workout_type,
            title,
            completion_status,
            actual_distance_km,
            actual_duration_min,
            notes,
            completed_at,
            source,
            created_at,
            updated_at
          )
          VALUES (
            ?, ?, ?, ?, ?, ?, ?, 'completed',
            ?, ?, ?, ?, 'plan', ?, ?
          )
        `)
        .bind(
          logId,
          uid,
          workout.id,
          workout.plan_id,
          workout.workout_date,
          isStrength ? "strength" : "run",
          workout.title,
          distance,
          duration,
          body.notes || null,
          now,
          now,
          now,
        )
        .run();
    }

    await database
      .prepare(`
        UPDATE workouts
        SET
          completed = 1,
          actual_distance_km = ?,
          workout_notes = ?,
          completed_at = ?,
          updated_at = ?
        WHERE id = ?
      `)
      .bind(distance, body.notes || null, now, now, workout.id)
      .run();

    return Response.json({ ok: true, logId });
  } catch (error) {
    return jsonError(error);
  }
}