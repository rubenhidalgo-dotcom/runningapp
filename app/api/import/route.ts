import { requireUserId } from "@/lib/auth";
import { parseCsv } from "@/lib/csv";
import { db, jsonError } from "@/lib/db";

type ImportMode =
  | "new-active"
  | "new-inactive"
  | "replace";

type ValidatedRow = {
  rowNumber: number;
  date: string;
  weekNumber: number | null;
  dayOfWeek: string | null;
  workoutType: "run" | "strength";
  workoutKey: string;
  title: string;
  plannedDistanceKm: number;
  durationMin: number | null;
  description: string | null;
  paceTarget: string | null;
  notes: string | null;
  exerciseOrder: number | null;
  exerciseName: string | null;
  sets: number | null;
  reps: string | null;
  weight: number | null;
  weightUnit: "kg" | "lb" | "bodyweight" | null;
  durationSeconds: number | null;
  distanceMeters: number | null;
  restSeconds: number | null;
  targetRir: number | null;
  targetRpe: number | null;
  tempo: string | null;
  side: "both" | "left" | "right" | "alternating" | null;
  exerciseNotes: string | null;
};

type WorkoutGroup = {
  key: string;
  first: ValidatedRow;
  exercises: ValidatedRow[];
};

function optionalNumber(
  value: string | undefined,
  label: string,
  rowNumber: number,
  options: {
    integer?: boolean;
    minimum?: number;
    maximum?: number;
  } = {},
): number | null {
  if (value === undefined || value.trim() === "") {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw new Error(`Row ${rowNumber}: ${label} must be numeric.`);
  }

  if (options.integer && !Number.isInteger(parsed)) {
    throw new Error(`Row ${rowNumber}: ${label} must be a whole number.`);
  }

  if (
    options.minimum !== undefined &&
    parsed < options.minimum
  ) {
    throw new Error(
      `Row ${rowNumber}: ${label} must be at least ${options.minimum}.`,
    );
  }

  if (
    options.maximum !== undefined &&
    parsed > options.maximum
  ) {
    throw new Error(
      `Row ${rowNumber}: ${label} must not exceed ${options.maximum}.`,
    );
  }

  return parsed;
}

function normalizeWorkoutType(
  value: string | undefined,
  rowNumber: number,
): "run" | "strength" {
  const normalized = String(value || "run")
    .trim()
    .toLowerCase();

  if (
    normalized === "run" ||
    normalized === "running"
  ) {
    return "run";
  }

  if (
    normalized === "strength" ||
    normalized === "strength_training"
  ) {
    return "strength";
  }

  throw new Error(
    `Row ${rowNumber}: workout_type must be run or strength.`,
  );
}

