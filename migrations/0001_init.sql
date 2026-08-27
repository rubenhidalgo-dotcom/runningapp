PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS plans (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS workouts (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL,
  workout_date TEXT NOT NULL,
  week_number INTEGER,
  day_of_week TEXT,
  workout_type TEXT,
  title TEXT NOT NULL,
  planned_distance_km REAL NOT NULL DEFAULT 0,
  duration_min INTEGER,
  description TEXT,
  pace_target TEXT,
  notes TEXT,
  completed INTEGER NOT NULL DEFAULT 0,
  actual_distance_km REAL,
  workout_notes TEXT,
  completed_at INTEGER,
  source TEXT NOT NULL DEFAULT 'plan',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE,
  UNIQUE(plan_id, workout_date, title)
);
CREATE INDEX IF NOT EXISTS idx_plans_user ON plans(user_id);
CREATE INDEX IF NOT EXISTS idx_workouts_plan_date ON workouts(plan_id, workout_date);
