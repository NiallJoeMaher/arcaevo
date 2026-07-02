# Arcaevo — agent guide

Health membership for Ireland: Apple Watch + finger-prick blood tests fused into baseline-relative insights. Wellness positioning, never diagnosis — keep every disclaimer; WHOOP/Oura/Garmin are only ever "on the roadmap" (v1 = Apple Health only).

## Read first
- `docs/BUILD_STATE.md` — build progress + locked architecture decisions. Update it when you change state.
- `docs/MOCKED_APIS.md` — every integration is MOCKED (LetsGetChecked, Stripe, email, member/admin auth, clinician review). Update it when touching vendor code.
- `design_handoff/` — the pixel-fidelity source of truth for all web UI; copy is verbatim, prices are contractual (€119/€329/€399, +€130, €99/€69/€199).

## Commands (from repo root)
```bash
docker compose up --build          # full stack: web :3000, mongo host :27019, mongo-express :8083
cd apps/web && npm run dev         # dev server (needs MONGODB_URI=mongodb://localhost:27019/arcaevo)
cd apps/web && npm run seed        # deterministic demo data (demo member: Aoife Byrne / demo-member-token)
cd apps/web && npm test            # vitest unit suite
cd apps/web && npm run e2e         # Playwright (builds prod, seeds, serves, tests)
cd apps/ios && xcodegen generate   # then open Arcaevo.xcodeproj
cd infra/cdk && npx cdk synth
```

## Gotchas
- Host ports are non-default on purpose (27017/27018/8081/8082 are held by other local projects). Never stop those other containers.
- `apps/web/AGENTS.md`: this Next.js version has breaking changes — check `node_modules/next/dist/docs/` before assuming conventions.
- Admin login: `ADMIN_PASSWORD` env (compose: `change-me-local`); session is an HMAC cookie (`SESSION_SECRET`).
- Caption/footer grays deviate slightly from the design tokens for WCAG 4.5:1 (documented in BUILD_STATE) — don't revert.
- Hosting: Vercel (dub1) is primary for web; keep the Dockerfile/compose path working as the AWS escape hatch.
