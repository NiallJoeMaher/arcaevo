"use client";

/**
 * "Where you're signed in" (design §17 W12). Real session rows — sessions
 * are stored hash-only, so ending one deletes the row server-side (see
 * actions.ts). The current device can't end itself here; that's Sign out.
 */
import { useTransition } from "react";
import { endSession, signOutEverywhereElse } from "./actions";

/** Fallback label from the user-agent for legacy rows without a device label. */
function userAgentLabel(userAgent: string): string {
  if (/iphone/i.test(userAgent)) return "iPhone · Arcaevo app";
  if (/safari/i.test(userAgent) && /mac os x/i.test(userAgent))
    return "Safari · Mac";
  if (/firefox/i.test(userAgent)) return "Firefox";
  if (/chrome/i.test(userAgent)) return "Chrome";
  if (/curl/i.test(userAgent)) return "API client";
  return userAgent.slice(0, 40) || "Unknown device";
}

function relative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ms / 86_400_000);
  if (days >= 1) return days === 1 ? "1 day ago" : `${days} days ago`;
  const hours = Math.floor(ms / 3_600_000);
  if (hours >= 1) return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
  return "just now";
}

export default function SessionList({
  sessions,
}: {
  sessions: {
    id: string;
    label?: string;
    device?: "web" | "ios" | "watch";
    userAgent: string;
    lastSeen: string;
    current: boolean;
  }[];
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="rounded-[14px] border border-hairline bg-white px-[18px] py-4">
      <h2 className="mb-[10px] text-[13.5px] font-bold">
        Where you&rsquo;re signed in
      </h2>
      <ul>
        {sessions.map((s) => (
          <li
            key={s.id}
            className="flex items-center justify-between border-b border-hairline-soft py-2"
          >
            <span className="text-[12.5px]">
              <strong>{s.label ?? userAgentLabel(s.userAgent)}</strong>
              <span className="text-caption">
                {s.current ? " — this device" : ` — ${relative(s.lastSeen)}`}
              </span>
            </span>
            {s.current ? (
              <span className="font-mono text-[10px] text-forest">NOW</span>
            ) : (
              <button
                type="button"
                disabled={pending}
                onClick={() => startTransition(() => endSession(s.id))}
                className="cursor-pointer text-[11.5px] font-semibold text-[#B3543A] disabled:opacity-60"
              >
                End session
              </button>
            )}
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between pt-2">
        <span className="text-[12.5px] text-caption">
          Sign out of everything else
        </span>
        <button
          type="button"
          disabled={pending || sessions.length <= 1}
          onClick={() => startTransition(() => signOutEverywhereElse())}
          className="cursor-pointer text-[11.5px] font-semibold text-[#B3543A] disabled:opacity-50"
        >
          Sign out all
        </button>
      </div>
    </div>
  );
}
