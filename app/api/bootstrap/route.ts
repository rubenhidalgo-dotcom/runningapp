import { requireUserId } from "@/lib/auth";
import { db, jsonError } from "@/lib/db";

type Plan = {
  id: string;
  name: string;
};

export async function POST(request: Request) {
  try {
    const uid = await requireUserId(request);
    const database = await db();
    const now = Date.now();

    await database
      .prepare(`
        INSERT OR IGNORE INTO users (id, created_at)
        VALUES (?, ?)
      `)
      .bind(uid, now)
      .run();

    let plan = await database
      .prepare(`
        SELECT p.id, p.name
        FROM users u
        JOIN plans p
          ON p.id = u.active_plan_id
         AND p.user_id = u.id
        WHERE u.id = ?
        LIMIT 1
      `)
      .bind(uid)
      .first<Plan>();

    if (!plan) {
      plan = await database
        .prepare(`
          SELECT id, name
          FROM plans
          WHERE user_id = ?
          ORDER BY created_at
          LIMIT 1
        `)
        .bind(uid)
        .first<Plan>();

      if (plan) {
        await database
          .prepare(`
            UPDATE users
            SET active_plan_id = ?
            WHERE id = ?
          `)
          .bind(plan.id, uid)
          .run();
      }
    }

    return Response.json({
      userId: uid,
      plan: plan ?? null,
    });
  } catch (error) {
    return jsonError(error);
  }
}