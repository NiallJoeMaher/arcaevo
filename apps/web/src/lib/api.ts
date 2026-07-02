/**
 * Tiny route-handler helpers shared by the v2 API routes — JSON body parsing
 * + zod validation with the same error envelope the v1 routes use.
 */
import type { z } from "zod";

export type ParsedBody<T> =
  | { ok: true; data: T }
  | { ok: false; response: Response };

export async function parseJsonBody<Schema extends z.ZodType>(
  req: Request,
  schema: Schema
): Promise<ParsedBody<z.output<Schema>>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return {
      ok: false,
      response: Response.json(
        { error: "bad_request", message: "Expected JSON body." },
        { status: 400 }
      ),
    };
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false,
      response: Response.json(
        { error: "validation", issues: parsed.error.issues },
        { status: 400 }
      ),
    };
  }
  return { ok: true, data: parsed.data };
}

/** Base URL for links inside emails (magic links, buttons). */
export function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}
