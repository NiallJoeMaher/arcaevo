/** POST /api/v1/admin/logout — clears the admin session cookie. */
import { clearAdminSessionCookie } from "@/lib/auth";

export async function POST() {
  await clearAdminSessionCookie();
  return Response.json({ ok: true });
}
