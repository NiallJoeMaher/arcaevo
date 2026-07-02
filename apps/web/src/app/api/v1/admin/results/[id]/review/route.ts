/**
 * POST /api/v1/admin/results/[id]/review — admin marks a reading as
 * clinician-reviewed. (Clinician review is MOCKED — docs/MOCKED_APIS.md §5;
 * a real flow needs a clinician portal + medical-ops partner.)
 */
import { requireAdmin } from "@/lib/auth";
import { collections } from "@/lib/db";
import { ReviewResultInput } from "@/lib/models";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;
  let reviewed = true;
  try {
    const body = await req.json();
    const parsed = ReviewResultInput.safeParse(body);
    if (parsed.success) reviewed = parsed.data.reviewed;
  } catch {
    // empty body ⇒ default: mark reviewed
  }

  const readings = await collections.biomarkerReadings();
  const result = await readings.findOneAndUpdate(
    { _id: id },
    { $set: { clinicianReviewed: reviewed } },
    { returnDocument: "after" }
  );
  if (!result) {
    return Response.json(
      { error: "not_found", message: `No reading ${id}.` },
      { status: 404 }
    );
  }
  return Response.json({ reading: result });
}
