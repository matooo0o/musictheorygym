# ToniKa

Single-file music theory trainer, packaged as an Android and iOS app with Capacitor.
`www/index.html` is the whole app: no dependencies, no build step.

## Build the APK on GitHub (Android)

Go to the Actions tab, run "Build APK", and wait for the run to finish. The
release page gets `ToniKa-<version>.apk` (also attached to the run as an
artifact). The version number goes up with every build.

Copy the APK to the phone and open it (allow "install unknown apps" when asked).

## Build the IPA on GitHub (iOS)

Go to the Actions tab, run "Build iOS", and wait for the run to finish. The
release page gets `ToniKa-iOS-<version>.ipa` (also attached to the run as an
artifact). The version number goes up with every build.

Install on iOS via Xcode, Apple Configurator 2, or sideloading tools
(e.g., AltStore, Sideloadly). For TestFlight / App Store distribution,
configure code signing in the workflow (see below).

## Build the APK locally

Install Node 20, JDK 17 and the Android SDK, then run:

```
npm install
npx cap add android
node scripts/set-version.js
npx cap sync android
node scripts/brand.js
node scripts/android-permissions.js
node scripts/android-signing.js
cd android && ./gradlew assembleDebug
```

The APK lands in `android/app/build/outputs/apk/debug/app-debug.apk`.

## Build the IPA locally

Requires macOS with Xcode 15+, CocoaPods, and Node 20.

```
npm install
npx cap add ios
node scripts/set-version.js
npx cap sync ios
node scripts/brand-ios.js
cd ios/App && xcodebuild -workspace App.xcworkspace -scheme App -configuration Release -destination generic/platform=iOS archive CODE_SIGNING_ALLOWED=NO
xcodebuild -exportArchive -archivePath build/App.xcarchive -exportPath build/export -exportOptionsPlist exportOptions.plist
```

The IPA lands in `ios/App/build/export/App.ipa`.

## Updates on the phone

Every build is signed with the same key (`signing/tonika.jks`), so a new APK
installs straight over the previous one. Without that, each CI run would use a
fresh debug keystore and Android would reject the update with "signatures do not
match previously installed version".

If the installed copy was built before the stable key existed, uninstall it
once; from then on updates install normally.

The version shown in Settings is the same number as the GitHub release and the
APK/IPA file name.

## iOS Code Signing (for TestFlight / App Store)

To distribute via TestFlight or the App Store, you need an Apple Developer
account. Add these GitHub repository secrets:

- `APPLE_TEAM_ID` – your Team ID (from Apple Developer portal)
- `APPLE_CERTIFICATE_P12` – base64-encoded `.p12` certificate
- `APPLE_CERTIFICATE_PASSWORD` – password for the `.p12`
- `APPLE_PROVISIONING_PROFILE` – base64-encoded `.mobileprovision` profile
- `APP_STORE_CONNECT_API_KEY_ID`, `APP_STORE_CONNECT_API_ISSUER_ID`, `APP_STORE_CONNECT_API_KEY` – for TestFlight upload (optional)

Then update `.github/workflows/build-ios.yml` to use `method: app-store` and
the signing secrets.

## What the scripts do

- `scripts/set-version.js` – writes the app version into `www/index.html`,
  Android `build.gradle`, and iOS `Info.plist`.
- `scripts/brand.js` – draws the Android launcher icon (rounded, round and
  adaptive layers) and sets the app label in `values/strings.xml`.
- `scripts/brand-ios.js` – draws the iOS launcher icons for all required sizes
  in `ios/App/App/Assets.xcassets/AppIcon.appiconset/`.
- `scripts/android-permissions.js` – declares the microphone permission in the
  Android manifest, which `cap sync` would otherwise leave out.
- `scripts/android-signing.js` – signs the Android build with
  `signing/tonika.jks`, so updates keep installing over the previous version.