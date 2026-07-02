"use client";

/**
 * GP share links (design §15) — "Active links are listed and revocable in
 * Account → Data & privacy." Access is logged: the user always knows if —
 * and when — it was actually read ("Opened twice — Dublin, 3 July").
 */
import { useCallback, useEffect, useState } from "react";

interface ShareLink {
  token: string;
  url: string;
  createdAt: string;
  expiresAt: string;
  revoked: boolean;
  active: boolean;
  accessLog: { at: string; location: string }[];
  openedCount: number;
}

function dayMonth(iso: string): string {
  return new Intl.DateTimeFormat("en-IE", {
    day: "numeric",
    month: "long",
  }).format(new Date(iso));
}

function openedLabel(link: ShareLink): string {
  if (link.openedCount === 0) return "Not opened yet";
  const last = link.accessLog[link.accessLog.length - 1];
  const times =
    link.openedCount === 1
      ? "Opened once"
      : link.openedCount === 2
        ? "Opened twice"
        : `Opened ${link.openedCount} times`;
  return `${times} — ${last.location}, ${dayMonth(last.at)}`;
}

export default function ShareLinksSection() {
  const [links, setLinks] = useState<ShareLink[] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/share");
      const data = await res.json().catch(() => ({}));
      if (res.ok) setLinks(data.links ?? []);
    } catch {
      setLinks([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCreate() {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch("/api/v1/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setNotice(`Link created — ${data.url}`);
        await load();
      } else {
        setNotice(
          typeof data.message === "string"
            ? data.message
            : "Something went wrong — try again in a moment."
        );
      }
    } catch {
      setNotice("Something went wrong — try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRevoke(token: string) {
    setBusy(true);
    try {
      await fetch(`/api/v1/share/${encodeURIComponent(token)}`, {
        method: "DELETE",
      });
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mb-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-[13.5px] font-bold">Share with your GP</h2>
        <button
          type="button"
          onClick={() => void handleCreate()}
          disabled={busy}
          className="cursor-pointer rounded-pill bg-forest px-[14px] py-[7px] text-[11.5px] font-semibold text-white disabled:opacity-60"
        >
          Create secure link
        </button>
      </div>
      <p className="mb-3 text-[12px] leading-[1.5] text-caption">
        A read-only clinician summary — shared by revocable link, not a
        screenshot of an app. Links expire after 30 days, or when you revoke
        them.
      </p>
      <p aria-live="polite" className={notice ? "mb-3 break-all text-[12px] text-caption" : "sr-only"}>
        {notice}
      </p>

      {links === null ? (
        <p className="text-[12px] text-caption" aria-live="polite">
          Loading your links…
        </p>
      ) : links.length === 0 ? (
        <p className="text-[12px] text-caption">No share links yet.</p>
      ) : (
        <ul>
          {links.map((link) => (
            <li
              key={link.token}
              className="mb-[10px] flex items-center justify-between gap-3 rounded-[12px] border border-hairline-mid bg-white p-[14px]"
            >
              <div className="min-w-0">
                <div className="truncate font-mono text-[12px]">
                  /s/{link.token}
                  <span
                    className={`ml-2 font-sans text-[10px] font-bold tracking-[0.06em] ${
                      link.active ? "text-forest" : "text-[#B3543A]"
                    }`}
                  >
                    {link.active
                      ? `EXPIRES ${dayMonth(link.expiresAt).toUpperCase()}`
                      : link.revoked
                        ? "REVOKED"
                        : "EXPIRED"}
                  </span>
                </div>
                <div className="mt-[2px] text-[11.5px] text-caption">
                  {openedLabel(link)}
                </div>
              </div>
              {link.active ? (
                <button
                  type="button"
                  onClick={() => void handleRevoke(link.token)}
                  disabled={busy}
                  className="shrink-0 cursor-pointer text-[11.5px] font-semibold text-[#B3543A] disabled:opacity-60"
                >
                  Revoke
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
