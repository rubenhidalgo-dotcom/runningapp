"use client";

import {
  CalendarDays,
  CalendarRange,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Download,
  Dumbbell,
  Plus,
  Settings,
  Sun,
  Trash2,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

type Tab = "today" | "week" | "plan" | "settings";

type ApiFunction = <T>(
  path: string,
  options?: RequestInit,
) => Promise<T>;

type StrengthExercise = {
  id: string;
  exercise_order: number;
  exercise_name: string;
  sets: number | null;
  reps: string | null;
  weight: number | null;
  weight_unit: string | null;
  duration_seconds: number | null;
  distance_meters: number | null;
  rest_seconds: number | null;
  target_rir: number | null;
  target_rpe: number | null;
  tempo: string | null;
  side: string | null;
  notes: string | null;
};

type Workout = {
  id: string;
  plan_id: string | null;
  workout_date: string;
  week_number: number | null;
  day_of_week: string | null;
  workout_type: string | null;
  title: string;
  planned_distance_km: number;
  duration_min: number | null;
  actual_duration_min: number | null;
  description: string | null;
  pace_target: string | null;
  notes: string | null;
  completed: number;
  log_id: string | null;
  actual_distance_km: number | null;
  workout_notes: string | null;
  completed_at: number | null;
  source: string;
  strength_exercises: StrengthExercise[];
};

type RawWorkout = Omit<Workout, "strength_exercises"> & {
  strength_exercises: StrengthExercise[] | string | null;
};

type Plan = {
  id: string;
  name: string;
  created_at: number;
  updated_at: number | null;
  active: number;
  workout_count: number;
  strength_workout_count: number;
};

type WorkoutsResponse = {
  activePlanId: string | null;
  workouts: RawWorkout[];
};

type PlansResponse = {
  plans: Plan[];
};

type ImportResponse = {
  imported: number;
  strengthExercises: number;
  planId: string;
  active: boolean;
};

type DeleteHistoryResponse = {
  ok: boolean;
  deleted: number;
};

type ModalState =
  | { kind: "complete"; workout: Workout }
  | { kind: "manual" }
  | null;

const dateToIso = (date: Date) => {
  const localDate = new Date(
    date.getTime() - date.getTimezoneOffset() * 60000,
  );

  return localDate.toISOString().slice(0, 10);
};

const APP_TODAY = dateToIso(new Date());

const APP_YESTERDAY = (() => {
  const date = new Date(`${APP_TODAY}T12:00:00`);
  date.setDate(date.getDate() - 1);
  return dateToIso(date);
})();

const CSV_HEADERS = [
  "date",
  "week_number",
  "day_of_week",
  "workout_type",
  "workout_id",
  "title",
  "distance_km",
  "duration_min",
  "description",
  "pace_target",
  "notes",
  "exercise_order",
  "exercise_name",
  "sets",
  "reps",
  "weight",
  "weight_unit",
  "duration_seconds",
  "distance_meters",
  "rest_seconds",
  "rir",
  "rpe",
  "tempo",
  "side",
  "exercise_notes",
];

const CSV_EXAMPLE_ROWS = [
  [
    "2026-11-02",
    "1",
    "Monday",
    "run",
    "W1-R1",
    "Easy Run",
    "8",
    "50",
    "Conversational aerobic run",
    "5:50-6:10/km",
    "Keep the effort relaxed",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
  ],
  [
    "2026-11-03",
    "1",
    "Tuesday",
    "strength",
    "W1-S1",
    "Lower Body Strength",
    "0",
    "50",
    "Running-specific strength",
    "",
    "Use controlled repetitions",
    "1",
    "Back Squat",
    "4",
    "6",
    "70",
    "kg",
    "",
    "",
    "120",
    "2",
    "7",
    "3-1-1",
    "both",
    "Keep the torso stable",
  ],
  [
    "2026-11-03",
    "1",
    "Tuesday",
    "strength",
    "W1-S1",
    "Lower Body Strength",
    "0",
    "50",
    "Running-specific strength",
    "",
    "Use controlled repetitions",
    "2",
    "Reverse Lunge",
    "3",
    "8",
    "12",
    "kg",
    "",
    "",
    "90",
    "2",
    "7",
    "",
    "alternating",
    "Eight repetitions per leg",
  ],
  [
    "2026-11-03",
    "1",
    "Tuesday",
    "strength",
    "W1-S1",
    "Lower Body Strength",
    "0",
    "50",
    "Running-specific strength",
    "",
    "Use controlled repetitions",
    "3",
    "Plank",
    "3",
    "",
    "",
    "bodyweight",
    "45",
    "",
    "60",
    "",
    "7",
    "",
    "both",
    "Hold each set for 45 seconds",
  ],
];

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(`${date}T12:00:00`));
}

function formatKm(value: number) {
  return `${value.toFixed(1)} km`;
}

