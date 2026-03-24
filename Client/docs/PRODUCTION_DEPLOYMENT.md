# Production client app (install on phone, no dev machine)

The Expo app does **not** talk to your laptop. It calls whatever URL is baked in at **build time** as `EXPO_PUBLIC_API_URL` (see `src/api/client.ts`). For referral users to use the app anytime, you need:

1. **A always-on backend** — the same Travel CMS Next.js deployment you use in production (e.g. Vercel), with HTTPS, **not** `http://localhost:3000`.
2. **Native binaries built with that URL** — EAS Build (Expo Application Services), not `expo start` on USB.
3. **Distribution** — TestFlight / App Store (iOS) and internal testing or Play Store (Android), or enterprise MDM if applicable.

## 1. Deploy the web app

- Deploy the repo’s Next.js app to your host (commonly Vercel).
- Confirm in a browser: `https://YOUR_DOMAIN/api/health` or any public API route returns OK.
- Supabase and env vars must be configured on the host exactly as for production (same as when the site works for your team).

That URL root (no trailing slash) is your `EXPO_PUBLIC_API_URL`.

## 2. Expo / EAS project

1. Install: `npm i -g eas-cli`
2. Log in: `eas login`
3. In `Client/`: `eas init` — links `app.json` `extra.eas.projectId` and updates `updates.url` if you use EAS Update.
4. In [expo.dev](https://expo.dev) → your project → **Environment variables**, create:

   | Name | Purpose |
   |------|--------|
   | `EXPO_PUBLIC_API_URL` | `https://YOUR_DOMAIN` (production CMS) |
   | `EXPO_PUBLIC_CLIENT_APP_REFERRAL_ONLY` | Optional: `1` for influencer-only UI builds |

   Assign them to the **build profiles** you use (`preview`, `production`, etc.).

   `EXPO_PUBLIC_*` variables are inlined into the JS bundle at build time; they are not “runtime secrets”.

## 3. Build installable apps

From `Client/`:

```bash
# iOS + Android, store-ready (after credentials are set up)
eas build --profile production --platform all
```

- **Preview / internal**: `eas build --profile preview` (good for testers before store review).
- Do **not** rely on `Client/.env` for cloud builds unless you use a supported workflow; prefer Expo dashboard variables.

After the build, EAS gives you **IPA** / **APK** or **AAB** links. Testers install those — no computer server required.

## 4. Submit to stores (optional but “normal” distribution)

- **iOS**: Apple Developer Program, App Store Connect app record, then `eas submit --platform ios` (configure `eas.json` `submit` or use prompts).
- **Android**: Play Console, signing key, then `eas submit --platform android`.

Replace placeholder Apple / Play IDs in `eas.json` with your real values when you are ready to submit.

## 5. Referral-only build for influencers

Same app, different bundle configuration:

- Set `EXPO_PUBLIC_CLIENT_APP_REFERRAL_ONLY=1` for a dedicated EAS **build profile** (e.g. `referral`) and run `eas build --profile referral`.
- Or ship one app and control visibility via directory flags + API; the env flag is for a **minimal** client surface before the full app is ready.

## 6. OTA updates (optional)

`app.json` may reference EAS Update. After `eas update`, already-installed apps can load new JS without a new store version, within compatibility rules. Native changes still need a new store build.

## Checklist

- [ ] Production Next.js URL is live and client API routes work with real auth.
- [ ] `EXPO_PUBLIC_API_URL` in EAS matches that URL (no trailing slash).
- [ ] `eas build` completed; APK/IPA/AAB installed on a physical device **off Wi-Fi that depended on dev machine** (e.g. cellular) — confirms no localhost dependency.
- [ ] Store or TestFlight/Internal testing configured for referral users.

## Troubleshooting

- **Login fails / “Network Error”**: wrong `EXPO_PUBLIC_API_URL`, or device cannot reach your host (firewall, wrong env on EAS profile).
- **Works on Wi-Fi at office only**: API might still point to an internal IP — use the public HTTPS domain only.
