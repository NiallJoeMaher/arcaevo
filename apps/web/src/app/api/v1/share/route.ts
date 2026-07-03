/**
 * /api/v1/share (member auth) — GP share links (design §15).
 *
 *  GET  — list the member's links, incl. the access log ("Opened twice —
 *         Dublin, 3 July"): the user always knows if it was actually read.
 *  POST — create a revocable link, default 30-day expiry:
 *         arcaevo.com/s/<token>.
 */
import { randomBytes } from "node:crypto";
import { requireConsentedMember } from "@/lib/consent-guard";
import { parseJsonBody, siteUrl } from "@/lib/api";
import { collections } from "@/lib/db";
import { newId } from "@/lib/ids";
import { ShareCreateInput, type ShareLink } from "@/lib/models";

export async function GET(req: Request) {
  const auth = await requireConsentedMember(req);
  if (auth.denied) return auth.denied;

  const links = await collections
    .shareLinks()
    .then((c) =>
      c.find({ userId: auth.member._id }).sort({ createdAt: -1 }).toArray()
    );
  const now = Date.now();
  return Response.json({
    links: links.map((link) => ({
      token: link.token,
      url: `${siteUrl()}/s/${link.token}`,
      createdAt: link.createdAt,
      expiresAt: link.expiresAt,
      revoked: link.revoked,
      active: !link.revoked && link.expiresAt.getTime() > now,
      accessLog: link.accessLog,
      openedCount: link.accessLog.length,
    })),
  });
}

export async function POST(req: Request) {
  const auth = await requireConsentedMember(req);
  if (auth.denied) return auth.denied;

  const parsed = await parseJsonBody(req, ShareCreateInput);
  if (!parsed.ok) return parsed.response;

  const shareLinks = await collections.shareLinks();
  const now = new Date();
  const link: ShareLink = {
    _id: newId("share"), // collision-free (see lib/ids)
    token: randomBytes(9).toString("base64url"), // short, URL-safe (…/s/k7f2…)
    userId: auth.member._id,
    createdAt: now,
    expiresAt: new Date(
      now.getTime() + parsed.data.expiresInDays * 24 * 60 * 60 * 1000
    ),
    revoked: false,
    accessLog: [],
  };
  await shareLinks.insertOne(link);

  return Response.json(
    {
      token: link.token,
      url: `${siteUrl()}/s/${link.token}`,
      expiresAt: link.expiresAt,
      note: "Read-only clinician summary. Expires after 30 days, or when you revoke it — access is logged.",
    },
    { status: 201 }
  );
}
