# Founder launch checklist

The full, editable version (with pricing, the 90-day plan, KPIs and costs) is the "ProperBySel business launch package" document: https://claude.ai/artifact/1WF6sP52phfGvF7CJWkGqJ . Unit economics: `docs/business/unit-economics.xlsx`.

Nothing below has been started: each item needs the founder's identity, money or explicit approval.

## Accounts and credentials
- [ ] Company and bank details for AAROVIN SOFTWARE SOLUTIONS ready for provider KYC
- [ ] Domain, DNS, business email
- [ ] Cloud account in an Indian region (server, managed PostgreSQL, private S3 bucket)
- [ ] MSG91 account, DLT entity and approved OTP template
- [ ] Razorpay merchant account, live keys, webhook secret
- [ ] GitHub repository (CI runs from `.github/workflows/ci.yml`)
- [ ] Expo account; Google Play developer account; Apple Developer Program
- [ ] Error monitoring and uptime checks
- [ ] WhatsApp Business number and support email

## Professional reviews
- [ ] Lawyer: policy pages, grievance officer, content policy, advertiser agreement, `docs/LEGAL_MATRIX.md`
- [ ] Chartered accountant: GST registration, rate, invoice format
- [ ] Trademark search and filing
- [ ] Penetration test
- [ ] Tamil copy review

## Engineering before real users
- [ ] Admin MFA; CSRF token on the web proxy; CAPTCHA before OTP
- [ ] RERA number field
- [ ] Verify S3, MSG91, Razorpay on staging
- [ ] Native Android and iOS builds tested on devices; app-review login
- [ ] Restore drill on the managed database

## Needs your explicit go-ahead
- [ ] Outreach to owners, agents or associations
- [ ] Any paid spend or ads
- [ ] Publishing on a public domain
- [ ] App store submissions
