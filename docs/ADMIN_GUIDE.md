# Administrator and moderator guide

Sign in on the website with a staff phone number. The **Admin** button appears in the header for moderator, support and admin accounts. In development, the demo staff logins are `9000000001` (admin and moderator) and `9000000002` (moderator); the OTP code is printed in the API log.

Operating procedures (what to approve, how to handle fraud) are in [business/SOPS.md](business/SOPS.md). This guide explains the screens.

## Roles

| Role | Can do |
|---|---|
| Moderator | Review queue, approve / request changes / reject, open private documents (logged), reports queue actions |
| Support | View reports, look up users with masked phone numbers |
| Admin | Everything above, plus users and roles, blocking, orders and refunds, feature flags, audit log, metrics |

## Screens (website, under /admin)

- **Review queue** (`/admin`): listings waiting for review, oldest first. Tabs for Changes requested, Published and Rejected. Open **Review** to see the full listing, automatic checks, owner history, private documents (5-minute links), previous decisions and reports.
- **Reports** (`/admin/reports`): user reports. Start review, Dismiss, or Take down with a note to the owner.
- **Users** (`/admin/users`): search by name or phone. Edit roles, Block or Unblock (a reason is required and logged), History opens the audit log for that user. Role changes and blocks sign the person out everywhere.
- **Orders** (`/admin/orders`): all payment orders with status. Refund paid orders (sandbox refunds apply immediately; with Razorpay, refund in its dashboard and the webhook updates the order). Feature flags at the bottom (for example `manual_photoshoot` shows the photoshoot plan on the pricing page).
- **Audit log** (`/admin/audit`): every privileged action. Filter by entity type (Listing, User, Order, Report, FeatureFlag), entity id or action.
- **Metrics** (`/admin/metrics`): live listings, enquiries, users, review backlog and median review time, open reports, revenue. Demo data is excluded.

## Good practice

- Use your own account; never share logins. Admin MFA is not built yet, so keep the staff phone secure.
- Write moderator notes the owner can act on: "Add at least 3 photos of the inside" rather than "poor photos".
- Do not change prices or text on someone's listing; ask them to.
- Do not mark anything as verified unless the matching check was actually done and recorded.
