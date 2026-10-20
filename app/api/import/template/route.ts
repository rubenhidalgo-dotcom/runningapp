const CSV_HEADER = [
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

const EXAMPLE_ROWS = [
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

function createCsv() {
  return [CSV_HEADER, ...EXAMPLE_ROWS]
    .map((row) => row.map(escapeCsvValue).join(","))
    .join("\r\n");
}

export async function GET() {
  const csv = createCsv();

  return new Response(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition":
        'attachment; filename="run-training-plan-template.csv"',
      "cache-control": "public, max-age=3600",
    },
  });
}