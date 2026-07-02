/**
 * /api/v1/admin/support — admin support queue.
 *  GET  — list tickets (open/pending first, then newest).
 *  POST — create a ticket (e.g. logged on a member's behalf).
 */
import { requireAdmin } from "@/lib/auth";
import { collections } from "@/lib/db";
import { CreateSupportTicketInput, type SupportTicket } from "@/lib/models";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  const tickets = await collections
    .supportTickets()
    .then((c) => c.find().sort({ createdAt: -1 }).toArray());
  const rank = { open: 0, pending: 1, closed: 2 } as const;
  tickets.sort((a, b) => rank[a.status] - rank[b.status]);

  return Response.json({ tickets });
}

export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { error: "bad_request", message: "Expected JSON body." },
      { status: 400 }
    );
  }
  const parsed = CreateSupportTicketInput.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "validation", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const col = await collections.supportTickets();
  const count = await col.countDocuments();
  const now = new Date();
  const ticket: SupportTicket = {
    _id: `tick_${String(count + 1).padStart(4, "0")}`,
    memberId: parsed.data.memberId ?? null,
    subject: parsed.data.subject,
    body: parsed.data.body,
    status: "open",
    priority: parsed.data.priority ?? "normal",
    createdAt: now,
    updatedAt: now,
  };
  await col.insertOne(ticket);

  return Response.json({ ticket }, { status: 201 });
}
