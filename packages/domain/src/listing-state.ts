import type { Role } from "./enums";

export const LISTING_STATUSES = [
  "DRAFT", "PENDING_REVIEW", "CHANGES_REQUESTED", "PUBLISHED", "REJECTED",
  "PAUSED", "EXPIRED", "SOLD", "RENTED", "ARCHIVED",
] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

export type ListingAction =
  | "SUBMIT" | "APPROVE" | "REQUEST_CHANGES" | "REJECT" | "PAUSE" | "RESUME"
  | "EXPIRE" | "RENEW" | "MARK_SOLD" | "MARK_RENTED" | "ARCHIVE" | "EDIT_MATERIAL";

type Actor = "OWNER" | "MODERATOR" | "SYSTEM";

interface Transition { from: readonly ListingStatus[]; to: ListingStatus; by: readonly Actor[] }

export const TRANSITIONS: Record<ListingAction, Transition> = {
  SUBMIT:          { from: ["DRAFT", "CHANGES_REQUESTED"], to: "PENDING_REVIEW", by: ["OWNER"] },
  APPROVE:         { from: ["PENDING_REVIEW"], to: "PUBLISHED", by: ["MODERATOR"] },
  REQUEST_CHANGES: { from: ["PENDING_REVIEW"], to: "CHANGES_REQUESTED", by: ["MODERATOR"] },
  REJECT:          { from: ["PENDING_REVIEW"], to: "REJECTED", by: ["MODERATOR"] },
  PAUSE:           { from: ["PUBLISHED"], to: "PAUSED", by: ["OWNER", "MODERATOR"] },
  RESUME:          { from: ["PAUSED"], to: "PUBLISHED", by: ["OWNER"] },
  EXPIRE:          { from: ["PUBLISHED", "PAUSED"], to: "EXPIRED", by: ["SYSTEM"] },
  RENEW:           { from: ["EXPIRED"], to: "PENDING_REVIEW", by: ["OWNER"] },
  MARK_SOLD:       { from: ["PUBLISHED", "PAUSED", "EXPIRED"], to: "SOLD", by: ["OWNER"] },
  MARK_RENTED:     { from: ["PUBLISHED", "PAUSED", "EXPIRED"], to: "RENTED", by: ["OWNER"] },
  ARCHIVE:         { from: ["DRAFT", "CHANGES_REQUESTED", "REJECTED", "PAUSED", "EXPIRED", "SOLD", "RENTED", "PUBLISHED"], to: "ARCHIVED", by: ["OWNER", "MODERATOR"] },
  EDIT_MATERIAL:   { from: ["PUBLISHED", "PAUSED"], to: "PENDING_REVIEW", by: ["OWNER"] },
};

export class TransitionError extends Error {
  constructor(public action: ListingAction, public from: ListingStatus, reason: string) {
    super(`Cannot ${action} a listing in ${from}: ${reason}`);
  }
}

/** Returns the next status or throws if the action is not allowed. */
export function nextStatus(from: ListingStatus, action: ListingAction, actor: Actor): ListingStatus {
  const t = TRANSITIONS[action];
  if (!t.from.includes(from)) throw new TransitionError(action, from, "invalid current status");
  if (!t.by.includes(actor)) throw new TransitionError(action, from, `not allowed for ${actor.toLowerCase()}`);
  return t.to;
}

export function actorFor(isOwner: boolean, roles: readonly Role[]): Actor | null {
  if (isOwner) return "OWNER";
  if (roles.includes("MODERATOR") || roles.includes("ADMIN")) return "MODERATOR";
  return null;
}

/** Statuses an owner may edit freely (edits do not need re-review). */
export const FREELY_EDITABLE: readonly ListingStatus[] = ["DRAFT", "CHANGES_REQUESTED", "REJECTED"];
/** Statuses that accept new enquiries. */
export const ENQUIRABLE: readonly ListingStatus[] = ["PUBLISHED"];
/** Material fields: changing these on a live listing sends it back to review. */
export const MATERIAL_FIELDS = ["category", "transaction", "localityId", "address", "pricePaise", "rentPaise", "leasePaise", "title", "description", "media"] as const;

export const LISTING_TTL_DAYS = 90;