function validateRow(
  row: Record<string, string>,
  index: number,
): ValidatedRow {
  const rowNumber = index + 2;
  const date = String(
    row.date || row.workout_date || "",
  ).trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(
      `Row ${rowNumber}: date must use YYYY-MM-DD.`,
    );
  }

  const workoutType = normalizeWorkoutType(
    row.workout_type,
    rowNumber,
  );

  const title = String(
    row.title ||
      (workoutType === "strength"
        ? "Strength workout"
        : "Run"),
  ).trim();

  if (!title) {
    throw new Error(`Row ${rowNumber}: title is required.`);
  }

  const workoutKey = String(
    row.workout_id ||
      `${date}|${workoutType}|${title}`,
  ).trim();

  const distance =
    optionalNumber(
      row.distance_km || row.planned_distance_km,
      "distance_km",
      rowNumber,
      { minimum: 0 },
    ) ?? 0;

  const durationMin = optionalNumber(
    row.duration_min || row.planned_duration_min,
    "duration_min",
    rowNumber,
    { integer: true, minimum: 0 },
  );

  const exerciseName = String(
    row.exercise_name || "",
  ).trim();

  const exerciseOrder = optionalNumber(
    row.exercise_order,
    "exercise_order",
    rowNumber,
    { integer: true, minimum: 1 },
  );

  const sets = optionalNumber(
    row.sets,
    "sets",
    rowNumber,
    { integer: true, minimum: 1 },
  );

  if (workoutType === "strength") {
    if (!exerciseName) {
      throw new Error(
        `Row ${rowNumber}: exercise_name is required for strength workouts.`,
      );
    }

    if (exerciseOrder === null) {
      throw new Error(
        `Row ${rowNumber}: exercise_order is required for strength workouts.`,
      );
    }

    if (sets === null) {
      throw new Error(
        `Row ${rowNumber}: sets is required for strength workouts.`,
      );
    }

    const hasTarget =
      Boolean(String(row.reps || "").trim()) ||
      Boolean(String(row.duration_seconds || "").trim()) ||
      Boolean(String(row.distance_meters || "").trim());

    if (!hasTarget) {
      throw new Error(
        `Row ${rowNumber}: strength exercises require reps, duration_seconds, or distance_meters.`,
      );
    }
  }

  const weightUnitValue = String(
    row.weight_unit || "",
  )
    .trim()
    .toLowerCase();

  const weightUnit =
    weightUnitValue === ""
      ? null
      : weightUnitValue === "kg" ||
          weightUnitValue === "lb" ||
          weightUnitValue === "bodyweight"
        ? weightUnitValue
        : null;

  if (weightUnitValue && !weightUnit) {
    throw new Error(
      `Row ${rowNumber}: weight_unit must be kg, lb, or bodyweight.`,
    );
  }

  const sideValue = String(row.side || "")
    .trim()
    .toLowerCase();

  const side =
    sideValue === ""
      ? null
      : sideValue === "both" ||
          sideValue === "left" ||
          sideValue === "right" ||
          sideValue === "alternating"
        ? sideValue
        : null;

  if (sideValue && !side) {
    throw new Error(
      `Row ${rowNumber}: side must be both, left, right, or alternating.`,
    );
  }

  return {
    rowNumber,
    date,
    weekNumber: optionalNumber(
      row.week_number,
      "week_number",
      rowNumber,
      { integer: true, minimum: 0 },
    ),
    dayOfWeek: row.day_of_week?.trim() || null,
    workoutType,
    workoutKey,
    title,
    plannedDistanceKm: distance,
    durationMin,
    description: row.description?.trim() || null,
    paceTarget: row.pace_target?.trim() || null,
    notes: row.notes?.trim() || null,
    exerciseOrder,
    exerciseName: exerciseName || null,
    sets,
    reps: row.reps?.trim() || null,
    weight: optionalNumber(
      row.weight,
      "weight",
      rowNumber,
      { minimum: 0 },
    ),
    weightUnit,
    durationSeconds: optionalNumber(
      row.duration_seconds,
      "duration_seconds",
      rowNumber,
      { integer: true, minimum: 0 },
    ),
    distanceMeters: optionalNumber(
      row.distance_meters,
      "distance_meters",
      rowNumber,
      { minimum: 0 },
    ),
    restSeconds: optionalNumber(
      row.rest_seconds,
      "rest_seconds",
      rowNumber,
      { integer: true, minimum: 0 },
    ),
    targetRir: optionalNumber(
      row.rir || row.target_rir,
      "rir",
      rowNumber,
      { integer: true, minimum: 0 },
    ),
    targetRpe: optionalNumber(
      row.rpe || row.target_rpe,
      "rpe",
      rowNumber,
      { minimum: 1, maximum: 10 },
    ),
    tempo: row.tempo?.trim() || null,
    side,
    exerciseNotes:
      row.exercise_notes?.trim() || null,
  };
}

