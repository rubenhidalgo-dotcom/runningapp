PRAGMA foreign_keys = ON;

-- Identify the user's currently selected plan.
-- Existing users initially receive their oldest plan as the active plan.
ALTER TABLE users ADD COLUMN active_plan_id TEXT;

UPDATE users
SET active_plan_id = (
  SELECT p.id
  FROM plans p
  WHERE p.user_id = users.id
  ORDER BY p.created_at ASC
  LIMIT 1
)
WHERE active_plan_id IS NULL;

-- Store when a plan was last updated.
ALTER TABLE plans ADD COLUMN updated_at INTEGER;

UPDATE plans
SET updated_at = created_at
WHERE updated_at IS NULL;

-- Workout logs are independent from plans.
-- planned_workout_id and original_plan_id are historical references only.
-- They intentionally do not use foreign keys, so deleting a plan or planned
-- workout cannot delete the user's completed workout history.
CREATE TABLE IF NOT EXISTS workout_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  planned_workout_id TEXT,
  original_plan_id TEXT,
  workout_date TEXT NOT NULL,
  workout_type TEXT NOT NULL DEFAULT 'run',
  title TEXT NOT NULL,
  completion_status TEXT NOT NULL DEFAULT 'completed'
    CHECK (completion_status IN ('completed', 'partial', 'skipped')),
  actual_distance_km REAL,
  actual_duration_min INTEGER,
  session_rpe INTEGER
    CHECK (session_rpe IS NULL OR (session_rpe >= 1 AND session_rpe <= 10)),
  notes TEXT,
  completed_at INTEGER NOT NULL,
  source TEXT NOT NULL DEFAULT 'plan'
    CHECK (source IN ('plan', 'manual')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_workout_logs_user_date
  ON workout_logs(user_id, workout_date);

CREATE INDEX IF NOT EXISTS idx_workout_logs_planned_workout
  ON workout_logs(planned_workout_id);

-- Copy existing completed workouts into independent workout logs.
-- INSERT OR IGNORE makes the migration safe against duplicate IDs.
INSERT OR IGNORE INTO workout_logs (
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
SELECT
  'migrated-' || w.id,
  p.user_id,
  CASE
    WHEN w.source = 'manual' THEN NULL
    ELSE w.id
  END,
  w.plan_id,
  w.workout_date,
  CASE
    WHEN lower(COALESCE(w.workout_type, '')) = 'strength'
      THEN 'strength'
    ELSE 'run'
  END,
  w.title,
  'completed',
  w.actual_distance_km,
  w.duration_min,
  w.workout_notes,
  COALESCE(w.completed_at, w.updated_at, w.created_at),
  CASE
    WHEN w.source = 'manual' THEN 'manual'
    ELSE 'plan'
  END,
  w.created_at,
  w.updated_at
FROM workouts w
JOIN plans p ON p.id = w.plan_id
WHERE w.completed = 1;

-- Planned strength exercises.
-- A strength workout can contain multiple exercise rows.
CREATE TABLE IF NOT EXISTS strength_exercises (
  id TEXT PRIMARY KEY,
  workout_id TEXT NOT NULL,
  exercise_order INTEGER NOT NULL DEFAULT 1,
  exercise_name TEXT NOT NULL,
  sets INTEGER NOT NULL DEFAULT 1 CHECK (sets > 0),
  reps TEXT,
  weight REAL,
  weight_unit TEXT
    CHECK (
      weight_unit IS NULL
      OR weight_unit IN ('kg', 'lb', 'bodyweight')
    ),
  duration_seconds INTEGER,
  distance_meters REAL,
  rest_seconds INTEGER,
  target_rir INTEGER,
  target_rpe INTEGER
    CHECK (
      target_rpe IS NULL
      OR (target_rpe >= 1 AND target_rpe <= 10)
    ),
  tempo TEXT,
  side TEXT
    CHECK (
      side IS NULL
      OR side IN ('both', 'left', 'right', 'alternating')
    ),
  notes TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (workout_id) REFERENCES workouts(id) ON DELETE CASCADE,
  UNIQUE(workout_id, exercise_order)
);

CREATE INDEX IF NOT EXISTS idx_strength_exercises_workout
  ON strength_exercises(workout_id, exercise_order);

-- Actual strength sets belong to an independent workout log.
-- Deleting a single log deletes its recorded sets.
-- Deleting a plan does not affect these rows because the log survives.
CREATE TABLE IF NOT EXISTS strength_set_logs (
  id TEXT PRIMARY KEY,
  workout_log_id TEXT NOT NULL,
  planned_exercise_id TEXT,
  exercise_name TEXT NOT NULL,
  exercise_order INTEGER NOT NULL DEFAULT 1,
  set_number INTEGER NOT NULL CHECK (set_number > 0),
  actual_reps REAL,
  actual_weight REAL,
  weight_unit TEXT
    CHECK (
      weight_unit IS NULL
      OR weight_unit IN ('kg', 'lb', 'bodyweight')
    ),
  actual_duration_seconds INTEGER,
  actual_distance_meters REAL,
  actual_rir INTEGER,
  actual_rpe INTEGER
    CHECK (
      actual_rpe IS NULL
      OR (actual_rpe >= 1 AND actual_rpe <= 10)
    ),
  completed INTEGER NOT NULL DEFAULT 1
    CHECK (completed IN (0, 1)),
  notes TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (workout_log_id)
    REFERENCES workout_logs(id)
    ON DELETE CASCADE,
  UNIQUE(workout_log_id, exercise_order, set_number)
);

CREATE INDEX IF NOT EXISTS idx_strength_set_logs_workout_log
  ON strength_set_logs(workout_log_id, exercise_order, set_number);
