/**
 * Launch plan catalogue. Prices are ASSUMPTIONS for the Chennai pilot (see docs/ASSUMPTIONS.md),
 * exclusive of 18% GST. Change them here or in the Plan table; existing orders keep their own amounts.
 */
export const LAUNCH_PLANS = [
  { code: "FEATURED_7D", name: "Featured listing, 7 days", description: "Your live listing appears in the sponsored slots at the top of matching searches for 7 days.", kind: "FEATURED_LISTING", pricePaise: 29_900n, durationDays: 7, listingQuota: null, featureFlag: null },
  { code: "FEATURED_30D", name: "Featured listing, 30 days", description: "Sponsored placement for 30 days. Best value for sale listings.", kind: "FEATURED_LISTING", pricePaise: 99_900n, durationDays: 30, listingQuota: null, featureFlag: null },
  { code: "AGENT_PRO_MONTHLY", name: "Agent Pro, monthly", description: "For agents and builders: up to 20 live listings and a verified-business badge once documents are reviewed.", kind: "ADVERTISER_SUBSCRIPTION", pricePaise: 149_900n, durationDays: 30, listingQuota: 20, featureFlag: null },
  { code: "PHOTOSHOOT", name: "Professional photoshoot", description: "A photographer visits the property (Chennai only). Booked and delivered manually.", kind: "MANUAL_SERVICE", pricePaise: 199_900n, durationDays: 30, listingQuota: null, featureFlag: "manual_photoshoot" },
] as const;
