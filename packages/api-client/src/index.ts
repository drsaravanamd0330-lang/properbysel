import type { ListingStatus, PropertyCategory, TransactionType, AdvertiserType, LeadStage, AreaUnit } from "@pbs/domain";
import type { ListingDraftInput } from "@pbs/validation";

export interface ApiErrorBody { code: string; message: string; details?: unknown }
export class ApiError extends Error {
  constructor(public status: number, public body: ApiErrorBody) { super(body.message); }
  get fieldErrors(): Record<string, string> {
    const out: Record<string, string> = {};
    if (Array.isArray(this.body.details)) for (const d of this.body.details as { path: string; message: string }[]) out[d.path] = d.message;
    return out;
  }
}

export interface PublicListing {
  id: string; path: string; title: string | null; description: string | null; status: ListingStatus;
  advertiserType: AdvertiserType | null; advertiserName: string | null; transaction: TransactionType | null; category: PropertyCategory | null;
  city: { name: string; slug: string } | null; locality: { name: string; slug: string } | null; postcode: string | null; landmark: string | null;
  approxLat: number | null; approxLng: number | null; attributes: Record<string, unknown>; amenities: string[];
  bedrooms: number | null; furnishing: string | null; areaSqft: number | null; areaValue: number | null; areaUnit: AreaUnit | null;
  pricePaise: number | null; rentPaise: number | null; leasePaise: number | null; depositPaise: number | null; maintenancePaise: number | null;
  negotiable: boolean; brokerageDisclosure: string | null; availableFrom: string | null; investmentSuitable: boolean; canShowPhone: boolean;
  isSponsored: boolean; isDemo: boolean; verifications: string[]; media: { id: string; url: string; kind: string; width: number | null; height: number | null }[];
  publishedAt: string | null; updatedAt: string;
}
export interface OwnerListing extends PublicListing {
  address: string | null; lat: number | null; lng: number | null; cityId: string | null; localityId: string | null;
  showPhone: boolean; contactConsent: boolean; wizardStep: number; submittedAt: string | null; expiresAt: string | null; ownerId: string; createdAt: string;
  enquiryCount?: number; lastReview?: { decision: string; note: string | null; at: string } | null; notice?: string;
}
export interface Plan { code: string; name: string; description: string; kind: "FEATURED_LISTING" | "ADVERTISER_SUBSCRIPTION" | "MANUAL_SERVICE"; pricePaise: number; taxPaise: number; totalPaise: number; gstRateBps: number; durationDays: number; listingQuota: number | null }
export type OrderStatus = "CREATED" | "PENDING" | "PAID" | "FAILED" | "REFUNDED" | "CANCELLED";
export interface Order {
  id: string; status: OrderStatus; amountPaise: number; taxPaise: number; totalPaise: number; invoiceNumber: string | null; listingId: string | null; createdAt: string;
  plan: { code: string; name: string; kind: Plan["kind"] }; entitlement: { startsAt: string; endsAt: string; revoked: boolean } | null;
}
export interface SearchResult { items: PublicListing[]; total: number; page: number; pageSize: number; totalPages: number }
export interface InboxItem {
  id: string; stage: LeadStage; leadNotes: string | null; createdAt: string; conversationId: string;
  listing: { id: string; title: string | null; status: ListingStatus }; buyer: { name: string; phone: string | null };
  lastMessage: { body: string; at: string; fromMe: boolean } | null; unread: boolean;
}
export interface Visit { id: string; status: string; proposedAt: string; requestedBy: string; note: string | null }
export interface ConversationView {
  id: string; listing: { id: string; title: string | null; status: ListingStatus } | null; enquiryId: string | null; myRole: "ADVERTISER" | "BUYER";
  participants: { id: string; name: string; isMe: boolean }[]; blocked: boolean; visits: Visit[];
  messages: { id: string; body: string; at: string; fromMe: boolean }[];
}
export interface Me { id: string; name: string | null; phone: string; email: string | null; roles: string[] }
export interface City { id: string; name: string; slug: string; state: string }
export interface Locality { id: string; name: string; slug: string; postcodes: string[] }
export interface Notification { id: string; type: string; title: string; body: string; link: string | null; readAt: string | null; createdAt: string }

export interface ClientOptions {
  baseUrl: string;
  getToken?: () => string | null | Promise<string | null>;
  onUnauthorized?: () => Promise<boolean>; // return true if the request should be retried (token refreshed)
  fetch?: typeof fetch;
}