function escapeCsvValue(value: string) {
  if (
    value.includes(",") ||
    value.includes('"') ||
    value.includes("\n")
  ) {
    return `"${value.replaceAll('"', '""')}"`;
  }

  return value;
}

function downloadCsvTemplate() {
  const csv = [CSV_HEADERS, ...CSV_EXAMPLE_ROWS]
    .map((row) => row.map(escapeCsvValue).join(","))
    .join("\r\n");

  const blob = new Blob([`\uFEFF${csv}`], {
    type: "text/csv;charset=utf-8",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "run-training-plan-template.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();

  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}

function parseStrengthExercises(
  value: RawWorkout["strength_exercises"],
): StrengthExercise[] {
  if (Array.isArray(value)) {
    return value;
  }

  if (!value) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(value);

    return Array.isArray(parsed)
      ? (parsed as StrengthExercise[])
      : [];
  } catch {
    return [];
  }
}

function normalizeWorkout(workout: RawWorkout): Workout {
  return {
    ...workout,
    strength_exercises: parseStrengthExercises(
      workout.strength_exercises,
    ),
  };
}

function isStrengthWorkout(workout: Workout) {
  return (
    String(workout.workout_type || "").toLowerCase() ===
    "strength"
  );
}

function getExerciseTarget(exercise: StrengthExercise) {
  const parts: string[] = [];

  if (exercise.sets) {
    parts.push(
      `${exercise.sets} ${
        exercise.sets === 1 ? "set" : "sets"
      }`,
    );
  }

  if (exercise.reps) {
    parts.push(`${exercise.reps} reps`);
  }

  if (
    exercise.weight !== null &&
    exercise.weight !== undefined
  ) {
    parts.push(
      `${exercise.weight} ${exercise.weight_unit || ""}`.trim(),
    );
  } else if (exercise.weight_unit === "bodyweight") {
    parts.push("bodyweight");
  }

  if (exercise.duration_seconds) {
    parts.push(`${exercise.duration_seconds} sec`);
  }

  if (exercise.distance_meters) {
    parts.push(`${exercise.distance_meters} m`);
  }

  return parts.join(" · ");
}

function getWeekBounds(offset: number) {
  const today = new Date(`${APP_TODAY}T12:00:00`);
  const monday = new Date(today);

  monday.setDate(
    today.getDate() -
      ((today.getDay() + 6) % 7) +
      offset * 7,
  );

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  return { monday, sunday };
}

export default function RunApp({
  initialTab = "today",
}: {
  initialTab?: Tab;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [activePlanId, setActivePlanId] =
    useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<ModalState>(null);
  const [error, setError] = useState("");

  const api = useCallback(
    async <T,>(
      path: string,
      options: RequestInit = {},
    ): Promise<T> => {
      const response = await fetch(path, {
        ...options,
        credentials: "include",
        headers: {
          ...options.headers,
        },
      });

      const data = (await response.json()) as T & {
        error?: string;
      };

      if (response.status === 401) {
        window.location.replace("/login");
        throw new Error("Your session has expired.");
      }

      if (!response.ok) {
        throw new Error(data.error || "Request failed.");
      }

      return data;
    },
    [],
  ) as ApiFunction;

  const refresh = useCallback(async () => {
    const data = await api<WorkoutsResponse>("/api/workouts");

    setActivePlanId(data.activePlanId);
    setWorkouts(data.workouts.map(normalizeWorkout));
  }, [api]);

  useEffect(() => {
    async function loadApp() {
      try {
        await refresh();
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Could not load the app.",
        );
      } finally {
        setLoading(false);
      }
    }

    void loadApp();
  }, [refresh]);

  function navigate(nextTab: Tab) {
    setTab(nextTab);

    window.history.replaceState(
      null,
      "",
      nextTab === "today" ? "/" : `/${nextTab}`,
    );
  }

  if (loading) {
    return (
      <main className="app">
        <div className="loading">Loading RUN…</div>
      </main>
    );
  }

  return (
    <main className="app">
      <header className="top">
        <div className="brand">RUN</div>
        <div className="avatar">R</div>
      </header>

      {error && <div className="error">{error}</div>}

      {tab === "today" && (
        <Today
          workouts={workouts}
          onComplete={(workout) =>
            setModal({ kind: "complete", workout })
          }
        />
      )}

      {tab === "week" && (
        <Week
          workouts={workouts}
          onComplete={(workout) =>
            setModal({ kind: "complete", workout })
          }
        />
      )}

      {tab === "plan" && (
        <PlanView
          workouts={workouts}
          activePlanId={activePlanId}
          onComplete={(workout) =>
            setModal({ kind: "complete", workout })
          }
        />
      )}

      {tab === "settings" && (
        <SettingsPage api={api} onDone={refresh} />
      )}

      {tab === "today" && (
        <button
          className="fab"
          type="button"
          aria-label="Log an unscheduled run"
          onClick={() => setModal({ kind: "manual" })}
        >
          <Plus />
        </button>
      )}

      <Nav tab={tab} onChange={navigate} />

      {modal && (
        <WorkoutModal
          modal={modal}
          api={api}
          close={() => setModal(null)}
          done={async () => {
            setModal(null);
            await refresh();
          }}
        />
      )}
    </main>
  );
}

function WorkoutCard({
  workout,
  onComplete,
  showDate = false,
  showDetails = true,
}: {
  workout: Workout;
  onComplete: (workout: Workout) => void;
  showDate?: boolean;
  showDetails?: boolean;
}) {
  const strength = isStrengthWorkout(workout);

  const distanceLabel =
    workout.source === "manual"
      ? `Actual ${formatKm(
          Number(workout.actual_distance_km || 0),
        )}`
      : `Planned ${formatKm(
          Number(workout.planned_distance_km || 0),
        )}`;

  return (
    <article className="card">
      <div className="workout-row">
        <button
          className={`check ${workout.completed ? "done" : ""}`}
          type="button"
          onClick={() => onComplete(workout)}
          aria-label={
            workout.completed
              ? "Edit completed workout"
              : "Complete workout"
          }
        >
          {workout.completed ? <Check size={16} /> : null}
        </button>

        <div className="grow">
          <div className="title">{workout.title}</div>

          {showDate && (
            <div className="muted">
              {formatDate(workout.workout_date)}
            </div>
          )}

          <div className="meta">
            {strength ? (
              <span className="pill">
                <Dumbbell size={13} />
                Strength
              </span>
            ) : (
              <>
                {workout.workout_type && (
                  <span className="pill">
                    {workout.workout_type}
                  </span>
                )}

                <span className="pill">{distanceLabel}</span>
              </>
            )}

            {workout.duration_min !== null && (
              <span className="pill">
                {workout.duration_min} min
              </span>
            )}

            {Boolean(workout.completed) &&
              !strength &&
              workout.source !== "manual" && (
                <span className="pill">
                  Actual{" "}
                  {formatKm(
                    Number(workout.actual_distance_km || 0),
                  )}
                </span>
              )}

            {workout.pace_target && (
              <span className="pill">
                {workout.pace_target}
              </span>
            )}
          </div>

          {showDetails && workout.description && (
            <div className="workout-instructions">
              <div className="eyebrow">
                WORKOUT INSTRUCTIONS
              </div>
              <p>{workout.description}</p>
            </div>
          )}

          {showDetails &&
            strength &&
            workout.strength_exercises.length > 0 && (
              <div className="workout-instructions">
                <div className="eyebrow">EXERCISES</div>

                {workout.strength_exercises.map((exercise) => (
                  <div
                    key={exercise.id}
                    style={{
                      padding: "10px 0",
                      borderBottom:
                        "1px solid var(--border, #e5e5e5)",
                    }}
                  >
                    <div className="title">
                      {exercise.exercise_order}.{" "}
                      {exercise.exercise_name}
                    </div>

                    <div className="muted">
                      {getExerciseTarget(exercise)}
                    </div>

                    {exercise.rest_seconds ? (
                      <div className="muted">
                        Rest {exercise.rest_seconds} sec
                      </div>
                    ) : null}

                    {exercise.notes ? (
                      <p>{exercise.notes}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
        </div>
      </div>
    </article>
  );
}

function Today({
  workouts,
  onComplete,
}: {
  workouts: Workout[];
  onComplete: (workout: Workout) => void;
}) {
  const todayWorkouts = workouts.filter(
    (workout) => workout.workout_date === APP_TODAY,
  );

  const yesterdayWorkouts = workouts.filter(
    (workout) => workout.workout_date === APP_YESTERDAY,
  );

  return (
    <>
      <div className="eyebrow">TODAY</div>
      <h1>{formatDate(APP_TODAY)}</h1>

      {todayWorkouts.length > 0 ? (
        todayWorkouts.map((workout) => (
          <WorkoutCard
            key={`${workout.source}-${workout.id}`}
            workout={workout}
            onComplete={onComplete}
          />
        ))
      ) : (
        <div className="card empty">
          <Sun size={35} />
          <h2>Nothing scheduled today</h2>
          <p className="muted">
            Enjoy the day off, or log an unscheduled run.
          </p>
        </div>
      )}

      {yesterdayWorkouts.length > 0 && (
        <section className="section">
          <div className="eyebrow">YESTERDAY</div>

          {yesterdayWorkouts.map((workout) => (
            <WorkoutCard
              key={`${workout.source}-${workout.id}`}
              workout={workout}
              onComplete={onComplete}
            />
          ))}
        </section>
      )}
    </>
  );
}

function Week({
  workouts,
  onComplete,
}: {
  workouts: Workout[];
  onComplete: (workout: Workout) => void;
}) {
  const [offset, setOffset] = useState(0);

  const [selectedByWeek, setSelectedByWeek] = useState<
    Record<string, string>
  >({});

  const { monday, sunday } = getWeekBounds(offset);
  const weekStart = dateToIso(monday);
  const weekEnd = dateToIso(sunday);

  const defaultSelectedDate =
    APP_TODAY >= weekStart && APP_TODAY <= weekEnd
      ? APP_TODAY
      : weekStart;

  const selectedDate =
    selectedByWeek[weekStart] || defaultSelectedDate;

  const weekWorkouts = workouts.filter(
    (workout) =>
      workout.workout_date >= weekStart &&
      workout.workout_date <= weekEnd,
  );

  const selectedWorkouts = weekWorkouts.filter(
    (workout) => workout.workout_date === selectedDate,
  );

  const planned = weekWorkouts
    .filter((workout) => !isStrengthWorkout(workout))
    .reduce(
      (total, workout) =>
        total + Number(workout.planned_distance_km || 0),
      0,
    );

  const actual = weekWorkouts
    .filter(
      (workout) =>
        Boolean(workout.completed) &&
        !isStrengthWorkout(workout),
    )
    .reduce(
      (total, workout) =>
        total + Number(workout.actual_distance_km || 0),
      0,
    );

  const percentage = planned
    ? Math.min(100, Math.round((actual / planned) * 100))
    : 0;

  const days = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + index);
    return day;
  });

  return (
    <>
      <div className="week-head">
        <button
          type="button"
          className="icon-btn"
          aria-label="Previous week"
          onClick={() => setOffset((current) => current - 1)}
        >
          <ChevronLeft size={18} />
        </button>

        <div style={{ textAlign: "center" }}>
          <div className="eyebrow">WEEK</div>

          <h2>
            {monday.getDate()}{" "}
            {monday.toLocaleString("en", {
              month: "short",
            })}{" "}
            – {sunday.getDate()}{" "}
            {sunday.toLocaleString("en", {
              month: "short",
            })}
          </h2>
        </div>

        <button
          type="button"
          className="icon-btn"
          aria-label="Next week"
          onClick={() => setOffset((current) => current + 1)}
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="stats section">
        <div className="stat">
          <span className="muted">Planned</span>
          <strong>{formatKm(planned)}</strong>
        </div>

        <div className="stat">
          <span className="muted">Actual</span>
          <strong>{formatKm(actual)}</strong>
        </div>
      </div>

      <div
        className="progress"
        aria-label={`${percentage}% of planned distance completed`}
      >
        <span style={{ width: `${percentage}%` }} />
      </div>

      <div className="week-strip">
        {days.map((day) => {
          const date = dateToIso(day);

          const dayWorkouts = weekWorkouts.filter(
            (workout) => workout.workout_date === date,
          );

          const dayDistance = dayWorkouts
            .filter((workout) => !isStrengthWorkout(workout))
            .reduce(
              (total, workout) =>
                total +
                Number(
                  workout.planned_distance_km ||
                    workout.actual_distance_km ||
                    0,
                ),
              0,
            );

          const hasStrength = dayWorkouts.some(
            isStrengthWorkout,
          );

          const selected = selectedDate === date;

          return (
            <button
              key={date}
              type="button"
              className={`day ${selected ? "selected" : ""}`}
              aria-pressed={selected}
              aria-label={`Show workouts for ${formatDate(date)}`}
              onClick={() =>
                setSelectedByWeek((current) => ({
                  ...current,
                  [weekStart]: date,
                }))
              }
            >
              {day.toLocaleString("en", {
                weekday: "narrow",
              })}

              <b>{day.getDate()}</b>

              <small>
                {dayDistance
                  ? `${dayDistance.toFixed(1)}k`
                  : hasStrength
                    ? "S"
                    : "–"}
              </small>
            </button>
          );
        })}
      </div>

      <section className="selected-day-section">
        <div className="selected-day-heading">
          <div>
            <div className="eyebrow">SELECTED DAY</div>
            <h2>{formatDate(selectedDate)}</h2>
          </div>

          <span className="pill">
            {selectedWorkouts.length === 1
              ? "1 workout"
              : `${selectedWorkouts.length} workouts`}
          </span>
        </div>

        {selectedWorkouts.length > 0 ? (
          selectedWorkouts.map((workout) => (
            <WorkoutCard
              key={`${workout.source}-${workout.id}`}
              workout={workout}
              onComplete={onComplete}
              showDetails
            />
          ))
        ) : (
          <div className="card empty">
            <Sun size={32} />
            <h2>Nothing scheduled</h2>
            <p className="muted">
              No workout is planned for this day.
            </p>
          </div>
        )}
      </section>
    </>
  );
}

function PlanView({
  workouts,
  activePlanId,
  onComplete,
}: {
  workouts: Workout[];
  activePlanId: string | null;
  onComplete: (workout: Workout) => void;
}) {
  const plannedWorkouts = useMemo(
    () =>
      workouts.filter(
        (workout) => workout.source !== "manual",
      ),
    [workouts],
  );

  const grouped = useMemo(() => {
    const groups = new Map<number, Workout[]>();

    plannedWorkouts.forEach((workout) => {
      const week = workout.week_number || 0;

      groups.set(week, [
        ...(groups.get(week) || []),
        workout,
      ]);
    });

    return [...groups.entries()].sort(
      (first, second) => first[0] - second[0],
    );
  }, [plannedWorkouts]);

  const plannedDistance = plannedWorkouts
    .filter((workout) => !isStrengthWorkout(workout))
    .reduce(
      (total, workout) =>
        total + Number(workout.planned_distance_km || 0),
      0,
    );

  const strengthCount = plannedWorkouts.filter(
    isStrengthWorkout,
  ).length;

  return (
    <>
      <div className="eyebrow">FULL PLAN</div>

      <h1>
        {plannedWorkouts.length} workouts ·{" "}
        {formatKm(plannedDistance)} planned
      </h1>

      {activePlanId && (
        <div className="meta">
          <span className="pill">Active plan</span>

          {strengthCount > 0 && (
            <span className="pill">
              <Dumbbell size={13} />
              {strengthCount} strength
            </span>
          )}
        </div>
      )}

      {grouped.length > 0 ? (
        grouped.map(([week, weekWorkouts]) => (
          <section className="section" key={week}>
            <div className="week-head">
              <div className="eyebrow">
                {week ? `WEEK ${week}` : "UNASSIGNED"}
              </div>

              <b>
                {formatKm(
                  weekWorkouts
                    .filter(
                      (workout) =>
                        !isStrengthWorkout(workout),
                    )
                    .reduce(
                      (total, workout) =>
                        total +
                        Number(
                          workout.planned_distance_km || 0,
                        ),
                      0,
                    ),
                )}
              </b>
            </div>

            {weekWorkouts.map((workout) => (
              <WorkoutCard
                key={workout.id}
                workout={workout}
                onComplete={onComplete}
                showDate
                showDetails={isStrengthWorkout(workout)}
              />
            ))}
          </section>
        ))
      ) : (
        <div className="card empty">
          <ClipboardList size={34} />
          <h2>No active plan</h2>

          <p className="muted">
            Open Settings to import or select a training plan.
          </p>
        </div>
      )}
    </>
  );
}

function SettingsPage({
  api,
  onDone,
}: {
  api: ApiFunction;
  onDone: () => Promise<void>;
}) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [importMode, setImportMode] =
    useState("new-active");
  const [replacePlanId, setReplacePlanId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [historyConfirmation, setHistoryConfirmation] =
    useState("");

  const loadPlans = useCallback(async () => {
    const data = await api<PlansResponse>("/api/plans");

    setPlans(data.plans);

    setReplacePlanId(
      (current) => current || data.plans[0]?.id || "",
    );
  }, [api]);

  useEffect(() => {
    async function load() {
      try {
        await loadPlans();
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Could not load plans.",
        );
      } finally {
        setPlansLoading(false);
      }
    }

    void load();
  }, [loadPlans]);

  async function refreshEverything() {
    await Promise.all([loadPlans(), onDone()]);
  }

  async function submitImport(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setMessage("");
    setError("");

    const importForm = event.currentTarget;

    try {
      const form = new FormData(importForm);
      const selectedFile = form.get("file");

    if (!(selectedFile instanceof File)) {
      throw new Error("Choose a CSV file.");
    }

      if (
        !selectedFile.name.toLowerCase().endsWith(".csv")
      ) {
        throw new Error(
          "The selected file must have a .csv extension.",
        );
      }

      if (selectedFile.size === 0) {
        throw new Error("The selected CSV file is empty.");
      }

      form.set("mode", importMode);

      if (importMode === "replace") {
        if (!replacePlanId) {
          throw new Error("Choose the plan to replace.");
        }

        form.set("replacePlanId", replacePlanId);
      }

      const data = await api<ImportResponse>("/api/import", {
        method: "POST",
        body: form,
      });

      setMessage(
        `Imported ${data.imported} workouts and ${data.strengthExercises} strength exercises. Workout history was preserved.`,
      );

      importForm.reset();
      setImportMode("new-active");

      await refreshEverything();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Import failed.",
      );
    }
  }

  async function selectPlan(planId: string) {
    setMessage("");
    setError("");

    try {
      await api<{
        ok: boolean;
        activePlanId: string;
      }>("/api/plans", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ planId }),
      });

      setMessage("Active training plan updated.");
      await refreshEverything();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not select plan.",
      );
    }
  }

  async function deletePlan(plan: Plan) {
    const confirmed = window.confirm(
      `Delete "${plan.name}"? Planned workouts will be removed, but completed-workout history will remain saved.`,
    );

    if (!confirmed) {
      return;
    }

    setMessage("");
    setError("");

    try {
      await api<{
        ok: boolean;
        activePlanId: string | null;
      }>(`/api/plans/${plan.id}`, {
        method: "DELETE",
      });

      setMessage(
        "Training plan deleted. Workout history was preserved.",
      );

      await refreshEverything();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not delete plan.",
      );
    }
  }

  async function eraseHistory() {
    if (historyConfirmation !== "DELETE") {
      setError(
        'Type "DELETE" before erasing workout history.',
      );
      return;
    }

    const confirmed = window.confirm(
      "Permanently erase all completed and manually logged workout history? This cannot be undone.",
    );

    if (!confirmed) {
      return;
    }

    setMessage("");
    setError("");

    try {
      const data = await api<DeleteHistoryResponse>(
        "/api/workout-logs",
        {
          method: "DELETE",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            confirmation: historyConfirmation,
          }),
        },
      );

      setHistoryConfirmation("");
      setMessage(`Deleted ${data.deleted} workout logs.`);
      await onDone();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not erase workout history.",
      );
    }
  }

  return (
    <>
      <div className="eyebrow">SETTINGS</div>
      <h1>Training plans</h1>

      {error && <div className="error">{error}</div>}
      {message && <div className="success">{message}</div>}

      <div className="card">
        <h2>Your plans</h2>

        {plansLoading ? (
          <p className="muted">Loading plans…</p>
        ) : plans.length > 0 ? (
          plans.map((plan) => (
            <div
              key={plan.id}
              style={{
                padding: "14px 0",
                borderBottom:
                  "1px solid var(--border, #e5e5e5)",
              }}
            >
              <div className="week-head">
                <div>
                  <div className="title">{plan.name}</div>

                  <div className="muted">
                    {plan.workout_count} workouts
                    {Number(plan.strength_workout_count) > 0
                      ? ` · ${plan.strength_workout_count} strength`
                      : ""}
                  </div>
                </div>

                {Boolean(plan.active) && (
                  <span className="pill">Active</span>
                )}
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 10,
                  marginTop: 12,
                  flexWrap: "wrap",
                }}
              >
                {!plan.active && (
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => void selectPlan(plan.id)}
                  >
                    Use this plan
                  </button>
                )}

                <button
                  type="button"
                  className="secondary"
                  aria-label={`Delete ${plan.name}`}
                  onClick={() => void deletePlan(plan)}
                >
                  <Trash2 size={16} />
                  Delete
                </button>
              </div>
            </div>
          ))
        ) : (
          <p className="muted">
            No training plans have been uploaded.
          </p>
        )}
      </div>

      <form className="card" onSubmit={submitImport}>
        <h2>Import CSV</h2>

        <div
          className="workout-instructions"
          style={{ marginBottom: 20 }}
        >
          <div className="eyebrow">CSV FORMAT</div>

          <h3>Start with the template</h3>

          <p className="muted">
            Download the template, open it in Excel,
            Numbers, Google Sheets, or another spreadsheet
            app, replace the example rows with your training
            plan, and export or save the result as a
            comma-separated CSV file.
          </p>

          <button
            type="button"
            className="secondary"
            onClick={downloadCsvTemplate}
            style={{ marginBottom: 18 }}
          >
            <Download size={16} />
            Download CSV template
          </button>

          <div
            style={{
              display: "grid",
              gap: 16,
            }}
          >
            <div>
              <div className="title">Running workouts</div>

              <p className="muted">
                Use one row for each run. Set{" "}
                <strong>workout_type</strong> to{" "}
                <strong>run</strong>. Enter the planned
                distance in kilometres in{" "}
                <strong>distance_km</strong>. Leave all
                exercise fields empty.
              </p>
            </div>

            <div>
              <div className="title">Strength workouts</div>

              <p className="muted">
                Use one row for each exercise and set{" "}
                <strong>workout_type</strong> to{" "}
                <strong>strength</strong>. Every exercise in
                the same session must have the same{" "}
                <strong>date</strong>,{" "}
                <strong>workout_id</strong>, and{" "}
                <strong>title</strong>. Use{" "}
                <strong>exercise_order</strong> to number the
                exercises from 1.
              </p>
            </div>

            <div>
              <div className="title">
                Required strength fields
              </div>

              <p className="muted">
                Every strength row needs{" "}
                <strong>exercise_name</strong>,{" "}
                <strong>exercise_order</strong>, and{" "}
                <strong>sets</strong>. It must also include
                at least one target: <strong>reps</strong>,{" "}
                <strong>duration_seconds</strong>, or{" "}
                <strong>distance_meters</strong>.
              </p>
            </div>

            <div>
              <div className="title">Accepted values</div>

              <p className="muted">
                Dates must use <strong>YYYY-MM-DD</strong>.
                <br />
                workout_type: run or strength.
                <br />
                weight_unit: kg, lb, or bodyweight.
                <br />
                side: both, left, right, or alternating.
                <br />
                rpe: a number from 1 to 10.
                <br />
                rir: zero or a positive whole number.
              </p>
            </div>
          </div>

          <details style={{ marginTop: 16 }}>
            <summary
              style={{
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              Show all supported columns
            </summary>

            <p
              className="muted"
              style={{
                lineHeight: 1.7,
                overflowWrap: "anywhere",
              }}
            >
              date, week_number, day_of_week, workout_type,
              workout_id, title, distance_km, duration_min,
              description, pace_target, notes,
              exercise_order, exercise_name, sets, reps,
              weight, weight_unit, duration_seconds,
              distance_meters, rest_seconds, rir, rpe, tempo,
              side, exercise_notes
            </p>
          </details>
        </div>

        <div className="field">
          <label htmlFor="plan-name">PLAN NAME</label>

          <input
            id="plan-name"
            name="planName"
            defaultValue="My Training Plan"
            required
          />
        </div>

        <div className="field">
          <label htmlFor="import-mode">IMPORT OPTION</label>

          <select
            id="import-mode"
            name="mode"
            value={importMode}
            onChange={(event) =>
              setImportMode(event.target.value)
            }
          >
            <option value="new-active">
              Add as new active plan
            </option>

            <option value="new-inactive">
              Add without changing active plan
            </option>

            <option value="replace">
              Replace an existing plan
            </option>
          </select>
        </div>

        {importMode === "replace" && (
          <div className="field">
            <label htmlFor="replace-plan">
              PLAN TO REPLACE
            </label>

            <select
              id="replace-plan"
              name="replacePlanId"
              value={replacePlanId}
              onChange={(event) =>
                setReplacePlanId(event.target.value)
              }
              required
            >
              <option value="">Choose a plan</option>

              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name}
                  {plan.active ? " (active)" : ""}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="field">
          <label htmlFor="training-plan-file">
            CHOOSE A CSV FILE
          </label>

          <input
            className="file"
            id="training-plan-file"
            name="file"
            type="file"
            accept=".csv,text/csv"
            required
          />
        </div>

        <button className="primary" type="submit">
          Import CSV
        </button>
      </form>

      <div className="card">
        <h2>Workout history</h2>

        <p className="muted">
          Erasing history permanently removes completed
          workouts, manual runs, actual distances, strength
          logs, and workout notes. Training plans remain.
        </p>

        <div className="field">
          <label htmlFor="delete-confirmation">
            TYPE DELETE TO CONFIRM
          </label>

          <input
            id="delete-confirmation"
            value={historyConfirmation}
            onChange={(event) =>
              setHistoryConfirmation(event.target.value)
            }
            placeholder="DELETE"
          />
        </div>

        <button
          type="button"
          className="secondary"
          onClick={() => void eraseHistory()}
        >
          <Trash2 size={16} />
          Erase workout history
        </button>
      </div>

      <div className="card">
        <h2>Polar Flow</h2>

        <p className="muted">
          Planned for a future release. The data model
          already records workout source information.
        </p>
      </div>

      <div className="card">
        <h2>Account</h2>

        <p className="muted">
          Sign out of RUN on this device. Your training plans
          and workout history will remain saved.
        </p>

        <button
          type="button"
          className="secondary"
          onClick={async () => {
            setError("");

            try {
              const response = await fetch(
                "/api/auth/logout",
                {
                  method: "POST",
                  credentials: "include",
                },
              );

              if (!response.ok) {
                const data = (await response.json()) as {
                  error?: string;
                };

                throw new Error(
                  data.error || "Could not sign out.",
                );
              }

              window.location.replace("/login");
            } catch (caughtError) {
              setError(
                caughtError instanceof Error
                  ? caughtError.message
                  : "Could not sign out.",
              );
            }
          }}
        >
          Sign out
        </button>
      </div>
    </>
  );
}

function Nav({
  tab,
  onChange,
}: {
  tab: Tab;
  onChange: (tab: Tab) => void;
}) {
  const items: [Tab, React.ReactNode, string][] = [
    [
      "today",
      <CalendarDays key="today-icon" size={20} />,
      "Today",
    ],
    [
      "week",
      <CalendarRange key="week-icon" size={20} />,
      "Week",
    ],
    [
      "plan",
      <ClipboardList key="plan-icon" size={20} />,
      "Plan",
    ],
    [
      "settings",
      <Settings key="settings-icon" size={20} />,
      "Settings",
    ],
  ];

  return (
    <nav className="nav">
      {items.map(([id, icon, label]) => (
        <button
          key={id}
          type="button"
          className={tab === id ? "active" : ""}
          onClick={() => onChange(id)}
        >
          {icon}
          {label}
        </button>
      ))}
    </nav>
  );
}

function WorkoutModal({
  modal,
  api,
  close,
  done,
}: {
  modal: Exclude<ModalState, null>;
  api: ApiFunction;
  close: () => void;
  done: () => Promise<void>;
}) {
  const workout =
    modal.kind === "complete" ? modal.workout : null;

  const strength =
    workout !== null && isStrengthWorkout(workout);

  const [modalError, setModalError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setModalError("");
    setSaving(true);

    const form = new FormData(event.currentTarget);

    try {
      if (modal.kind === "manual") {
        await api<{
          id: string;
          logId: string;
        }>("/api/workouts", {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            date: form.get("date"),
            title: form.get("title"),
            actualDistanceKm: form.get("distance"),
            durationMin: form.get("duration"),
            notes: form.get("notes"),
          }),
        });
      } else {
        const completedWorkout = modal.workout;
        const completedStrength =
          isStrengthWorkout(completedWorkout);

        await api<{
          ok: boolean;
          logId: string;
        }>(`/api/workouts/${completedWorkout.id}`, {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            completed: true,
            actualDistanceKm: completedStrength
              ? null
              : form.get("distance"),
            actualDurationMin: form.get("duration"),
            notes: form.get("notes"),
          }),
        });
      }

      await done();
    } catch (caughtError) {
      setModalError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not save workout.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function removeLog() {
    if (!workout) {
      return;
    }

    const message =
      workout.source === "manual"
        ? "Delete this manually logged workout?"
        : "Remove this completion log and mark the workout incomplete?";

    if (!window.confirm(message)) {
      return;
    }

    setModalError("");
    setSaving(true);

    try {
      if (workout.log_id) {
        await api<{ ok: boolean }>(
          `/api/workout-logs/${workout.log_id}`,
          { method: "DELETE" },
        );
      } else {
        await api<{ ok: boolean }>(
          `/api/workouts/${workout.id}`,
          {
            method: "PATCH",
            headers: {
              "content-type": "application/json",
            },
            body: JSON.stringify({
              completed: false,
            }),
          },
        );
      }

      await done();
    } catch (caughtError) {
      setModalError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not remove workout log.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="dialog-back"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          close();
        }
      }}
    >
      <form className="dialog" onSubmit={submit}>
        <div className="dialog-head">
          <h2>
            {modal.kind === "manual"
              ? "Log a run"
              : strength
                ? "Complete strength workout"
                : "Complete workout"}
          </h2>

          <button
            type="button"
            className="icon-btn"
            onClick={close}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {modal.kind === "manual" ? (
          <>
            <div className="field">
              <label>DATE</label>

              <input
                name="date"
                type="date"
                defaultValue={APP_TODAY}
                required
              />
            </div>

            <div className="field">
              <label>TITLE</label>

              <input
                name="title"
                defaultValue="Manual run"
                required
              />
            </div>
          </>
        ) : (
          <>
            <p className="muted">
              {modal.workout.title}

              {!isStrengthWorkout(modal.workout)
                ? ` · planned ${formatKm(
                    Number(
                      modal.workout.planned_distance_km || 0,
                    ),
                  )}`
                : ""}
            </p>

            {isStrengthWorkout(modal.workout) &&
              modal.workout.strength_exercises.length > 0 && (
                <div className="card">
                  <div className="eyebrow">
                    PLANNED EXERCISES
                  </div>

                  {modal.workout.strength_exercises.map(
                    (exercise) => (
                      <p key={exercise.id}>
                        <strong>
                          {exercise.exercise_order}.{" "}
                          {exercise.exercise_name}
                        </strong>

                        <br />

                        <span className="muted">
                          {getExerciseTarget(exercise)}
                        </span>
                      </p>
                    ),
                  )}
                </div>
              )}
          </>
        )}

        {!strength && (
          <div className="field">
            <label>ACTUAL DISTANCE (KM)</label>

            <input
              name="distance"
              type="number"
              min="0"
              step="0.01"
              defaultValue={
                workout?.actual_distance_km ??
                workout?.planned_distance_km ??
                ""
              }
              required
            />
          </div>
        )}

        <div className="field">
          <label>DURATION (MINUTES)</label>

          <input
            name="duration"
            type="number"
            min="0"
            step="1"
            defaultValue={
              workout?.actual_duration_min ??
              workout?.duration_min ??
              ""
            }
          />
        </div>

        <div className="field">
          <label>NOTES</label>

          <textarea
            name="notes"
            rows={3}
            defaultValue={workout?.workout_notes || ""}
          />
        </div>

        {modalError && (
          <div className="error">{modalError}</div>
        )}

        <button
          className="primary"
          type="submit"
          disabled={saving}
        >
          {saving
            ? "Saving…"
            : strength
              ? "Save strength workout"
              : "Save run"}
        </button>

        {modal.kind === "complete" &&
          (modal.workout.completed ||
            modal.workout.source === "manual") && (
            <button
              className="secondary"
              style={{ marginTop: 10 }}
              type="button"
              disabled={saving}
              onClick={() => void removeLog()}
            >
              <Trash2 size={16} />

              {modal.workout.source === "manual"
                ? "Delete logged workout"
                : "Remove completion log"}
            </button>
          )}
      </form>
    </div>
  );
}