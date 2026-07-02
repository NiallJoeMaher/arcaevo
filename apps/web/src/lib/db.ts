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
  ShareLink,
  MagicLinkToken,
  Session,
  EligibilityConfig,
  EligibilityRejection,
  BloodworkUpload,
} from "@/lib/models";

const DEFAULT_URI = "mongodb://localhost:27017/arcaevo";

function mongoUri(): string {
  return process.env.MONGODB_URI ?? DEFAULT_URI;
}

/**
 * Cache the client promise on globalThis so Next.js dev-mode HMR (which
 * re-evaluates modules) doesn't leak connections. Standard driver pattern.
 */
const globalForMongo = globalThis as unknown as {
  _arcaevoMongoClientPromise?: Promise<MongoClient>;
};

export function getClient(): Promise<MongoClient> {
  if (!globalForMongo._arcaevoMongoClientPromise) {
    const client = new MongoClient(mongoUri());
    globalForMongo._arcaevoMongoClientPromise = client.connect();
  }
  return globalForMongo._arcaevoMongoClientPromise;
}

export async function getDb(): Promise<Db> {
  const client = await getClient();
  // Db name comes from the URI path (default "arcaevo" via DEFAULT_URI).
  return client.db();
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
  shareLinks: () => collection<ShareLink>("share_links"),
  magicLinkTokens: () => collection<MagicLinkToken>("magic_link_tokens"),
  sessions: () => collection<Session>("sessions"),
  /** Eircode routing-key allowlist — config, not code (seeded). */
  eligibilityConfig: () => collection<EligibilityConfig>("eligibility_config"),
  /** Rejected routing keys (key only, no address) — demand signal. */
  eligibilityRejections: () =>
    collection<EligibilityRejection>("eligibility_rejections"),
  bloodworkUploads: () => collection<BloodworkUpload>("bloodwork_uploads"),
};

/** Close the shared client (used by scripts like seed.ts; not by the app). */
export async function closeClient(): Promise<void> {
  if (globalForMongo._arcaevoMongoClientPromise) {
    const client = await globalForMongo._arcaevoMongoClientPromise;
    await client.close();
    globalForMongo._arcaevoMongoClientPromise = undefined;
  }
}
