/**
 * POST /api/v1/admin/login — PLACEHOLDER admin auth (docs/MOCKED_APIS.md §3).
 * Verifies ADMIN_PASSWORD and sets an HMAC-signed session cookie.
 */
import { setAdminSessionCookie, verifyAdminPassword } from "@/lib/auth";
import { AdminLoginInput } from "@/lib/models";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { error: "bad_request", message: "Expected JSON body." },
      { status: 400 }
    );
  }
  const parsed = AdminLoginInput.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "validation", issues: parsed.error.issues },
      { status: 400 }
    );
  }
  if (!verifyAdminPassword(parsed.data.password)) {
    return Response.json(
      { error: "invalid_credentials", message: "Wrong password." },
      { status: 401 }
    );
  }
  await setAdminSessionCookie();
  return Response.json({ ok: true, role: "admin" });
}
