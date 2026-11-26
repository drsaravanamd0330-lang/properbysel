# Mobile app (Android and iOS)

`apps/mobile` is an Expo SDK 58 app (React Native 0.88, Expo Router). It uses the same `@pbs/api-client`, validation and domain packages as the website, and talks to the same API, so permissions and data are identical.

## Screens
Search (city, Rent/Buy, keyword, type, sort, load more) · Property details (photos, price breakdown, approximate location, enquiry, phone reveal after enquiry, save, share, report) · Login (phone OTP) · My listings (pause, mark sold/rented, renew) · Listing editor (8 steps, photo upload from library, submit for review) · Inbox (leads and my enquiries) · Conversation (messages, lead stage, visit requests) · Account (profile, notifications, push opt-in, logout).

Every screen has loading, empty and error states, and network failures show a retry. Tokens are kept in the device keychain/keystore (`expo-secure-store`).

## Run in development
```bash
pnpm dev:api                         # API on :4000
cd apps/mobile
EXPO_PUBLIC_API_URL=http://<your-computer-LAN-IP>:4000 npx expo start
```
Scan the QR code with a development build. Android emulators reach the host at `http://10.0.2.2:4000` automatically. Also add your phone's origin to `WEB_ORIGIN` only if you run the web target.

## Deep links
Scheme `properbysel://` (for example `properbysel://property/<id>`). Universal links from the website domain need the production domain plus `associatedDomains` (iOS) and `intentFilters` (Android) in `app.json`, and the `apple-app-site-association` / `assetlinks.json` files on the website.

## Push notifications
The app asks for permission only when the user taps "Turn on notifications", then registers an Expo push token with `POST /v1/me/push-tokens`. To make this work: create an EAS project (`npx eas-cli@latest init`), which writes `extra.eas.projectId`, and configure FCM (Android) and APNs (iOS) credentials in EAS. Sending pushes from the API is not built yet.

## Builds and store release
| Item | Status |
|---|---|
| JavaScript bundles for Android, iOS and web compile (`npx expo export`) | Verified 2026-11-26 |
| App tested in a browser at phone size against the real API, and data shared with the website | Verified (`e2e/mobile.e2e.mjs`) |
| Native Android build (APK/AAB) | **Not run**: needs an Expo account and `eas build -p android`, or Android Studio |
| Native iOS build | **Not run**: needs an Apple Developer account and EAS or a Mac with Xcode |
| Tested on a physical phone or emulator | **Not done** |
| Store submission | Not started. Needs Play Console and App Store Connect accounts, privacy forms, screenshots. Will not be done without your approval. |

Bundle IDs are set to `com.aarovin.properbysel`; change them before the first store build if you prefer another.
