#!/usr/bin/env node
/*
 * ios-permissions.js
 *
 * iOS refuses to let an app open the microphone, camera, etc. unless the
 * matching NS*UsageDescription key exists in Info.plist. The web tuner calls
 * navigator.mediaDevices.getUserMedia(), so without
 * NSMicrophoneUsageDescription the app is killed by the system the moment the
 * user turns the microphone on.
 *
 * Run it from the repository root, after `npx cap add ios` / `npx cap sync`:
 *
 *     node scripts/ios-permissions.js
 *
 * It is idempotent and exits with an error if Info.plist is missing, so a
 * broken pipeline fails loudly instead of shipping a silent-mic IPA.
 */

const fs = require("fs");
const path = require("path");

const infoPlist = path.join("ios", "App", "App", "Info.plist");

const wanted = [
  [
    "NSMicrophoneUsageDescription",
    "ToniKa uses the microphone to listen to your instrument and hear the notes you play."
  ]
];

if (!fs.existsSync(infoPlist)) {
  console.error("[ios-permissions] " + infoPlist + " not found.");
  console.error("[ios-permissions] run this after `npx cap add ios`.");
  process.exit(1);
}

let xml = fs.readFileSync(infoPlist, "utf8");
const missing = wanted.filter(([key]) => xml.indexOf("<key>" + key + "</key>") < 0);

if (missing.length === 0) {
  console.log("[ios-permissions] usage descriptions already present, nothing to do.");
  process.exit(0);
}

if (xml.indexOf("</dict>") < 0) {
  console.error("[ios-permissions] could not find the closing </dict> in " + infoPlist);
  process.exit(1);
}

const block = missing
  .map(([key, value]) => "\t<key>" + key + "</key>\n\t<string>" + value + "</string>\n")
  .join("");

// Insert before the final </dict> of the top-level dictionary.
const at = xml.lastIndexOf("</dict>");
xml = xml.slice(0, at) + block + xml.slice(at);

fs.writeFileSync(infoPlist, xml);
console.log(
  "[ios-permissions] added " + missing.length + " entr" + (missing.length === 1 ? "y" : "ies") +
  " to " + infoPlist
);
