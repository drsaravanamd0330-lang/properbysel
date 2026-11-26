# Support, moderation and fraud operating procedures

For the ProperBySel pilot team (Chennai). Working hours assumed: 9 AM to 9 PM IST, 7 days, with one person on call for severity 1 issues outside those hours. Every staff action in the admin tools is audit-logged; write notes as if the user will read them, because on a takedown they do.

## 1. Service levels (pilot targets)

| Queue | First response | Resolution |
|---|---|---|
| New listing review | — | Within 24 hours (target median under 6 working hours) |
| Fraud report (reason FRAUD) | 2 hours | 24 hours |
| Other listing reports | 1 working day | 3 working days |
| Support email or WhatsApp question | 4 working hours | 2 working days |
| Payment problem | 4 working hours | 1 working day |
| Grievance (formal complaint) | Acknowledge within 24 hours | Within the legal timeline confirmed by the lawyer (see LEGAL_MATRIX.md) |

## 2. Listing moderation

Open **Admin → Review queue** (oldest first). For each listing:

1. Read the automatic checks panel. Anything red must be fixed by the owner: use **Request changes** with a specific note.
2. Check the photos: real property photos, no watermarks from other sites, no faces or vehicle number plates in focus, no contact details written on images.
3. Check the price is plausible for the locality and category. Far below market is a fraud signal (see section 4).
4. Check the description: no phone numbers or links in text, no discriminatory wording (for example limiting tenants by religion or caste), no claims like "RERA approved" or "clear title" without a number or document.
5. For builder projects, a RERA registration number should be shown. Until the field exists, ask for it in the description. Do not mark anything as verified.
6. Private documents: open only when needed to resolve a doubt. Opening is logged. Never download to personal devices.
7. Decide:
   - **Approve and publish** when it meets the content policy.
   - **Request changes** for fixable problems. Say exactly what to change.
   - **Reject** for prohibited content, clear duplicates, or fraud. Explain briefly.

Never approve your own listing or a listing from a friend or relative; hand it to another moderator.

## 3. Reports queue

Open **Admin → Reports**. Start with FRAUD reports, then oldest first.
- **Start review** so others know you have it.
- **Dismiss** when nothing breaches policy; write why.
- **Take down** when the listing must change or go. Your note is sent to the owner. The listing goes back to "Changes requested" and needs approval again; the owner cannot simply resume it.
- If several reports name the same advertiser, look at their other listings in **Admin → Users → History**.

## 4. Fraud escalation

Common patterns in Indian property listings: asking for a "token advance" or "booking amount" before a visit; owner "abroad" who will courier keys after payment; rent far below the locality; copied photos; pressure to pay through a link or UPI QR; fake government or bank officer.

| Level | Trigger | Who acts | Actions |
|---|---|---|---|
| L1 | Single report, weak evidence | Moderator | Review, contact advertiser through the platform if needed, dismiss or take down |
| L2 | Clear fraud signal, or 2+ independent reports | Moderator + Admin | Take down all affected listings, **block** the account with the reason, keep evidence (screenshots, report IDs), message reporters that action was taken (without naming the outcome for the advertiser) |
| L3 | Money lost, threats, impersonation of officials, or many victims | Admin + Founder within 2 hours | All L2 actions; advise the victim to call the national cyber crime helpline 1930 and file at cybercrime.gov.in; preserve logs; respond to police requests only through the founder after legal advice; consider a public safety notice |

Never ask a reporter for OTPs, passwords or bank details. Never promise refunds of money paid to a third party; ProperBySel does not collect property payments.

## 5. Support

Channels for the pilot: support email and a WhatsApp Business number (both to be set up; see FOUNDER_CHECKLIST.md). Use saved replies for common questions:
- **OTP not received**: wait 60 seconds, check DND is not blocking transactional SMS, try again; more than 5 tries in 10 minutes is blocked for security.
- **Why is my listing not live?** Check Admin → Users → their listings; explain the moderator note.
- **Featured placement not showing**: check Admin → Orders. If Paid, sponsored slots show on the first page of relevance-sorted results that match the listing's city and filters. If Pending, see the payments runbook.
- **Refund request**: follow the refund policy. Admin issues refunds; in production they are issued in the Razorpay dashboard and the order updates automatically.
- **Delete my account**: point to Profile → Delete my account (web) or Account → Delete my account (app).

Support staff have the Support role: they can look up users (phone numbers masked) and view reports, but cannot change listings, roles or orders.

## 6. Daily and weekly routines

Daily: clear the review queue; clear FRAUD reports; check pending orders older than 1 hour; skim Metrics for anything unusual.
Weekly: review KPIs (see the business launch plan); sample 10 approved listings for quality; review blocked accounts; check staff access in Admin → Users.
Monthly: restore drill on staging (RUNBOOKS.md); review saved replies and this document.
