/**
 * MongoDB connection singleton + typed collection accessors.
 *
 * Local dev: docker-compose Mongo 7 at mongodb://localhost:27017/arcaevo.
 * Prod: MongoDB Atlas (eu-west-1) — connection string via MONGODB_URI
 * (see infra/cdk: the secret placeholder lives in Secrets Manager).
 */
import { MongoClient, type Db, type Collection, type Document } from "mongodb";
import type {
  User,
  Membership,
  TestOrder,
  BiomarkerReading,
  BiomarkerRule,
  WearableSignal,
  SupportTicket,
  OutboxEmail,
  Consent,
  WaitlistEntry,
  GiftCode,
  ReferralCode,
  Referral,
  ShareLink,
  MagicLinkToken,
  Session,
  EligibilityConfig,
  EligibilityRejection,
  BloodworkUpload,
  ErasureJob,
  Admin,
  AdminAccessLog,
} from "@/lib/models";

const DEFAULT_URI = "mongodb://localhost:27017/arcaevo";

function mongoUri(): string {
  return process.env.MONGODB_URI ?? DEFAULT_URI;
}

/**
 * Per-operation read override: pin a read to the PRIMARY replica.
 *
 * WHY: in production the Atlas cluster may serve reads from multi-region
 * SECONDARY replicas (see docs/MONGO_CONSISTENCY.md) if the connection string
 * sets `readPreference=secondary/secondaryPreferred/nearest`. A secondary can
 * lag the primary by a few seconds, so a read issued immediately after a write
 * can land on a replica that hasn't received it yet and MISS the just-written
 * doc. Passing this on the specific read-after-write calls that MUST be
 * consistent (auth sessions, magic-link tokens, membership activation, upload
 * confirmation) overrides the client/URI default for that one operation, so
 * those reads are correct even when everything else is served from replicas.
 * Combined with the client's `w:"majority"` write concern (a write is
 * acknowledged by a majority before returning), a subsequent primary read is
 * guaranteed to observe it. This is the ONLY read override we apply — bulk /
 * list / analytics reads deliberately keep the URI's read preference so the
 * geo replicas still absorb that traffic. If you later want even these pinned
 * reads served from replicas, switch to causally-consistent sessions instead
 * (see docs/MONGO_CONSISTENCY.md).
 */
export const PRIMARY_READ = { readPreference: "primary" as const };

/**
 * Cache the client promise on globalThis so Next.js dev-mode HMR (which
 * re-evaluates modules) doesn't leak connections. Standard driver pattern.
 */
const globalForMongo = globalThis as unknown as {
  _arcaevoMongoClientPromise?: Promise<MongoClient>;
};

export function getClient(): Promise<MongoClient> {
  if (!globalForMongo._arcaevoMongoClientPromise) {
    // Durability defaults — safe whether reads go to PRIMARY (driver default)
    // or to geo SECONDARY replicas (if the URI sets a secondary read pref):
    //  - writeConcern w:"majority" — a write returns only once a majority of
    //    replicas have it, so it's durable across a region loss AND a later
    //    primary read always observes it (the basis for our PRIMARY_READ pins).
    //  - retryWrites / retryReads — the driver transparently retries a write or
    //    read once on a transient network blip or a replica-set failover/election
    //    (routine on a multi-region Atlas cluster), so a step-down doesn't surface
    //    as a user-facing error.
    // No client-level readPreference is set on purpose: the URI decides where
    // non-critical reads go; only the correctness-critical read-after-write
    // calls pin themselves to primary via PRIMARY_READ.
    const client = new MongoClient(mongoUri(), {
      writeConcern: { w: "majority" },
      retryWrites: true,
      retryReads: true,
    });
    globalForMongo._arcaevoMongoClientPromise = client.connect();
  }
  return globalForMongo._arcaevoMongoClientPromise;
}

export async function getDb(): Promise<Db> {
  const client = await getClient();
  // Db name comes from the URI path (default "arcaevo" via DEFAULT_URI).
  return client.db();
}

/**
 * IP/global rate-limit counter (fixed-window). One doc per (scope, identifier,
 * window). `expiresAt` drives a TTL index so stale counters self-clean; the
 * window decision is computed in-query, never left to the TTL sweep. Stored in
 * Mongo (not in-memory) so limits hold across stateless serverless invocations.
 */
export interface RateLimitRecord extends Document {
  _id: string; // `${scope}:${identifier}:${windowStartMs}`
  scope: string;
  identifier: string;
  count: number;
  windowStart: Date;
  expiresAt: Date;
}

/**
 * Webhook idempotency ledger. One doc per Stripe event id we've fully applied,
 * so an at-least-once retry (Stripe re-delivers on any non-2xx, or on its own
 * schedule) can't re-run a side-effecting handler — most importantly the
 * `invoice.paid` renewal, which would otherwise push the period forward a whole
 * year on every duplicate. `_id` IS the event id, so Mongo's built-in unique
 * `_id` index does the deduplication (no extra index needed).
 */
