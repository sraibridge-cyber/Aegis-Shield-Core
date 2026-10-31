import { test } from "node:test";
import assert from "node:assert/strict";
import { signalFlags } from "../../public/monitor/signals.js";
import { createMonitor } from "../../public/monitor/core.js";
import { MemoryStore } from "../../public/monitor/store.js";
import { verifyChain } from "../../public/monitor/chain.js";

const base = () => ({
  accessibilityServices: [],
  notificationListeners: [],
  deviceAdmins: [],
  userCaCertificates: { count: 0, sha256: [] },
  vpnActive: false,
  proxy: null,
  developerOptions: false,
  usbDebugging: false,
  microphoneRecordingClients: 0,
  camerasInUse: 0,
});

const codes = (flags) => flags.map((f) => f.code);

test("no flags when there is no earlier reading to compare with", () => {
  assert.deepEqual(signalFlags(null, base()), []);
  assert.deepEqual(signalFlags(base(), null), []);
});

test("no flags when nothing changed", () => {
  assert.deepEqual(signalFlags(base(), base()), []);
});

test("a newly enabled accessibility service is flagged with its name", () => {
  const cur = { ...base(), accessibilityServices: ["com.example.reader/.Svc"] };
  const f = signalFlags(base(), cur);
  assert.deepEqual(codes(f), ["ACCESSIBILITY_ON"]);
  assert.match(f[0].text, /com\.example\.reader/);
  assert.match(f[0].text, /may have turned it on yourself/);
});

test("a disabled accessibility service is flagged as off, not as a threat", () => {
  const prev = { ...base(), accessibilityServices: ["a/b"] };
  assert.deepEqual(codes(signalFlags(prev, base())), ["ACCESSIBILITY_OFF"]);
});

test("notification access, device admin and user certificates are each flagged", () => {
  const cur = {
    ...base(),
    notificationListeners: ["x/y"],
    deviceAdmins: ["p/q"],
    userCaCertificates: { count: 1, sha256: ["abc"] },
  };
  assert.deepEqual(codes(signalFlags(base(), cur)).sort(), ["DEVICE_ADMIN_ON", "NOTIFICATION_LISTENER_ON", "USER_CA_ADDED"]);
});

test("a certificate already present is not flagged again", () => {
  const prev = { ...base(), userCaCertificates: { count: 1, sha256: ["abc"] } };
  const cur = { ...base(), userCaCertificates: { count: 1, sha256: ["abc"] } };
  assert.deepEqual(signalFlags(prev, cur), []);
});

test("VPN and proxy changes are flagged in both directions", () => {
  assert.deepEqual(codes(signalFlags(base(), { ...base(), vpnActive: true })), ["VPN_ON"]);
  assert.deepEqual(codes(signalFlags({ ...base(), vpnActive: true }, base())), ["VPN_OFF"]);
  assert.deepEqual(codes(signalFlags(base(), { ...base(), proxy: "10.0.0.2:8080" })), ["PROXY_CHANGED"]);
});

test("developer options and USB debugging are flagged only when turned on", () => {
  assert.deepEqual(codes(signalFlags(base(), { ...base(), developerOptions: true, usbDebugging: true })).sort(), [
    "DEVELOPER_OPTIONS_ON",
    "USB_DEBUGGING_ON",
  ]);
  assert.deepEqual(signalFlags({ ...base(), developerOptions: true }, base()), []);
});

test("another app starting to record audio or use a camera is flagged without naming the app", () => {
  const f = signalFlags(base(), { ...base(), microphoneRecordingClients: 2, camerasInUse: 1 });
  assert.deepEqual(codes(f).sort(), ["CAMERA_IN_USE", "MICROPHONE_IN_USE"]);
  for (const x of f) assert.doesNotMatch(x.text, /com\./);
});

test("unknown values (not visible or not reported) are never compared", () => {
  const prev = { ...base(), deviceAdmins: "not visible to this app", microphoneRecordingClients: null, vpnActive: null };
  const cur = { ...base(), deviceAdmins: ["p/q"], microphoneRecordingClients: 3, vpnActive: true };
  assert.deepEqual(signalFlags(prev, cur), []);
});

// Consent path through the core, with a fake Android reader.
function makeMonitor(signalReadings) {
  let i = 0;
  const reads = { n: 0 };
  const collectors = {
    clock: { async read() { return { ok: true, metrics: { wallMs: 1, monoMs: 1 } }; } },
    timing: { async read() { return { ok: true, metrics: { expectedMs: 200, observedMs: 200, lateMs: 0 } }; } },
    vitals: { async read() { return { ok: true, metrics: {} }; } },
    motion: { async read() { return { ok: false, reason: "none" }; }, start() {}, stop() {} },
    signals: {
      async read() {
        reads.n += 1;
        return { ok: true, metrics: signalReadings[Math.min(i++, signalReadings.length - 1)] };
      },
      start() {},
      stop() {},
    },
  };
  const store = new MemoryStore();
  const monitor = createMonitor({ store, collectors, now: () => 1_000_000 });
  return { monitor, store, reads };
}

test("with the signals switch off, the Android reader is never called", async () => {
  const { monitor, store, reads } = makeMonitor([base()]);
  await monitor.init();
  const r = await monitor.sample();
  assert.equal(r.sampled, false);
  assert.equal(reads.n, 0);
  assert.equal((await store.all()).length, 1);
});

test("a signal change between two readings is logged in the chain, and the chain verifies", async () => {
  const { monitor, store, reads } = makeMonitor([
    base(),
    { ...base(), accessibilityServices: ["evil.app/.Svc"] },
  ]);
  await monitor.init();
  await monitor.setGrant("signals", true);
  const first = await monitor.sample();
  assert.equal(first.flags.length, 0, "the first reading after switching on has no baseline");
  const second = await monitor.sample();
  assert.deepEqual(second.flags.map((f) => f.code), ["ACCESSIBILITY_ON"]);
  assert.equal(reads.n, 2);
  const v = await verifyChain(await store.all());
  assert.equal(v.ok, true);
});

test("the baseline is rebuilt from the chain, so a restart does not hide a change", async () => {
  const shared = new MemoryStore();
  const store = shared;
  const m1 = createMonitor({ store, collectors: makeCollectors([base()]), now: () => 1 });
  await m1.init();
  await m1.setGrant("signals", true);
  await m1.sample();
  // A new page session (new monitor object, same chain) reads a changed device.
  const m2 = createMonitor({ store, collectors: makeCollectors([{ ...base(), deviceAdmins: ["p/q"] }]), now: () => 2 });
  await m2.init();
  const r = await m2.sample();
  assert.deepEqual(r.flags.map((f) => f.code), ["DEVICE_ADMIN_ON"]);
  assert.equal((await verifyChain(await store.all())).ok, true);
});

function makeCollectors(readings) {
  let i = 0;
  return {
    clock: { async read() { return { ok: true, metrics: { wallMs: 1, monoMs: 1 } }; } },
    timing: { async read() { return { ok: true, metrics: { expectedMs: 200, observedMs: 200, lateMs: 0 } }; } },
    vitals: { async read() { return { ok: true, metrics: {} }; } },
    motion: { async read() { return { ok: false, reason: "none" }; }, start() {}, stop() {} },
    signals: {
      async read() {
        return { ok: true, metrics: readings[Math.min(i++, readings.length - 1)] };
      },
      start() {},
      stop() {},
    },
  };
}