export async function POST(request: Request) {
  try {
    const uid = await requireUserId(request);
    const form = await request.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      throw new Error("Choose a CSV file.");
    }

    const planName = String(
      form.get("planName") || "My Training Plan",
    ).trim();

    if (!planName) {
      throw new Error("Enter a plan name.");
    }

    const mode = String(
      form.get("mode") || "new-active",
    ) as ImportMode;

    if (
      mode !== "new-active" &&
      mode !== "new-inactive" &&
      mode !== "replace"
    ) {
      throw new Error("Choose a valid import option.");
    }

    const replacePlanId = String(
      form.get("replacePlanId") || "",
    );

    if (mode === "replace" && !replacePlanId) {
      throw new Error("Choose the plan to replace.");
    }

    const csvRows = parseCsv(await file.text());

    if (!csvRows.length) {
      throw new Error("CSV has no data rows.");
    }

    /*
     * Validate every row before making database changes.
     */
    const validatedRows = csvRows.map(validateRow);
    const groups = new Map<string, WorkoutGroup>();

    for (const row of validatedRows) {
      const existing = groups.get(row.workoutKey);

      if (existing) {
        if (
          existing.first.date !== row.date ||
          existing.first.title !== row.title ||
          existing.first.workoutType !== row.workoutType
        ) {
          throw new Error(
            `Row ${row.rowNumber}: workout_id ${row.workoutKey} has inconsistent workout details.`,
          );
        }

        existing.exercises.push(row);
      } else {
        groups.set(row.workoutKey, {
          key: row.workoutKey,
          first: row,
          exercises: [row],
        });
      }
    }

    for (const group of groups.values()) {
      if (group.first.workoutType !== "strength") {
        continue;
      }

      const orders = group.exercises.map(
        (row) => row.exerciseOrder,
      );

      if (new Set(orders).size !== orders.length) {
        throw new Error(
          `Strength workout "${group.first.title}" contains duplicate exercise_order values.`,
        );
      }
    }

    const database = await db();
    const now = Date.now();
    let planId = crypto.randomUUID();

    if (mode === "replace") {
      const ownedPlan = await database
        .prepare(`
          SELECT id
          FROM plans
          WHERE id = ?
            AND user_id = ?
          LIMIT 1
        `)
        .bind(replacePlanId, uid)
        .first<{ id: string }>();

      if (!ownedPlan) {
        return jsonError(
          new Error("Plan to replace was not found."),
          404,
        );
      }

      planId = ownedPlan.id;

      await database
        .prepare(`
          UPDATE plans
          SET name = ?, updated_at = ?
          WHERE id = ?
            AND user_id = ?
        `)
        .bind(planName, now, planId, uid)
        .run();

      /*
       * Cascading deletion removes only scheduled workouts and
       * planned exercises. Independent workout logs survive.
       */
      await database
        .prepare(`
          DELETE FROM workouts
          WHERE plan_id = ?
        `)
        .bind(planId)
        .run();
    } else {
      await database
        .prepare(`
          INSERT INTO plans (
            id,
            user_id,
            name,
            created_at,
            updated_at
          )
          VALUES (?, ?, ?, ?, ?)
        `)
        .bind(planId, uid, planName, now, now)
        .run();
    }

    let workoutCount = 0;
    let strengthExerciseCount = 0;

    for (const group of groups.values()) {
      const workoutId = crypto.randomUUID();
      const row = group.first;

      await database
        .prepare(`
          INSERT INTO workouts (
            id,
            plan_id,
            workout_date,
            week_number,
            day_of_week,
            workout_type,
            title,
            planned_distance_km,
            duration_min,
            description,
            pace_target,
            notes,
            source,
            created_at,
            updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'plan', ?, ?)
        `)
        .bind(
          workoutId,
          planId,
          row.date,
          row.weekNumber,
          row.dayOfWeek,
          row.workoutType,
          row.title,
          row.plannedDistanceKm,
          row.durationMin,
          row.description,
          row.paceTarget,
          row.notes,
          now,
          now,
        )
        .run();

      workoutCount += 1;

      if (row.workoutType === "strength") {
        for (const exercise of group.exercises) {
          await database
            .prepare(`
              INSERT INTO strength_exercises (
                id,
                workout_id,
                exercise_order,
                exercise_name,
                sets,
                reps,
                weight,
                weight_unit,
                duration_seconds,
                distance_meters,
                rest_seconds,
                target_rir,
                target_rpe,
                tempo,
                side,
                notes,
                created_at,
                updated_at
              )
              VALUES (
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?, ?, ?
              )
            `)
            .bind(
              crypto.randomUUID(),
              workoutId,
              exercise.exerciseOrder,
              exercise.exerciseName,
              exercise.sets,
              exercise.reps,
              exercise.weight,
              exercise.weightUnit,
              exercise.durationSeconds,
              exercise.distanceMeters,
              exercise.restSeconds,
              exercise.targetRir,
              exercise.targetRpe,
              exercise.tempo,
              exercise.side,
              exercise.exerciseNotes,
              now,
              now,
            )
            .run();

          strengthExerciseCount += 1;
        }
      }
    }

    if (
      mode === "new-active" ||
      mode === "replace"
    ) {
      await database
        .prepare(`
          UPDATE users
          SET active_plan_id = ?
          WHERE id = ?
        `)
        .bind(planId, uid)
        .run();
    }

    return Response.json({
      imported: workoutCount,
      strengthExercises: strengthExerciseCount,
      planId,
      active:
        mode === "new-active" ||
        mode === "replace",
    });
  } catch (error) {
    return jsonError(error);
  }
}