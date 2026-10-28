import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
const read = path => readFileSync(`mobile/poc/${path}`, "utf8");
const config = JSON.parse(read("capacitor.config.json"));
assert.equal(config.appId, "org.fairwork.localpoc");
assert.equal(config.server.url, "http://localhost:3102");
assert.equal(config.server.cleartext, false);
assert.equal(config.android.allowMixedContent, false);
assert.equal(config.plugins.CapacitorHttp.enabled, false);
assert.equal(config.plugins.CapacitorCookies.enabled, false);
// Native viewport padding preserves system/keyboard insets without mutating the
// server-rendered <html> style before React hydration.
assert.equal(config.plugins.SystemBars.insetsHandling, "native");
// The release variant is disabled unless a non-development application ID and an https origin are supplied as build parameters; the development ID
// prefix and any other origin form are always refused.
const gradle = read("android/app/build.gradle");
assert.match(gradle, /beforeVariants\(selector\(\)\.withBuildType\("release"\)\)[\s\S]*?variantBuilder\.enable = releaseConfigured/);
assert.match(gradle, /def releaseConfigured = [^\n]*\n[^\n]*!oryqenReleaseAppId\.startsWith\("org\.fairwork\."\)[^\n]*\n[^\n]*https:/);
assert.match(gradle, /oryqenReleaseOrigin = \(project\.findProperty\("oryqenReleaseOrigin"\) \?: ""\)/);
const network = read("android/app/src/debug/res/xml/local_poc_network_security.xml");
assert.match(network, /<base-config cleartextTrafficPermitted="false"\s*\/>/);
assert.match(network, /<domain includeSubdomains="false">localhost<\/domain>/);
assert.equal((network.match(/<domain /g) ?? []).length, 1);
const manifest = read("android/app/src/main/AndroidManifest.xml");
assert.match(manifest, /android:usesCleartextTraffic="false"/);
assert.match(manifest, /android:allowBackup="false"/);
assert.deepEqual([...manifest.matchAll(/<uses-permission android:name="([^"]+)"/g)].map(match => match[1]), ["android.permission.INTERNET"]);
assert.match(read("android/app/src/main/java/org/fairwork/localpoc/MainActivity.java"), /webView\.canGoBack\(\)[\s\S]*?webView\.goBack\(\)[\s\S]*?finish\(\)/);
console.log("PASS: local transport, release guard, exact loopback debug exception, permissions, backup and back-handler source invariants. This is not device testing.");
