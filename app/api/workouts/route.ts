import { requireUserId } from "@/lib/auth";
import { db, jsonError } from "@/lib/db";

type ManualWorkoutBody = {
  date?: string;
  title?: string;
  actualDistanceKm?: number | string;
  durationMin?: number | string | null;
  notes?: string | null;
};

type WorkoutResult = {
  workout_date: string;
};

export async function GET(request: Request) {
  try {
    const uid = await requireUserId(request);
    const database = await db();

    const activePlan = await database
      .prepare(`
        SELECT p.id
        FROM users u
        JOIN plans p
          ON p.id = u.active_plan_id
         AND p.user_id = u.id
        WHERE u.id = ?
      `)
      .bind(uid)
      .first<{ id: string }>();

    const plannedWorkouts = activePlan
      ? await database
          .prepare(`
            SELECT
              w.id,
              w.plan_id,
              w.workout_date,
              w.week_number,
              w.day_of_week,
              CASE
                WHEN lower(COALESCE(w.workout_type, '')) = 'strength'
                  THEN 'strength'
                ELSE COALESCE(w.workout_type, 'run')
              END AS workout_type,
              w.title,
              w.planned_distance_km,
              w.duration_min,
              w.description,
              w.pace_target,
              w.notes,
              CASE WHEN wl.id IS NULL THEN 0 ELSE 1 END AS completed,
              wl.id AS log_id,
              wl.actual_distance_km,
              wl.actual_duration_min,
              wl.notes AS workout_notes,
              wl.completed_at,
              'plan' AS source,
              COALESCE(
                (
                  SELECT json_group_array(
                    json_object(
                      'id', se.id,
                      'exercise_order', se.exercise_order,
                      'exercise_name', se.exercise_name,
                      'sets', se.sets,
                      'reps', se.reps,
                      'weight', se.weight,
                      'weight_unit', se.weight_unit,
                      'duration_seconds', se.duration_seconds,
                      'distance_meters', se.distance_meters,
                      'rest_seconds', se.rest_seconds,
                      'target_rir', se.target_rir,
                      'target_rpe', se.target_rpe,
                      'tempo', se.tempo,
                      'side', se.side,
                      'notes', se.notes
                    )
                  )
                  FROM strength_exercises se
                  WHERE se.workout_id = w.id
                  ORDER BY se.exercise_order
                ),
                '[]'
              ) AS strength_exercises
            FROM workouts w
            LEFT JOIN workout_logs wl
              ON wl.id = (
                SELECT wl2.id
                FROM workout_logs wl2
                WHERE wl2.user_id = ?
                  AND wl2.planned_workout_id = w.id
                  AND wl2.completion_status IN (
                    'completed',
                    'partial'
                  )
                ORDER BY wl2.completed_at DESC
                LIMIT 1
              )
            WHERE w.plan_id = ?
              AND w.source = 'plan'
            ORDER BY w.workout_date, w.created_at
          `)
          .bind(uid, activePlan.id)
          .all<WorkoutResult>()
      : { results: [] as WorkoutResult[] };

    const manualLogs = await database
      .prepare(`
        SELECT
          wl.id,
          NULL AS plan_id,
          wl.workout_date,
          NULL AS week_number,
          NULL AS day_of_week,
          wl.workout_type,
          wl.title,
          0 AS planned_distance_km,
          wl.actual_duration_min AS duration_min,
          NULL AS description,
          NULL AS pace_target,
          NULL AS notes,
          1 AS completed,
          wl.id AS log_id,
          wl.actual_distance_km,
          wl.actual_duration_min,
          wl.notes AS workout_notes,
          wl.completed_at,
          'manual' AS source,
          '[]' AS strength_exercises
        FROM workout_logs wl
        WHERE wl.user_id = ?
          AND wl.source = 'manual'
        ORDER BY wl.workout_date, wl.created_at
      `)
      .bind(uid)
      .all<WorkoutResult>();

    const workouts = [
      ...plannedWorkouts.results,
      ...manualLogs.results,
    ].sort((a, b) =>
      String(a.workout_date).localeCompare(
        String(b.workout_date),
      ),
    );

    return Response.json({
      activePlanId: activePlan?.id ?? null,
      workouts,
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const uid = await requireUserId(request);
    const body =
      (await request.json()) as ManualWorkoutBody;
    const database = await db();

    const date = String(body.date || "");
    const title = String(
      body.title || "Manual run",
    ).trim();
    const distance = Number(
      body.actualDistanceKm,
    );

    const duration =
      body.durationMin === null ||
      body.durationMin === undefined ||
      body.durationMin === ""
        ? null
        : Number(body.durationMin);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new Error(
        "Enter a valid workout date.",
      );
    }

    if (!title) {
      throw new Error(
        "Enter a workout title.",
      );
    }

    if (
      !Number.isFinite(distance) ||
      distance < 0
    ) {
      throw new Error(
        "Enter a valid actual distance.",
      );
    }

    if (
      duration !== null &&
      (
        !Number.isFinite(duration) ||
        duration < 0
      )
    ) {
      throw new Error(
        "Enter a valid duration.",
      );
    }

    const now = Date.now();
    const id = crypto.randomUUID();

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
          ?,
          ?,
          NULL,
          NULL,
          ?,
          'run',
          ?,
          'completed',
          ?,
          ?,
          ?,
          ?,
          'manual',
          ?,
          ?
        )
      `)
      .bind(
        id,
        uid,
        date,
        title,
        distance,
        duration,
        body.notes || null,
        now,
        now,
        now,
      )
      .run();

    return Response.json(
      {
        id,
        logId: id,
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    return jsonError(error);
  }
}