export function createClient(opts: ClientOptions) {
  const f = opts.fetch ?? fetch;
  async function req<T>(method: string, path: string, body?: unknown, extra: { headers?: Record<string, string>; retry?: boolean } = {}): Promise<T> {
    const token = opts.getToken ? await opts.getToken() : null;
    const isForm = typeof FormData !== "undefined" && body instanceof FormData;
    const headers: Record<string, string> = { ...(extra.headers ?? {}) };
    if (token) headers.authorization = `Bearer ${token}`;
    if (body !== undefined && !isForm) headers["content-type"] = "application/json";
    let res: Response;
    try {
      res = await f(`${opts.baseUrl}${path}`, { method, headers, body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body) });
    } catch {
      throw new ApiError(0, { code: "NETWORK", message: "You appear to be offline. Check your connection and try again." });
    }
    if (res.status === 401 && extra.retry !== false && opts.onUnauthorized && (await opts.onUnauthorized())) {
      return req<T>(method, path, body, { ...extra, retry: false });
    }
    const text = await res.text();
    const json = text ? JSON.parse(text) : {};
    if (!res.ok) throw new ApiError(res.status, json.error ?? { code: "HTTP_" + res.status, message: "Something went wrong" });
    return json as T;
  }
  const qs = (o: Record<string, unknown>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(o)) {
      if (v === undefined || v === null || v === "") continue;
      if (Array.isArray(v)) v.forEach((x) => p.append(k, String(x))); else p.set(k, String(v));
    }
    const s = p.toString();
    return s ? `?${s}` : "";
  };

  return {
    raw: req,
    auth: {
      requestOtp: (phone: string) => req<{ sent: boolean; provider: string; expiresInSeconds: number }>("POST", "/v1/auth/otp/request", { phone }),
      verifyOtp: (phone: string, code: string, name?: string) => req<{ accessToken: string; refreshToken: string; roles: string[]; user: { id: string; name: string | null; phone: string }; isNew: boolean }>("POST", "/v1/auth/otp/verify", { phone, code, name }),
      refresh: (refreshToken: string) => req<{ accessToken: string; refreshToken: string; roles: string[] }>("POST", "/v1/auth/refresh", { refreshToken }, { retry: false }),
      logout: (refreshToken: string) => req<{ ok: true }>("POST", "/v1/auth/logout", { refreshToken }),
    },
    me: {
      get: () => req<Me>("GET", "/v1/me"),
      update: (b: { name: string; email?: string }) => req<Me>("PATCH", "/v1/me", b),
      listings: (status?: string) => req<{ items: OwnerListing[] }>("GET", `/v1/me/listings${qs({ status })}`),
      inbox: () => req<{ items: InboxItem[] }>("GET", "/v1/me/inbox"),
      enquiries: () => req<{ items: { id: string; conversationId: string; createdAt: string; listing: PublicListing; visits: Visit[] }[] }>("GET", "/v1/me/enquiries"),
      favourites: () => req<{ items: (PublicListing & { available: boolean })[] }>("GET", "/v1/me/favourites"),
      addFavourite: (id: string) => req<{ saved: boolean }>("PUT", `/v1/me/favourites/${id}`),
      removeFavourite: (id: string) => req<{ saved: boolean }>("DELETE", `/v1/me/favourites/${id}`),
      notifications: () => req<{ items: Notification[]; unread: number }>("GET", "/v1/me/notifications"),
      markNotificationsRead: () => req<{ ok: true }>("POST", "/v1/me/notifications/read"),
    },
    geo: {
      cities: () => req<{ items: City[] }>("GET", "/v1/cities"),
      localities: (citySlug: string) => req<{ city: City; items: Locality[] }>("GET", `/v1/cities/${citySlug}/localities`),
    },
    search: (q: Record<string, unknown>) => req<SearchResult>("GET", `/v1/search${qs(q)}`),
    property: {
      get: (id: string) => req<PublicListing>("GET", `/v1/properties/${id}`),
      similar: (id: string) => req<{ items: PublicListing[] }>("GET", `/v1/properties/${id}/similar`),
      contact: (id: string) => req<{ available: boolean; reason?: string; name?: string; phone?: string }>("GET", `/v1/properties/${id}/contact`),
      enquire: (id: string, message: string, shareMyPhone: boolean, idempotencyKey: string) =>
        req<{ id: string; conversationId: string; duplicate: boolean }>("POST", `/v1/properties/${id}/enquiries`, { message, shareMyPhone }, { headers: { "idempotency-key": idempotencyKey } }),
      report: (id: string, reason: string, details?: string) => req<{ id: string }>("POST", `/v1/properties/${id}/report`, { reason, details }),
    },
    listings: {
      create: (b: ListingDraftInput = {}) => req<OwnerListing>("POST", "/v1/listings", b),
      get: (id: string) => req<OwnerListing>("GET", `/v1/listings/${id}`),
      save: (id: string, b: ListingDraftInput) => req<OwnerListing>("PATCH", `/v1/listings/${id}`, b),
      submit: (id: string) => req<OwnerListing>("POST", `/v1/listings/${id}/submit`),
      action: (id: string, action: "PAUSE" | "RESUME" | "MARK_SOLD" | "MARK_RENTED" | "ARCHIVE" | "RENEW") => req<OwnerListing>("POST", `/v1/listings/${id}/actions`, { action }),
      remove: (id: string) => req<{ ok: true }>("DELETE", `/v1/listings/${id}`),
      uploadPhoto: (id: string, form: FormData) => req<{ id: string; url: string }>("POST", `/v1/listings/${id}/media`, form),
      deletePhoto: (id: string, mediaId: string) => req<{ ok: true }>("DELETE", `/v1/listings/${id}/media/${mediaId}`),
      uploadDocument: (id: string, form: FormData) => req<{ id: string; label: string }>("POST", `/v1/listings/${id}/documents`, form),
    },
    leads: {
      update: (id: string, b: { stage?: LeadStage; note?: string }) => req<{ id: string; stage: LeadStage }>("PATCH", `/v1/leads/${id}`, b),
      requestVisit: (id: string, proposedAt: string, note?: string) => req<Visit>("POST", `/v1/leads/${id}/visits`, { proposedAt, note }),
      visitAction: (visitId: string, action: string, proposedAt?: string) => req<Visit>("POST", `/v1/visits/${visitId}/action`, { action, proposedAt }),
    },
    conversations: {
      get: (id: string) => req<ConversationView>("GET", `/v1/conversations/${id}`),
      send: (id: string, body: string) => req<{ id: string; body: string; at: string; fromMe: boolean }>("POST", `/v1/conversations/${id}/messages`, { body }),
      block: (id: string) => req<{ blocked: true }>("POST", `/v1/conversations/${id}/block`),
    },
    billing: {
      plans: () => req<{ items: Plan[] }>("GET", "/v1/plans"),
      createOrder: (planCode: string, listingId?: string) => req<{ order: Order; checkoutUrl: string; clientParams: Record<string, unknown> | null; provider: string }>("POST", "/v1/orders", { planCode, listingId }),
      orders: () => req<{ items: Order[] }>("GET", "/v1/orders"),
      order: (id: string) => req<Order>("GET", `/v1/orders/${id}`),
      entitlements: () => req<{ items: { kind: string; plan: string; listingId: string | null; startsAt: string; endsAt: string; listingQuota: number | null }[] }>("GET", "/v1/me/entitlements"),
    },
    admin: {
      orders: (status?: OrderStatus) => req<{ items: (Order & { user: { id: string; name: string | null }; provider: string })[] }>("GET", `/v1/admin/orders${qs({ status })}`),
      refund: (id: string) => req<{ status: string }>("POST", `/v1/admin/orders/${id}/refund`),
      flags: () => req<{ items: { key: string; enabled: boolean }[] }>("GET", "/v1/admin/flags"),
      setFlag: (key: string, enabled: boolean) => req<{ key: string; enabled: boolean }>("PUT", `/v1/admin/flags/${key}`, { enabled }),
      queue: (status = "PENDING_REVIEW", page = 1) => req<{ items: (OwnerListing & { ownerPhone: string })[]; total: number; page: number }>("GET", `/v1/admin/listings${qs({ status, page })}`),
      listing: (id: string) => req<OwnerListing & { owner: { id: string; name: string | null; phone: string; memberSince: string; listingCount: number }; documents: { id: string; label: string; mimeType: string; bytes: number }[]; checks: { path: string; message: string }[]; reviews: { id: string; decision: string; note: string | null; createdAt: string; moderator: { name: string | null } }[]; reports: { id: string; reason: string; details: string | null; status: string; createdAt: string }[] }>("GET", `/v1/admin/listings/${id}`),
      decide: (id: string, decision: "APPROVE" | "REQUEST_CHANGES" | "REJECT", note?: string) => req<{ status: ListingStatus }>("POST", `/v1/admin/listings/${id}/decision`, { decision, note }),
      documentUrl: (docId: string) => req<{ url: string; expiresInSeconds: number }>("GET", `/v1/documents/${docId}/url`),
    },
  };
}
export type ApiClient = ReturnType<typeof createClient>;
