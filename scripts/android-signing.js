#!/usr/bin/env node
/*
 * android-signing.js
 *
 * Signs every build with the same key, so a new APK installs over the previous
 * one. `npx cap add android` regenerates android/app/build.gradle, and Gradle
 * would otherwise sign with a fresh debug keystore on every CI run — Android
 * then refuses the update with INSTALL_FAILED_UPDATE_INCOMPATIBLE
 * ("signatures do not match previously installed version").
 *
 * Run it from the repository root after `npx cap add android` and before
 * gradle builds the APK:
 *
 *     node scripts/android-signing.js
 */

const fs = require("fs");
const path = require("path");

const KEYSTORE = path.join("signing", "tonika.jks");
const GRADLE = path.join("android", "app", "build.gradle");
const KEY_COPY = path.join("android", "app", "tonika.jks");
const KEY_ALIAS = "tonika";
const PASSWORD = "tonikaKey2026";

for (const [file, why] of [
  [KEYSTORE, "the app signing key"],
  [GRADLE, "run after `npx cap add android`"]
]) {
  if (!fs.existsSync(file)) {
    console.error("[signing] " + file + " not found (" + why + ").");
    process.exit(1);
  }
}

let gradle = fs.readFileSync(GRADLE, "utf8");

if (!/signingConfigs\s*\{/.test(gradle)) {
  const block = [
    "    signingConfigs {",
    "        tonika {",
    '            storeFile file("tonika.jks")',
    '            storePassword "' + PASSWORD + '"',
    '            keyAlias "' + KEY_ALIAS + '"',
    '            keyPassword "' + PASSWORD + '"',
    '            storeType "jks"',
    "        }",
    "    }",
    ""
  ].join("\n");

  const atAndroid = gradle.replace(/android\s*\{[ \t]*\r?\n/, m => m + block);
  if (atAndroid === gradle) {
    console.error("[signing] could not find the android block in " + GRADLE + ".");
    process.exit(1);
  }
  gradle = atAndroid;

  // Capacitor's template only has a release build type; add a debug one that
  // uses our key (or extend the existing debug block).
  const btStart = gradle.indexOf("buildTypes");
  if (btStart < 0) {
    console.error("[signing] could not find buildTypes in " + GRADLE + ".");
    process.exit(1);
  }
  const releaseStart = gradle.indexOf("release", btStart);
  const debugStart = gradle.indexOf("debug", btStart);
  const hasDebugFirst = debugStart >= 0 && (releaseStart < 0 || debugStart < releaseStart);

  if (hasDebugFirst) {
    gradle = gradle.replace(/(\bdebug\s*\{)/, "$1\n            signingConfig signingConfigs.tonika");
  } else {
    const withDebug = gradle.replace(/buildTypes\s*\{/, m =>
      m + "\n        debug {\n            signingConfig signingConfigs.tonika\n        }");
    if (withDebug === gradle) {
      console.error("[signing] could not add a debug build type in " + GRADLE + ".");
      process.exit(1);
    }
    gradle = withDebug;
  }
}

fs.copyFileSync(KEYSTORE, KEY_COPY);
fs.writeFileSync(GRADLE, gradle);

const shown = gradle.slice(gradle.indexOf("signingConfigs"), gradle.indexOf("buildTypes"));
console.log("[signing] builds are signed with signing/tonika.jks (alias " + KEY_ALIAS + "):");
console.log(shown.trimEnd());
