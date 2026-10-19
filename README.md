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

The generated IPA is **unsigned**. That is intentional: compiling an app does
not need an Apple certificate, and signing at export time is what made the old
workflow fail. An unsigned IPA is the normal input for the tools that install
apps on a non-jailbroken iPhone:

- **Sideloadly** (Windows/macOS) – drag the IPA in, sign in with a free Apple ID.
- **AltStore / SideStore** – add the IPA as a source, sign in with a free Apple
  ID.
- **Xcode** – Window > Devices and Simulators, drag the IPA onto the device
  (re-signs with your development team). Requires a Mac.
- **Apple Configurator 2** – also requires a signing team.

Free Apple IDs produce a certificate that expires after 7 days; a paid Apple
Developer account gives a 1-year certificate and enables TestFlight/App Store.

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
node scripts/ios-permissions.js
node scripts/brand-ios.js
cd ios/App
xcodebuild -workspace App.xcworkspace -scheme App -configuration Release \
  -destination generic/platform=iOS -archivePath build/App.xcarchive \
  archive CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO
mkdir -p build/ipa/Payload
cp -R build/App.xcarchive/Products/Applications/App.app build/ipa/Payload/
ditto -c -k --sequesterRsrc --keepParent build/ipa/Payload ../ToniKa-iOS.ipa
```

The IPA lands in `ios/ToniKa-iOS.ipa`. It is unsigned, exactly like the CI
build, so re-sign it with Sideloadly/AltStore/Xcode before installing.

`xcodebuild -exportArchive` is deliberately not used: it refuses to create an
IPA without a signing certificate and provisioning profile, which is why the
previous workflow failed on GitHub's runners.

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

The default workflow does not sign the app. That keeps `Build iOS` green on
every push without Apple credentials. For TestFlight or the App Store, either
archive and upload from Xcode (open `ios/App/App.xcworkspace`, choose your team
under Signing & Capabilities, then Product > Archive), or add a signing step to
the workflow.

If you add signing, these are the values you need. Store them as GitHub
repository secrets:

- `APPLE_TEAM_ID` – your Team ID (from Apple Developer portal)
- `APPLE_CERTIFICATE_P12` – base64-encoded `.p12` certificate
- `APPLE_CERTIFICATE_PASSWORD` – password for the `.p12`
- `APPLE_PROVISIONING_PROFILE` – base64-encoded `.mobileprovision` profile
- `APP_STORE_CONNECT_API_KEY_ID`, `APP_STORE_CONNECT_API_ISSUER_ID`, `APP_STORE_CONNECT_API_KEY` – for TestFlight upload (optional)

With those in place, the archive can be exported with
`xcodebuild -exportArchive ... -exportOptionsPlist exportOptions.plist`
(`method` = `app-store-connect` for TestFlight; create the plist in Xcode) and
uploaded with `xcrun altool`/`notarytool`.

## What the scripts do

- `scripts/set-version.js` – writes the app version into `www/index.html`,
  Android `build.gradle`, and iOS `Info.plist`.
- `scripts/brand.js` – draws the Android launcher icon (rounded, round and
  adaptive layers) and sets the app label in `values/strings.xml`.
- `scripts/brand-ios.js` – draws the iOS launcher icons for all required sizes
  in `ios/App/App/Assets.xcassets/AppIcon.appiconset/`.
- `scripts/android-permissions.js` – declares the microphone permission in the
  Android manifest, which `cap sync` would otherwise leave out.
- `scripts/ios-permissions.js` – adds `NSMicrophoneUsageDescription` to
  `Info.plist`; without it iOS kills the app when the tuner opens the mic.
- `scripts/android-signing.js` – signs the Android build with
  `signing/tonika.jks`, so updates keep installing over the previous version.