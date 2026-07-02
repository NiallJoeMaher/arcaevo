"use server";

/**
 * Session management server actions (design §17 W12). Sessions are stored
 * hash-only (src/lib/member-auth.ts), so revocation works on the stored
 * rows — never on raw tokens.
 */
import { revalidatePath } from "next/cache";
import { collections } from "@/lib/db";
import { revokeSessions, sha256Hex } from "@/lib/member-auth";
import {
  currentMember,
  sessionTokenFromCookies,
} from "@/components/account/session";

/** "End session" — one row, owner only, never the current device. */
export async function endSession(sessionId: string): Promise<void> {
  const [member, token] = await Promise.all([
    currentMember(),
    sessionTokenFromCookies(),
  ]);
  if (!member || !token) return;
  const currentHash = sha256Hex(token);
  await collections.sessions().then((c) =>
    c.deleteOne({
      _id: sessionId,
      userId: member._id,
      tokenHash: { $ne: currentHash },
    })
  );
  revalidatePath("/account/security");
}

/** "Sign out all" — everything except this device. */
export async function signOutEverywhereElse(): Promise<void> {
  const [member, token] = await Promise.all([
    currentMember(),
    sessionTokenFromCookies(),
  ]);
  if (!member || !token) return;
  await revokeSessions(member._id, sha256Hex(token));
  revalidatePath("/account/security");
}
