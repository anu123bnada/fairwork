import "server-only";

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createServerSupabase } from "@/server/supabase";
import { AppError } from "@/lib/errors";
import {
  buildManualOfferReview,
  confirmAgreement,
  computeOfferHash,
  type AgreementConfirmation,
  type ManualOfferRequest,
} from "@/features/offer/schema";

type Membership = {
  userId: string;
  companyId?: string;
  workerId?: string;
  role: "EMPLOYER" | "WORKER";
  active: boolean;
};

type StoredOffer = {
  offerId: string;
  companyId: string;
  workerId: string;
  version: number;
  requesterId: string;
  requesterRole: "EMPLOYER" | "WORKER";
  snapshot: Record<string, string | number>;
  termHash: string;
  unresolved: Array<{ id: string; field: string; question: string; required: boolean }>;
  createdAt: number;
};

type StoredAgreement = {
  agreementId: string;
  offerId: string;
  companyId: string;
  workerId: string;
  version: number;
  confirmedBy: string;
  confirmationRole: "EMPLOYER" | "WORKER";
  currentHash: string;
  status: "awaiting_other_party" | "confirmed";
  createdAt: number;
};

const OFFER_STORE_PATH = process.env.FAIRWORK_OFFER_STORE_PATH ?? join(process.cwd(), ".tmp", "day3-offer-store.json");

const membershipRegistry = new Map<string, Membership>();
const offerLedger = new Map<string, StoredOffer>();
const agreementLedger = new Map<string, StoredAgreement>();
const idempotencyLedger = new Map<string, { command: string; actorId: string; requestHash: string; resultKey: string }>();
let localStoreHydrated = false;

function persistLocalOfferState() {
  mkdirSync(dirname(OFFER_STORE_PATH), { recursive: true });
  const snapshot = {
    membershipRegistry: [...membershipRegistry.values()],
    offerLedger: [...offerLedger.values()],
    agreementLedger: [...agreementLedger.values()],
    idempotencyLedger: Object.fromEntries(idempotencyLedger.entries()),
  };
  writeFileSync(/* turbopackIgnore: true */ OFFER_STORE_PATH, JSON.stringify(snapshot, null, 2), "utf8");
}

function hydrateLocalOfferState() {
  if (!existsSync(/* turbopackIgnore: true */ OFFER_STORE_PATH)) return;
  const content = readFileSync(/* turbopackIgnore: true */ OFFER_STORE_PATH, "utf8");
  if (!content.trim()) return;
  const snapshot = JSON.parse(content) as {
    membershipRegistry?: Membership[];
    offerLedger?: StoredOffer[];
    agreementLedger?: StoredAgreement[];
    idempotencyLedger?: Record<string, { command: string; actorId: string; requestHash: string; resultKey: string }>;
  };
  if (Array.isArray(snapshot.membershipRegistry)) {
    for (const membership of snapshot.membershipRegistry) {
      membershipRegistry.set(membership.userId, membership);
    }
  }
  if (Array.isArray(snapshot.offerLedger)) {
    for (const offer of snapshot.offerLedger) {
      offerLedger.set(offer.offerId, offer);
    }
  }
  if (Array.isArray(snapshot.agreementLedger)) {
    for (const agreement of snapshot.agreementLedger) {
      agreementLedger.set(agreement.agreementId, agreement);
    }
  }
  if (snapshot.idempotencyLedger) {
    for (const [key, value] of Object.entries(snapshot.idempotencyLedger)) {
      idempotencyLedger.set(key, value);
    }
  }
}

function requireLocalDemoMode() {
  if (process.env.NODE_ENV === "production" || process.env.FAIRWORK_LOCAL_OFFER_DEMO !== "true") {
    throw new AppError("SERVICE_UNAVAILABLE", 503);
  }
  if (!localStoreHydrated) {
    hydrateLocalOfferState();
    localStoreHydrated = true;
  }
}

export function resetLocalOfferState() {
  requireLocalDemoMode();
  membershipRegistry.clear();
  offerLedger.clear();
  agreementLedger.clear();
  idempotencyLedger.clear();
  persistLocalOfferState();
}

export function configureLocalMembership(membership: Membership) {
  requireLocalDemoMode();
  membershipRegistry.set(membership.userId, membership);
  persistLocalOfferState();
}