export interface ProcessedWebhookEvent extends Document {
  _id: string; // Stripe event id, e.g. "evt_1PxYz…"
  type: string;
  processedAt: Date;
}

/**
 * AI-narration cache (src/lib/ai-narration.ts). One doc per unique
 * (normalised insight facts + model id) — `_id` IS the sha256 cache key, so
 * Mongo's built-in unique `_id` index does the lookup and dedup (no extra
 * index needed). Content-addressed and member-free by construction: the
 * hashed input carries NO member ids/PII (see vendors/ai-narration.ts), so
 * entries are safely shared across members and nothing here is subject to
 * per-member erasure.
 */
export interface NarrationCacheDoc extends Document {
  _id: string; // sha256(normalized NarrationInput + model id)
  text: string;
  modelId: string;
  createdAt: Date;
}

/** Mock-vendor internal state (LetsGetChecked fake order machine). */
export interface LgcMockOrder extends Document {
  _id: string; // vendor order id, e.g. "lgc_mock_0001"
  memberId: string;
  panel: string;
  /** Index into ORDER_STATUS_SEQUENCE — advanced deterministically. */
  statusIndex: number;
  createdAt: Date;
}

async function collection<T extends Document>(
  name: string
): Promise<Collection<T>> {
  const db = await getDb();
  return db.collection<T>(name);
}

// Typed collection accessors — the only sanctioned way to touch Mongo.
export const collections = {
  users: () => collection<User>("users"),
  memberships: () => collection<Membership>("memberships"),
  testOrders: () => collection<TestOrder>("test_orders"),
  biomarkerReadings: () => collection<BiomarkerReading>("biomarker_readings"),
  biomarkerRules: () => collection<BiomarkerRule>("biomarker_rules"),
  wearableSignals: () => collection<WearableSignal>("wearable_signals"),
  supportTickets: () => collection<SupportTicket>("support_tickets"),
  /** MOCK: email.mock.ts writes here instead of sending real email. */
  outbox: () => collection<OutboxEmail>("outbox"),
  /** MOCK: letsgetchecked.mock.ts fake order state machine. */
  lgcMockOrders: () => collection<LgcMockOrder>("vendor_lgc_mock_orders"),
  // --- v2 (accounts, auth, commerce) ---------------------------------------
  consents: () => collection<Consent>("consents"),
  waitlist: () => collection<WaitlistEntry>("waitlist"),
  giftCodes: () => collection<GiftCode>("gift_codes"),
  referralCodes: () => collection<ReferralCode>("referral_codes"),
  /** Attributed referrals (one per referred member — see src/lib/referral.ts). */
  referrals: () => collection<Referral>("referrals"),
  shareLinks: () => collection<ShareLink>("share_links"),
  magicLinkTokens: () => collection<MagicLinkToken>("magic_link_tokens"),
  sessions: () => collection<Session>("sessions"),
  /** Eircode routing-key allowlist — config, not code (seeded). */
  eligibilityConfig: () => collection<EligibilityConfig>("eligibility_config"),
  /** Rejected routing keys (key only, no address) — demand signal. */
  eligibilityRejections: () =>
    collection<EligibilityRejection>("eligibility_rejections"),
  bloodworkUploads: () => collection<BloodworkUpload>("bloodwork_uploads"),
  /** GDPR right-to-erasure queue — drained by scripts/run-erasure.ts. */
  erasureJobs: () => collection<ErasureJob>("erasure_jobs"),
  /** IP/global rate-limit counters (fixed-window) — see src/lib/rate-limit.ts. */
  rateLimits: () => collection<RateLimitRecord>("rate_limits"),
  // --- admin auth (per-admin accounts, roles, access log) ------------------
  /** Per-admin accounts (scrypt password, role). See src/lib/admin-auth.ts. */
  admins: () => collection<Admin>("admins"),
  /** Per-record admin access log (DPIA R4). See src/lib/admin-audit.ts. */
  adminAccessLog: () => collection<AdminAccessLog>("admin_access_log"),
  /** Stripe webhook idempotency ledger. See webhooks/stripe/route.ts. */
  processedWebhookEvents: () =>
    collection<ProcessedWebhookEvent>("processed_webhook_events"),
  /** AI-narration cache (content-addressed, PII-free). See src/lib/ai-narration.ts. */
  narrations: () => collection<NarrationCacheDoc>("narrations"),
};

/** Close the shared client (used by scripts like seed.ts; not by the app). */
export async function closeClient(): Promise<void> {
  if (globalForMongo._arcaevoMongoClientPromise) {
    const client = await globalForMongo._arcaevoMongoClientPromise;
    await client.close();
    globalForMongo._arcaevoMongoClientPromise = undefined;
  }
}
