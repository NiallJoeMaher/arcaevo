/**
 * Account — one surface, web and app (design §10 W10).
 * The sidebar lists the designed sections; the three that exist at launch
 * are live links, the rest are visibly not-yet (never fake, never a dead
 * click). Auth-gating happens in each page (redirect → /signin).
 */
import Link from "next/link";
import { Orb } from "@/components/account/ui";
import SignOutButton from "@/components/account/SignOutButton";
import AccountNav from "./AccountNav";

export default function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen w-full flex-col bg-bone font-sans text-ink">
      <header className="mx-auto flex w-full max-w-[1180px] items-center justify-between px-6 py-5 sm:px-10">
        <Link href="/" className="flex items-center gap-[11px] text-ink no-underline">
          <Orb />
          <span className="text-[17px] font-semibold tracking-[-0.01em]">
            Arcaevo
          </span>
        </Link>
        <SignOutButton />
      </header>
      <main className="mx-auto w-full max-w-[860px] flex-1 px-4 pb-20 pt-6 sm:px-6">
        <div className="overflow-hidden rounded-[16px] border border-hairline-mid bg-surface shadow-[0_22px_44px_-32px_rgba(28,38,32,0.4)]">
          <div className="grid sm:grid-cols-[170px_1fr]">
            <AccountNav />
            <div className="p-6 sm:px-[26px]">{children}</div>
          </div>
        </div>
      </main>
    </div>
  );
}
