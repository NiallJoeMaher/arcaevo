import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import LoginForm from "./LoginForm";

export const metadata: Metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

const MONO = "var(--font-mono)";

export default async function AdminLoginPage() {
  // Already signed in ⇒ straight to the dashboard.
  if (await isAdmin()) redirect("/admin");

  return (
    <div
      style={{
        fontFamily: "var(--font-sans)",
        background: "#EDE9E1",
        color: "#1C2620",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div
          style={{
            background: "#FBFAF6",
            border: "1px solid rgba(28,38,32,0.08)",
            borderRadius: 16,
            padding: "28px 28px 26px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 18,
            }}
          >
            <span style={{ fontWeight: 600, fontSize: 16 }}>Arcaevo</span>
            <span
              style={{
                fontFamily: MONO,
                fontSize: 9,
                letterSpacing: "0.1em",
                color: "#7C887F",
                border: "1px solid rgba(28,38,32,0.16)",
                borderRadius: 5,
                padding: "2px 5px",
              }}
            >
              ADMIN
            </span>
          </div>
          <div
            style={{
              fontFamily: MONO,
              fontSize: 10,
              letterSpacing: "0.1em",
              color: "#7C887F",
              marginBottom: 4,
            }}
          >
            ADMIN ACCESS
          </div>
          <h1
            style={{
              fontSize: 20,
              fontWeight: 700,
              letterSpacing: "-0.01em",
              margin: "0 0 18px",
            }}
          >
            Sign in to continue
          </h1>
          <LoginForm />
        </div>
        <Link
          href="/"
          style={{
            display: "inline-block",
            marginTop: 16,
            fontFamily: MONO,
            fontSize: 10,
            letterSpacing: "0.08em",
            color: "#7C887F",
            textDecoration: "none",
          }}
        >
          ← BACK TO SITE
        </Link>
      </div>
    </div>
  );
}
