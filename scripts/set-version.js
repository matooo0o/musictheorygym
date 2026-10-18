#!/usr/bin/env node
/*
 * set-version.js
 *
 * Stamps a build version into the app and the Android project so every upload
 * is a distinct version:
 *
 *   - Android versionName / versionCode   (android/app/build.gradle)
 *   - the in-app version shown in Settings (www/index.html)
 *
 * The version comes from the APP_VERSION environment variable, falling back to
 * "1.0.0". The Android versionCode comes from GITHUB_RUN_NUMBER (monotonic, so
 * each build installs as a newer version), falling back to the numeric tail of
 * the version string.
 *
 * Run it from the repository root, after `npx cap add android` and before
 * `npx cap sync android` (so the stamped index.html is copied into the APK):
 *
 *     APP_VERSION=1.0.42 node scripts/set-version.js
 */

const fs = require("fs");
const path = require("path");

const version = process.env.APP_VERSION || "1.0.0";
const tail = (version.match(/(\d+)\s*$/) || [])[1];
const runNumber = parseInt(process.env.GITHUB_RUN_NUMBER || "", 10);
const code = Number.isFinite(runNumber) && runNumber > 0 ? runNumber : (tail ? parseInt(tail, 10) : 1);

if (!/^\d+(\.\d+)*$/.test(version)) {
  console.error("[set-version] refusing to use a non-numeric version: " + version);
  process.exit(1);
}

function patch(file, explain, pairs) {
  if (!fs.existsSync(file)) {
    console.error("[set-version] " + file + " not found (" + explain + ").");
    process.exit(1);
  }
  let text = fs.readFileSync(file, "utf8");
  for (const [find, replace, label] of pairs) {
    if (!find.test(text)) {
      console.error("[set-version] could not find " + label + " in " + file + ".");
      process.exit(1);
    }
    text = text.replace(find, replace);
  }
  fs.writeFileSync(file, text);
  console.log("[set-version] patched " + file);
}

patch(path.join("android", "app", "build.gradle"), "run after `npx cap add android`", [
  [/versionName\s+"[^"]*"/, 'versionName "' + version + '"', "versionName"],
  [/versionCode\s+\d+/, "versionCode " + code, "versionCode"]
]);

patch(path.join("www", "index.html"), "app source", [
  [/const APPVER="[^"]*"/, 'const APPVER="' + version + '"', "the APPVER constant"]
]);

console.log("[set-version] version " + version + " (versionCode " + code + ")");
