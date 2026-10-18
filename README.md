# ToniKa

Single-file music theory trainer, packaged as an Android app with Capacitor.
`www/index.html` is the whole app: no dependencies, no build step.

## Build the APK on GitHub

Go to the Actions tab, run "Build APK", and wait for the run to finish. The
release page gets `ToniKa-<version>.apk` (also attached to the run as an
artifact). The version number goes up with every build.

Copy the APK to the phone and open it (allow "install unknown apps" when asked).

## Build the APK locally

Install Node 20, JDK 17 and the Android SDK, then run:

```
npm install
npx cap add android
node scripts/set-version.js
npx cap sync android
node scripts/brand.js
node scripts/android-permissions.js
cd android && ./gradlew assembleDebug
```

The APK lands in `android/app/build/outputs/apk/debug/app-debug.apk`.

## What the scripts do

- `scripts/set-version.js` – writes the app version into `www/index.html`.
- `scripts/brand.js` – draws the launcher icon (rounded, round and adaptive
  layers) and sets the app label in `values/strings.xml`.
- `scripts/android-permissions.js` – declares the microphone permission in the
  manifest, which `cap sync` would otherwise leave out.
