# Production client app (store-grade)

The Expo app does **not** talk to your laptop. It calls whatever URL is baked in at **build time** as `EXPO_PUBLIC_API_URL` (see `src/api/client.ts`). For users to run the app anytime, you need:

1. **Always-on backend** — Travel CMS Next.js in production (e.g. Vercel), **HTTPS**, not `http://localhost:3000`.
2. **Native binaries from EAS Build** — not `expo start` over USB.
3. **Distribution** — TestFlight / App Store (iOS) and internal testing or Play Store (Android).

Configuration lives in **`app.config.ts`** (not `app.json`). EAS Update is enabled automatically once a valid Expo project UUID is set (see below).

---

## 1. Deploy the web app

- Deploy the Next.js app; confirm `https://YOUR_DOMAIN/api/health` (or another public route) responds.
- Supabase and env vars on the host must match production.

Use that origin **without a trailing slash** as `EXPO_PUBLIC_API_URL`.

---

## 2. Accounts and legal (do this early)

### Apple (App Store / TestFlight)

- Enrol in the [Apple Developer Program](https://developer.apple.com/programs/) (annual fee).
- **Organization** accounts may need **D-U-N-S** and legal entity verification (can take days).
- In [App Store Connect](https://appstoreconnect.apple.com/): create the app record (bundle id must match `app.config.ts` → `ios.bundleIdentifier`, currently `com.mytravelconcierge.app`).
- Complete **Agreements, Tax, and Banking** or TestFlight external testing will block.
- **App Privacy** / data collection declarations must match what the app and API actually do.
- **Export compliance** (encryption): answer the questionnaire when submitting; most apps qualify for standard exemptions.

### Google Play

- One-time [Play Console](https://play.google.com/console) registration fee.
- Create the app; package name must match `android.package` (`com.mytravelconcierge.app`).
- **Data safety** form, content rating, target API level — required before production.
- For `eas submit`, create a **Google Play service account** JSON with release permissions; store the file **only** on secure machines (path referenced in `eas.json` is gitignored).

### Operational

- Public **privacy policy URL** (often required for store review and OAuth if you add it later).
- Support / contact email visible in store listings.

---

## 3. Expo / EAS project

1. `npm i -g eas-cli`
2. `eas login`
3. From **`Client/`**: `npm run eas:init` (or `eas init`) — links the project and can set the project UUID in Expo.
4. Set **`EXPO_PUBLIC_EAS_PROJECT_ID`** in [expo.dev](https://expo.dev) → Project → **Environment variables** to your project UUID (optional if the id is already valid in config after `eas init`). When the UUID is valid, **`app.config.ts`** enables `updates.url` for EAS Update.

5. In the same place, add variables and attach them to **each build profile** you use:

   | Name | Purpose |
   |------|--------|
   | `EXPO_PUBLIC_API_URL` | `https://YOUR_DOMAIN` (production CMS root) |
   | `EXPO_PUBLIC_CLIENT_APP_REFERRAL_ONLY` | Optional `1` for influencer-only UI (or use `referral` profile below) |

   `EXPO_PUBLIC_*` values are inlined at build time; they are not secret.

---

## 4. Build profiles (`eas.json`)

| Profile | Use |
|--------|-----|
| `development` | Dev client, internal |
| `preview` | APK / internal iOS, channel `preview` — QA before store |
| `production` | **AAB** (Android) + iOS store pipeline, channel `production`, `autoIncrement` |
| `referral` | Same as production + `EXPO_PUBLIC_CLIENT_APP_REFERRAL_ONLY=1`, channel `referral` |

Commands (from `Client/`):

```bash
npm run build:preview
npm run build:production
npm run build:referral
```

Prefer **Expo dashboard env vars** for cloud builds; do not assume `Client/.env` is uploaded unless you use a supported workflow.

---

## 5. Submit to stores

1. Fill real values in `eas.json` → `submit.production` (Apple ID, **numeric** ASC App ID, Team ID) or pass flags interactively the first time.
2. Place `google-services-key.json` in `Client/` (gitignored) for Android submit.
3. After a successful production build:

```bash
npm run submit:ios
npm run submit:android
```

`track: internal` (Android) is set for safer first uploads; change to `production` when ready.

---

## 6. OTA updates (EAS Update)

After a valid project UUID and channel-aligned builds:

```bash
npm run update:preview
npm run update:production
npm run update:referral
```

Only JS/asset changes; native modules or permission changes need a new store build.

---

## 7. Local development

Copy `.env.example` → `.env.local` (gitignored) for `EXPO_PUBLIC_API_URL` when running `expo start` against a tunneled or staging API.

---

## Checklist

- [ ] Production CMS URL live; client API auth works from a browser or HTTP client.
- [ ] Apple Developer + App Store Connect app id matches bundle id.
- [ ] Play Console app + signing + service account for submit.
- [ ] `EXPO_PUBLIC_API_URL` set on **every** EAS profile you build.
- [ ] `eas build` artifact installed on a **cellular** device (no dependency on dev machine).
- [ ] Privacy policy and store metadata prepared.

---

## Troubleshooting

- **Network Error / login fails**: wrong `EXPO_PUBLIC_API_URL`, or device cannot reach the host.
- **EAS Update does nothing**: UUID missing or invalid → set `EXPO_PUBLIC_EAS_PROJECT_ID` or run `eas init`; build must use the same **channel** as `eas update`.
- **Submit fails (iOS)**: unsigned agreements, wrong Team ID, or ASC App ID not matching the app record.
