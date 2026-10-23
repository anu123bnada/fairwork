import { existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const profile = process.env.USERPROFILE ?? "";
const sdk = [process.env.ANDROID_HOME, process.env.ANDROID_SDK_ROOT,
  join(profile, "AppData/Local/Android/Sdk")].filter(Boolean).find(path => existsSync(join(path, "platform-tools/adb.exe")));
const androidPrograms = join(process.env.ProgramFiles ?? "C:/Program Files", "Android");
const studio = [process.env.ANDROID_STUDIO_HOME,
  ...(existsSync(androidPrograms) ? readdirSync(androidPrograms).map(name => join(androidPrograms, name)) : []),
  join(profile, "AppData/Local/Programs/Android Studio")].filter(Boolean).find(path => existsSync(join(path, "bin/studio64.exe")));
const root = fileURLToPath(new URL("../../..", import.meta.url));
const portableRoot = join(root, ".tmp/android-toolchain");
const portable = existsSync(portableRoot) ? readdirSync(portableRoot).map(name => join(portableRoot, name))
  .find(path => existsSync(join(path, "bin/javac.exe"))) : undefined;
const java = process.env.JAVA_HOME ? join(process.env.JAVA_HOME, "bin/java.exe")
  : portable ? join(portable, "bin/java.exe") : studio ? join(studio, "jbr/bin/java.exe") : "java";
const result = spawnSync(java, ["-version"], { encoding: "utf8", windowsHide: true });
const version = `${result.stderr ?? ""}${result.stdout ?? ""}`.match(/version "(\d+)(?:\.(\d+))?/);
const major = version ? Number(version[1] === "1" ? version[2] : version[1]) : 0;
const javaCompatible = major >= 21 && major <= 24; // Gradle 8.14.3 + Capacitor Java 21.
const adb = sdk ? join(sdk, "platform-tools/adb.exe") : "adb";
const devices = spawnSync(adb, ["devices"], { encoding: "utf8", windowsHide: true });
const deviceLines = (devices.stdout ?? "").split(/\r?\n/).slice(1).filter(line => line.trim());
const adbAvailable = !devices.error && devices.status === 0;
const authorized = adbAvailable ? deviceLines.filter(line => /\sdevice\s*$/.test(line)).length : null;
const emulator = sdk && existsSync(join(sdk, "emulator/emulator.exe"));
const avds = emulator ? spawnSync(join(sdk, "emulator/emulator.exe"), ["-list-avds"], { encoding: "utf8", windowsHide: true }) : null;
const platforms = sdk && existsSync(join(sdk, "platforms/android-36/android.jar"));
const buildTools = sdk && existsSync(join(sdk, "build-tools/35.0.0/aapt2.exe"));
const acceleration = emulator ? spawnSync(join(sdk, "emulator/emulator.exe"), ["-accel-check"],
  { encoding: "utf8", windowsHide: true, timeout: 15000 }) : null;
const buildReady = Boolean(javaCompatible && sdk && platforms && buildTools);
console.log(JSON.stringify({
  androidStudio: studio ?? "NOT_FOUND_IN_STANDARD_LOCATIONS",
  javaExecutable: java, javaMajor: major || "NOT_FOUND", supportedJavaMajors: "21-24", javaCompatible,
  androidSdk: sdk ?? "NOT_FOUND", platform36: Boolean(platforms),
  buildTools35: Boolean(buildTools), buildReady,
  adb: adbAvailable ? "AVAILABLE" : "UNAVAILABLE",
  authorizedDeviceCount: authorized,
  emulator: emulator ? "AVAILABLE" : "NOT_FOUND",
  avds: avds?.stdout?.trim() || "NONE_FOUND",
  emulatorAcceleration: acceleration?.stdout?.trim() || "NOT_CHECKED",
  deviceTestingReady: Boolean(authorized),
  debugApkPresent: existsSync(resolve(root, "mobile/poc/android/app/build/outputs/apk/debug/app-debug.apk")),
  installation: "NOT_CHECKED_BY_DOCTOR",
  note: "Inventory only. Device availability cannot be determined without ADB; no APK build or install is performed."
}, null, 2));
if (!buildReady || !authorized) process.exitCode = 1;
