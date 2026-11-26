# Acceptance checklist

Status key: ✅ tested automatically · 🟡 implemented, not yet tested · ⬜ not started · ⛔ blocked on external access

| # | Behaviour (from the brief) | Status | Evidence |
|---|---|---|---|
| 1 | A user can resume and submit a draft listing | ✅ | flow.test.ts #1, e2e |
| 2 | A moderator can request changes or publish it | ✅ | flow.test.ts #2, e2e |
| 3 | Only eligible listings appear in public search | ✅ | flow.test.ts #3, expiry test |
| 4 | An unauthorized user cannot edit someone else's listing | ✅ | flow.test.ts #4 |
| 5 | Private documents and conversations cannot be accessed by another user | ✅ | flow.test.ts #5, files.test.ts |
| 6 | Search filters, sorting and pagination return correct results | ✅ | flow.test.ts #6 |
| 7 | An enquiry reaches the correct advertiser | ✅ | flow.test.ts #7, e2e |
| 8 | Visit state changes follow permission and lifecycle rules | ✅ | flow.test.ts #8 |
| 9 | Duplicate payment webhooks do not grant duplicate benefits | ⬜ | |
| 10 | Failed payments do not activate entitlements | ⬜ | |
| 11 | Expired paid placements stop receiving paid treatment | ⬜ | |
| 12 | Closing a listing updates its visibility and enquiry behaviour | ✅ | flow.test.ts #12 |
| 13 | Production settings reject development authentication bypasses | ✅ | flow.test.ts auth #13 |
| 14 | Mobile and web use the same persisted data | ⬜ | |
| 15 | Backup restoration is documented and tested where possible | ⬜ | |
