#!/usr/bin/env node
/*
 * set-version.js
 *
 * Stamps a build version into the app and the native projects.
 * Reads version from version.json (single source of truth).
 * Version format: 1.YY.MM.DD + optional letter suffix (a, b, c...)
 * Android versionCode: YYMMDD * 100 + letterIndex (a=0, b=1...) * 100
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

const raw = fs.readFileSync(versionFile, "utf8");
console.log("[set-version] versionFile path:", versionFile);
console.log("[set-version] raw version.json:", raw.slice(0, 500));
const parsed = JSON.parse(raw);
console.log("[set-version] parsed version:", JSON.stringify(parsed.version));
console.log("[set-version] version regex test:", /^1\.\d{2}\.\d{2}\.\d{2}([a-z])?$/.test(parsed.version));
console.log("[set-version] cwd:", process.cwd());
console.log("[set-version] __dirname:", __dirname);
const { version: rawVersion, android, ios } = parsed;
const version = rawVersion.trim();
const code = android.versionCode;
const iosBuild = ios.buildNumber;

// CFBundleShortVersionString must be one to three period-separated integers.
// The app version is 1.YY.MM.DD[suffix], so iOS gets 1.YY.MMDD; the Settings
// screen still shows the full version because it reads the APPVER constant.
const iosVersion = (() => {
  const m = /^1\.(\d{2})\.(\d{2})\.(\d{2})[a-z]?$/.exec(version);
  return m ? "1." + m[1] + "." + m[2] + m[3] : (version.replace(/[^0-9.]/g, "") || "1.0");
})();

// Validate version format: 1.YY.MM.DD or 1.YY.MM.DD[a-z]
if (!/^1\.\d{2}\.\d{2}\.\d{2}([a-z])?$/.test(version)) {
  console.error("[set-version] invalid version format (expected 1.YY.MM.DD or 1.YY.MM.DDx): " + version);
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
    '<key>CFBundleShortVersionString</key><string>' + iosVersion + '</string>'
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