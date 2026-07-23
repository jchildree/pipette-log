# Pipette Log Client (Expo / React Native)

## Dev

```bash
npm install
npx expo start
```

Point at your backend via `EXPO_PUBLIC_API_URL` (defaults to `http://localhost:3000`).

## Shipping to iPad (EAS, no Mac required)

`eas.json` is scaffolded with `development`/`preview`/`production` profiles. Not runnable yet -- you need two accounts first:

1. **Expo account** (free) -- create at expo.dev, then `npx eas-cli login` from this directory.
2. **Apple Developer Program** ($99/yr) -- required for any real iOS build/signing, even through EAS. Enroll at developer.apple.com.
3. `ios.bundleIdentifier` in `app.json` is currently a **placeholder** (`com.industriallaboratories.pipettelog`) -- confirm/change it before your first build; it must be unique and match what you register in App Store Connect.
4. Once both accounts exist: `eas build:configure` (links the project to your Expo account), then `eas build --platform ios --profile preview` for an internal TestFlight-style build -- EAS builds and signs remotely, no local Mac needed at any step.
