import { requireUserId } from "@/lib/auth";
import { db, jsonError } from "@/lib/db";

type OwnedPlan = {
  id: string;
};

type ReplacementPlan = {
  id: string;
};

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const uid = await requireUserId(request);
    const { id } = await context.params;
    const database = await db();

    const plan = await database
      .prepare(`
        SELECT id
        FROM plans
        WHERE id = ?
          AND user_id = ?
        LIMIT 1
      `)
      .bind(id, uid)
      .first<OwnedPlan>();

    if (!plan) {
      return jsonError(new Error("Plan not found."), 404);
    }

    /*
     * workout_logs do not have a cascading foreign key to plans.
     * Deleting this plan therefore removes scheduled workouts and
     * planned strength exercises but preserves all historical logs.
     */
    await database
      .prepare(`
        DELETE FROM plans
        WHERE id = ?
          AND user_id = ?
      `)
      .bind(id, uid)
      .run();

    const replacement = await database
      .prepare(`
        SELECT id
        FROM plans
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT 1
      `)
      .bind(uid)
      .first<ReplacementPlan>();

    await database
      .prepare(`
        UPDATE users
        SET active_plan_id = ?
        WHERE id = ?
      `)
      .bind(replacement?.id ?? null, uid)
      .run();

    return Response.json({
      ok: true,
      activePlanId: replacement?.id ?? null,
    });
  } catch (error) {
    return jsonError(error);
  }
}