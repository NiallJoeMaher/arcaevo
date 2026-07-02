"use client";

import { useRouter } from "next/navigation";

export default function SignOutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        await fetch("/api/v1/auth/signout", { method: "POST" });
        router.push("/signin");
      }}
      className="cursor-pointer rounded-pill border border-hairline-strong px-4 py-2 text-[12px] font-semibold text-ink"
    >
      Sign out
    </button>
  );
}
