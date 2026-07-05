/**
 * Shared presentational pieces for the product web app (design_handoff_v2
 * AccountFlows §03–§17). These screens deliberately do NOT use SiteNav /
 * SiteFooter — the designs show a minimal surface: the orb, the screen, done.
 *
 * Pure markup only (no hooks) so everything here works in both server and
 * client components.
 */
import Link from "next/link";

/** The Arcaevo brand mark — the only logo on product screens (§03 W1). */
export function Orb({ size = 20 }: { size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand-mark.svg"
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      className="block rounded-full"
      style={{ width: size, height: size }}
    />
  );
}

/**
 * Minimal logo header + centered card column for auth/consent/checkout
 * screens. `width` matches the design mock's screen width (360 for auth,
 * wider for account surfaces).
 */
export function AuthShell({
  children,
  width = 400,
}: {
  children: React.ReactNode;
  width?: number;
}) {
  return (
    <div className="flex min-h-screen w-full flex-col bg-bone font-sans text-ink">
      <header className="mx-auto flex w-full max-w-[1180px] items-center px-6 py-5 sm:px-10">
        <Link
          href="/"
          className="flex items-center gap-[11px] text-ink no-underline"
        >
          <Orb />
          <span className="text-[17px] font-semibold tracking-[-0.01em]">
            Arcaevo
          </span>
        </Link>
      </header>
      <main className="flex w-full flex-1 items-start justify-center px-4 pb-20 pt-6 sm:pt-10">
        <div className="w-full" style={{ maxWidth: width }}>
          {children}
        </div>
      </main>
    </div>
  );
}

/** The screen card itself — §03's browser-mock inner panel. */
export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-[16px] border border-hairline-mid bg-surface shadow-[0_22px_44px_-32px_rgba(28,38,32,0.4)] ${className}`}
    >
      {children}
    </div>
  );
}

/* ── shared class strings (mock-derived) ─────────────────────────── */

export const labelCls = "mb-[6px] block text-[12px] font-semibold text-ink";
export const inputCls =
  "mb-[14px] block w-full rounded-[10px] border border-hairline-strong bg-white px-[14px] py-[11px] text-[13px] text-ink placeholder:text-[#7C887F]";
export const primaryBtnCls =
  "block w-full cursor-pointer rounded-pill bg-forest py-[13px] text-center text-[14px] font-semibold text-white disabled:cursor-default disabled:opacity-60";
export const secondaryBtnCls =
  "block w-full cursor-pointer rounded-pill border border-hairline-strong bg-transparent py-3 text-center text-[13.5px] font-semibold text-ink disabled:cursor-default disabled:opacity-60";
export const kickerCls =
  "mb-[14px] font-mono text-[10px] tracking-[0.12em] text-forest";
export const errorCls = "mb-3 text-[12.5px] leading-[1.5] text-[#B3543A]";
