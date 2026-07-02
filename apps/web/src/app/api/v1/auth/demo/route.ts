/**
 * POST /api/v1/auth/demo — MOCK member auth (docs/MOCKED_APIS.md §4).
 * Returns the static demo bearer token that maps to the seeded demo member.
 * Productionise: Sign in with Apple + rotating JWTs.
 */
import { DEMO_MEMBER_TOKEN } from "@/lib/auth";
import { collections } from "@/lib/db";

export async function POST() {
  const users = await collections.users();
  const demo = await users.findOne({ isDemo: true });
  if (!demo) {
    return Response.json(
      {
        error: "not_seeded",
        message: "No demo member found. Run `npm run seed` in apps/web first.",
      },
      { status: 409 }
    );
  }
  return Response.json({
    token: DEMO_MEMBER_TOKEN,
    tokenType: "Bearer",
    member: { id: demo._id, name: demo.name, email: demo.email },
  });
}
