import { requireUserId } from "@/lib/auth";
import { db, jsonError } from "@/lib/db";

type SelectPlanBody = {
  planId?: string;
};

export async function GET(request: Request) {
  try {
    const uid = await requireUserId(request);
    const database = await db();

    const result = await database
      .prepare(`
        SELECT
          p.id,
          p.name,
          p.created_at,
          p.updated_at,
          CASE
            WHEN p.id = u.active_plan_id THEN 1
            ELSE 0
          END AS active,
          COUNT(w.id) AS workout_count,
          SUM(
            CASE
              WHEN lower(COALESCE(w.workout_type, '')) = 'strength'
                THEN 1
              ELSE 0
            END
          ) AS strength_workout_count
        FROM plans p
        JOIN users u ON u.id = p.user_id
        LEFT JOIN workouts w ON w.plan_id = p.id
        WHERE p.user_id = ?
        GROUP BY
          p.id,
          p.name,
          p.created_at,
          p.updated_at,
          u.active_plan_id
        ORDER BY active DESC, p.created_at DESC
      `)
      .bind(uid)
      .all();

    return Response.json({
      plans: result.results,
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const uid = await requireUserId(request);
    const body = (await request.json()) as SelectPlanBody;
    const planId = String(body.planId || "");
    const database = await db();

    if (!planId) {
      throw new Error("Choose a plan.");
    }

    const plan = await database
      .prepare(`
        SELECT id
        FROM plans
        WHERE id = ?
          AND user_id = ?
        LIMIT 1
      `)
      .bind(planId, uid)
      .first<{ id: string }>();

    if (!plan) {
      return jsonError(new Error("Plan not found."), 404);
    }

    await database
      .prepare(`
        UPDATE users
        SET active_plan_id = ?
        WHERE id = ?
      `)
      .bind(plan.id, uid)
      .run();

    return Response.json({
      ok: true,
      activePlanId: plan.id,
    });
  } catch (error) {
    return jsonError(error);
  }
}