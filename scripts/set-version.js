#!/usr/bin/env node
/*
 * set-version.js
 *
 * Stamps a build version into the app and the native projects.
 * Reads version from version.json (single source of truth).
 * Version format: 1.YYYY.MM.DD + optional letter suffix (a, b, c...)
 * Android versionCode: YYYYMMDD * 100 + letterIndex (a=0, b=1...) * 100
 * iOS buildNumber: same formula
 * Gracefully handles Android-only or iOS-only builds.
 */

const fs = require("fs");
const path = require("path");

const versionFile = path.join(__dirname, "..", "version.json");
if (!fs.existsSync(versionFile)) {
  console.error("[set-version] version.json not found");
  process.exit(1);
}

const { version, android, ios } = JSON.parse(fs.readFileSync(versionFile, "utf8"));
const code = android.versionCode;
const iosBuild = ios.buildNumber;

// Validate version format: 1.YYYY.MM.DD or 1.YYYY.MM.DD[a-z]
if (!/^1\.\d{4}\.\d{2}\.\d{2}([a-z])?$/.test(version)) {
  console.error("[set-version] invalid version format (expected 1.YYYY.MM.DD or 1.YYYY.MM.DDx): " + version);
  process.exit(1);
}

function patch(file, explain, pairs) {
  if (!fs.existsSync(file)) {
    console.log("[set-version] " + file + " not found (" + explain + "), skipping");
    return;
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

// Android (only if android project exists)
const androidGradle = path.join("android", "app", "build.gradle");
if (fs.existsSync(androidGradle)) {
  patch(androidGradle, "run after `npx cap add android`", [
    [/versionName\s+"[^"]*"/, 'versionName "' + version + '"', "versionName"],
    [/versionCode\s+\d+/, "versionCode " + code, "versionCode"]
  ]);
} else {
  console.log("[set-version] Android project not found, skipping Android version");
}

// iOS - patch Info.plist
const infoPlist = path.join("ios", "App", "App", "Info.plist");
if (fs.existsSync(infoPlist)) {
  let plist = fs.readFileSync(infoPlist, "utf8");
  plist = plist.replace(
    /<key>CFBundleShortVersionString<\/key>\s*<string>[^<]*<\/string>/,
    '<key>CFBundleShortVersionString</key><string>' + version + '</string>'
  );
  plist = plist.replace(
    /<key>CFBundleVersion<\/key>\s*<string>[^<]*<\/string>/,
    '<key>CFBundleVersion</key><string>' + iosBuild + '</string>'
  );
  fs.writeFileSync(infoPlist, plist);
  console.log("[set-version] patched " + infoPlist);
} else {
  console.log("[set-version] Info.plist not found, skipping iOS version");
}

// App source
patch(path.join("www", "index.html"), "app source", [
  [/const APPVER="[^"]*"/, 'const APPVER="' + version + '"', "the APPVER constant"]
]);

console.log("[set-version] version " + version + " (Android versionCode " + code + ", iOS build " + iosBuild + ")");