export function isLocalActorAuthorized(userId: string, role: "EMPLOYER" | "WORKER", companyId?: string, workerId?: string) {
  requireLocalDemoMode();
  const membership = membershipRegistry.get(userId);
  if (!membership || !membership.active) return false;
  if (role === "EMPLOYER") return membership.role === "EMPLOYER" && membership.companyId === companyId && membership.userId === userId;
  return membership.role === "WORKER" && membership.workerId === workerId && membership.userId === userId;
}

export function getStoredOffer(offerId: string) {
  requireLocalDemoMode();
  return offerLedger.get(offerId);
}

export function getStoredAgreement(agreementId: string) {
  requireLocalDemoMode();
  return agreementLedger.get(agreementId);
}

function requireAuthenticatedActor() {
  return createServerSupabase(false).then(async (supabase) => {
    const { data, error } = await supabase.auth.getUser();
    if (error && (error.status ?? 0) >= 500) throw new AppError("SERVICE_UNAVAILABLE", 503);
    if (error || !data.user || data.user.is_anonymous) throw new AppError("AUTH_REQUIRED", 401);
    return data.user.id;
  });
}

export async function authenticateAndAuthorizeManualOffer(input: ManualOfferRequest) {
  requireLocalDemoMode();
  const actorId = await requireAuthenticatedActor();
  if (!isLocalActorAuthorized(actorId, input.requesterRole, input.companyId, input.workerId)) {
    throw new AppError("ACTION_FORBIDDEN", 403);
  }
  const review = buildManualOfferReview(input, actorId);
  const requestHash = computeOfferHash(review.snapshot);
  const key = `${actorId}:create_offer:${input.idempotencyKey}`;
  const existing = idempotencyLedger.get(key);
  if (existing) {
    if (existing.requestHash !== requestHash) throw new AppError("IDEMPOTENCY_CONFLICT", 409);
    return { ...review, idempotent: true, previousResult: existing.resultKey };
  }
  offerLedger.set(input.offerId, {
    offerId: review.offerId,
    companyId: review.companyId,
    workerId: review.workerId,
    version: review.version,
    requesterId: review.requesterId,
    requesterRole: review.requesterRole,
    snapshot: review.snapshot,
    termHash: review.termHash,
    unresolved: review.unresolved,
    createdAt: Date.now(),
  });
  idempotencyLedger.set(key, { command: "create_offer", actorId, requestHash, resultKey: input.offerId });
  persistLocalOfferState();
  return { ...review, idempotent: false };
}

export async function authenticateAndAuthorizeAgreement(input: AgreementConfirmation) {
  requireLocalDemoMode();
  const actorId = await requireAuthenticatedActor();
  if (input.companyId === input.workerId) throw new AppError("VALIDATION_FAILED", 422);
  if (input.confirmationRole === "EMPLOYER" && !isLocalActorAuthorized(actorId, "EMPLOYER", input.companyId, input.workerId)) {
    throw new AppError("ACTION_FORBIDDEN", 403);
  }
  if (input.confirmationRole === "WORKER" && !isLocalActorAuthorized(actorId, "WORKER", input.companyId, input.workerId)) {
    throw new AppError("ACTION_FORBIDDEN", 403);
  }
  const previousOffer = offerLedger.get(input.offerId);
  if (!previousOffer) throw new AppError("NOT_FOUND", 404);
  if (input.expectedVersion !== previousOffer.version) throw new AppError("VERSION_CONFLICT", 409);
  const authoritativeHash = previousOffer.termHash;
  const decision = confirmAgreement(input, actorId, authoritativeHash, "awaiting_other_party");
  const key = `${actorId}:${"confirm_agreement"}:${input.idempotencyKey}`;
  if (idempotencyLedger.has(key)) {
    return { ...decision, idempotent: true, previousResult: agreementLedger.get(input.agreementId)?.agreementId ?? input.agreementId };
  }
  const savedAgreement: StoredAgreement = {
    agreementId: input.agreementId,
    offerId: input.offerId,
    companyId: input.companyId,
    workerId: input.workerId,
    version: decision.version,
    confirmedBy: actorId,
    confirmationRole: input.confirmationRole,
    currentHash: authoritativeHash,
    status: "awaiting_other_party",
    createdAt: Date.now(),
  };
  agreementLedger.set(input.agreementId, savedAgreement);
  idempotencyLedger.set(key, { command: "confirm_agreement", actorId, requestHash: input.idempotencyKey, resultKey: input.agreementId });
  persistLocalOfferState();
  return { ...decision, idempotent: false, currentHash: authoritativeHash };
}
