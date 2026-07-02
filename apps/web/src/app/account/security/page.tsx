import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { collections } from "@/lib/db";
import { sha256Hex } from "@/lib/member-auth";
import {
  currentMember,
  sessionTokenFromCookies,
} from "@/components/account/session";
import PasswordRow from "./PasswordRow";
import SessionList from "./SessionList";

export const metadata: Metadata = {
  title: "Sign-in & security",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

/**
 * W12 · ACCOUNT → SIGN-IN & SECURITY (design §17).
 * Passkeys and TOTP ship on the auth roadmap (+3 months) — shown as the
 * designed coming states, never faked as working.
 */
export default async function SecurityPage() {
  const member = await currentMember();
  if (!member) redirect("/signin");

  const token = await sessionTokenFromCookies();
  const currentHash = token ? sha256Hex(token) : "";
  const sessions = await collections
    .sessions()
    .then((c) => c.find({ userId: member._id }).sort({ lastSeen: -1 }).toArray());

  return (
    <div>
      <h1 className="sr-only">Account — Sign-in &amp; security</h1>

      {/* Passkeys — the natural upgrade from magic links. COMING (+3 mo). */}
      <div className="mb-3 flex items-center justify-between gap-[14px] rounded-[14px] border border-[rgba(52,160,124,0.3)] bg-[rgba(52,160,124,0.08)] px-[18px] py-4">
        <div>
          <div className="mb-[2px] text-[13.5px] font-bold">
            Add a passkey — skip passwords entirely
          </div>
          <div className="text-[12px] leading-[1.5] text-muted">
            Face ID or Touch ID becomes your sign-in. Nothing to remember,
            nothing to steal.
          </div>
          <div className="mt-[6px] font-mono text-[9px] tracking-[0.1em] text-forest">
            COMING · PROMPTED AFTER YOUR THIRD SIGN-IN, NEVER DURING ONBOARDING
          </div>
        </div>
        <span
          aria-disabled="true"
          className="shrink-0 rounded-pill border border-forest px-4 py-2 text-[12px] font-semibold text-forest opacity-50"
        >
          Add passkey
        </span>
      </div>

      <PasswordRow
        email={member.email}
        hasPassword={Boolean(member.passwordHash)}
      />

      {/* TOTP — optional, recommended. COMING with passkeys. */}
      <div className="mb-3 flex items-center justify-between gap-[14px] rounded-[14px] border border-hairline bg-white px-[18px] py-4">
        <div>
          <div className="mb-[2px] text-[13.5px] font-bold">
            Two-factor authentication
          </div>
          <div className="text-[12px] text-caption">
            Authenticator app (TOTP) · optional, recommended
          </div>
          <div className="mt-[6px] font-mono text-[9px] tracking-[0.1em] text-caption">
            COMING · ARRIVES WITH PASSKEYS
          </div>
        </div>
        <span
          role="switch"
          aria-checked="false"
          aria-disabled="true"
          aria-label="Two-factor authentication"
          className="relative h-5 w-[34px] shrink-0 rounded-pill bg-[rgba(28,38,32,0.18)]"
        >
          <span className="absolute left-[2px] top-[2px] h-4 w-4 rounded-full bg-white" />
        </span>
      </div>

      <SessionList
        sessions={sessions.map((s) => ({
          id: s._id,
          userAgent: s.userAgent,
          lastSeen: s.lastSeen.toISOString(),
          current: s.tokenHash === currentHash,
        }))}
      />
    </div>
  );
}
