// Draft content. Legal and policy pages are DRAFTS for professional review and must not be relied on as final.
export interface Page { title: string; draft?: boolean; body: string[] }
export const PAGES: Record<string, Page> = {
  about: { title: "About ProperBySel", body: [
    "ProperBySel is a property marketplace for renting, buying and selling homes, land and commercial spaces, starting in Chennai.",
    "Owners, agents and builders post listings. Every listing shows who posted it, so you know when brokerage may apply. We review listings before they go live, but we do not verify legal title or ownership.",
    "ProperBySel is a product of AAROVIN SOFTWARE SOLUTIONS.",
  ] },
  contact: { title: "Contact us", body: ["Support email and phone will be published before launch.", "For complaints about a listing, use the “Report listing” button on the property page, or see Grievance redressal."] },
  pricing: { title: "Pricing", body: [
    "Posting your first listing is free.",
    "Paid options such as featured placement and advertiser plans are being finalised. Prices will be shown here, including GST, before you pay anything.",
    "Paid features never change how we moderate listings.",
  ] },
  help: { title: "Help centre", body: [
    "How do I post a property? Tap “Post Property”, log in with your mobile number, and complete the eight steps. Your progress saves automatically.",
    "How long does review take? We aim to review new listings within one working day. You will get a notification when your listing is live or if changes are needed.",
    "Why is my phone number hidden? Your number is shared only if you choose to show it, and only with people who have sent an enquiry.",
    "How do I close a listing? Go to My account → My listings and choose “Mark sold” or “Mark rented”.",
  ] },
  safety: { title: "Safety tips", body: [
    "Visit the property in person before paying any money.",
    "Never pay a “token advance” or booking amount to someone you have not met, or to secure a viewing.",
    "Ask to see original documents (sale deed, patta, approved plan, tax receipts) and have them checked by a lawyer before buying land or property.",
    "A “Phone confirmed” or “Identity reviewed” label means only that specific check was done. It does not prove ownership or clear title.",
    "Keep conversations on ProperBySel until you are comfortable. Report suspicious listings with the “Report listing” button.",
  ] },
  privacy: { title: "Privacy policy", draft: true, body: [
    "We collect your mobile number to create your account, and the details you add to listings and messages.",
    "We do not ask for or store Aadhaar numbers. Supporting documents you upload are stored privately and visible only to you and our moderators.",
    "Exact property addresses are never shown publicly. Map locations are approximate.",
    "You can request deletion of your account. Some records may be kept where the law requires.",
    "This draft must be reviewed against the Digital Personal Data Protection Act, 2023 and its rules before launch.",
  ] },
  terms: { title: "Terms of use", draft: true, body: [
    "ProperBySel is an advertising platform. We are not a party to any sale, rental or lease between users.",
    "Advertisers must have the right to advertise the property and must provide accurate information, including brokerage terms.",
    "We may edit, pause or remove listings that break these terms or our content rules.",
    "Real-estate projects that require RERA registration must display the registration number where applicable.",
  ] },
  refunds: { title: "Refunds and cancellation", draft: true, body: ["Refund rules for paid plans will be published before paid features are enabled.", "Payments are only for ProperBySel services. We never collect property deposits, advances or purchase money."] },
  grievance: { title: "Grievance redressal", draft: true, body: [
    "If you have a complaint about a listing, a user or our service, contact our Grievance Officer. Name and contact details will be published before launch.",
    "We will acknowledge complaints and aim to resolve them within the timelines required by applicable law (to be confirmed by legal review).",
  ] },
};
