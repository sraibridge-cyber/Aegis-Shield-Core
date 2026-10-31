import { test } from "node:test";
import assert from "node:assert/strict";
import { createMonitor, coherence, scoreClock, scoreTiming, loggedGrants, WEIGHTS } from "../../public/monitor/core.js";
import { MemoryStore } from "../../public/monitor/store.js";
import { verifyChain, verifyExport } from "../../public/monitor/chain.js";

function fakeCollectors(state) {
  const calls = { clock: 0, timing: 0, vitals: 0, motion: 0 };
  const started = [];
  const stopped = [];
  return {
    calls,
    started,
    stopped,
    clock: {
      async read() {
        calls.clock++;
        if (state.clockPending) await state.clockPending;
        return { ok: true, metrics: { wallMs: state.wall, monoMs: state.mono } };
      },
    },
    timing: {
      async read() {
        calls.timing++;
        return { ok: true, metrics: { expectedMs: 200, observedMs: 200 + state.late, lateMs: state.late } };
      },
    },
    vitals: {
      async read() {
        calls.vitals++;
        return { ok: true, metrics: { visibility: "visible", cores: 8 } };
      },
    },
    motion: {
      start() {
        started.push("motion");
      },
      stop() {
        stopped.push("motion");
      },
      async read() {
        calls.motion++;
        return { ok: false, reason: "no motion readings in the last 2 seconds" };
      },
    },
  };
}

function makeEnv() {
  const state = { wall: 1_000_000, mono: 5_000, late: 0, clockPending: null };
  const collectors = fakeCollectors(state);
  const store = new MemoryStore();
  const monitor = createMonitor({ store, collectors, now: () => state.wall, intervalMs: 30000 });
  return { state, collectors, store, monitor };
}

test("with zero permissions, no reader runs and only the start record is written", async () => {
  const { collectors, store, monitor } = makeEnv();
  const grants = await monitor.init();
  assert.deepEqual(grants, { clock: false, timing: false, vitals: false, motion: false });
  const r = await monitor.sample();
  assert.equal(r.sampled, false);
  assert.equal(r.reason, "no permissions granted");
  assert.deepEqual(collectors.calls, { clock: 0, timing: 0, vitals: 0, motion: 0 });
  const records = await store.all();
  assert.deepEqual(records.map((x) => x.type), ["GENESIS"]);
  const snap = await monitor.snapshot();
  assert.equal(snap.verification.ok, true);
  assert.equal(snap.lastObservation, null);
});

test("turning a switch on logs consent and only then allows readings", async () => {
  const { collectors, store, monitor, state } = makeEnv();
  await monitor.init();
  await monitor.setGrant("vitals", true, { method: "switch" });
  const types = (await store.all()).map((x) => x.type);
  assert.deepEqual(types, ["GENESIS", "CONSENT"]);
  const r = await monitor.sample();
  assert.equal(r.sampled, true);
  assert.equal(collectors.calls.vitals, 1);
  assert.equal(collectors.calls.clock, 0, "switches that are off are never read");
  assert.equal(collectors.calls.timing, 0);
  assert.deepEqual(Object.keys(r.record.payload.readings), ["vitals"]);
  assert.equal(r.record.payload.mu, null, "one dimension is not enough for mu");
  assert.equal(state.wall, 1_000_000);
  const v = await verifyChain(await store.all());
  assert.equal(v.ok, true);
  assert.equal(v.count, 3);
});

test("turning a switch off stops the reader and logs the change", async () => {
  const { collectors, store, monitor } = makeEnv();
  await monitor.init();
  await monitor.setGrant("motion", true, { method: "browser-prompt" });
  await monitor.setGrant("motion", false, { method: "switch" });
  assert.deepEqual(collectors.started, ["motion"]);
  assert.deepEqual(collectors.stopped, ["motion"]);
  const consent = (await store.all()).filter((r) => r.type === "CONSENT");
  assert.equal(consent.length, 2);
  assert.equal(consent[1].payload.granted, false);
});

test("a switch turned off while its reading is in progress drops that reading and logs the drop", async () => {
  const { collectors, store, monitor, state } = makeEnv();
  await monitor.init();
  await monitor.setGrant("clock", true);
  let release;
  state.clockPending = new Promise((r) => (release = r));
  const pending = monitor.sample();
  await monitor.setGrant("clock", false);
  release();
  const r = await pending;
  assert.equal(r.sampled, false);
  const records = await store.all();
  assert.ok(records.some((x) => x.type === "GATE_FAILED" && x.payload.groups.includes("clock")));
  assert.equal(records.filter((x) => x.type === "OBSERVATION").length, 0, "no reading from a switch that was off at write time");
  assert.equal(collectors.calls.clock, 1);
});

test("the clock step is flagged and the score uses the framework's geometric mean", async () => {
  const { state, store, monitor } = makeEnv();
  await monitor.init();
  await monitor.setGrant("clock", true);
  await monitor.setGrant("timing", true);
  state.late = 0;
  await monitor.sample();
  // 5 s of wall time passes with only 30 s of steady time: a 1-second step of the wall clock.
  state.wall += 30_000 + 5_000;
  state.mono += 30_000;
  const r = await monitor.sample();
  const p = r.record.payload;
  assert.ok(p.flags.some((f) => f.code === "CLOCK_STEP"));
  assert.equal(p.gap, false);
  assert.equal(p.dimensions.clock.driftMs, 5000);
  const expected = Math.exp(WEIGHTS.clock * Math.log(scoreClock(5000)) + WEIGHTS.timing * Math.log(scoreTiming(0)));
  assert.ok(Math.abs(p.mu - Number(expected.toFixed(4))) < 1e-9);
  assert.equal(p.mu_basis.calibrated, false);
  assert.equal(p.mu_basis.tau, null);
  assert.equal((await verifyChain(await store.all())).ok, true);
});

test("a long gap between readings is not scored as a clock step", async () => {
  const { state, monitor, store } = makeEnv();
  await monitor.init();
  await monitor.setGrant("clock", true);
  await monitor.sample();
  state.wall += 10 * 60_000; // device asleep for ten minutes
  state.mono += 10 * 60_000;
  const r = await monitor.sample();
  assert.equal(r.record.payload.gap, true);
  assert.equal(r.record.payload.dimensions.clock, undefined);
  assert.equal(r.record.payload.flags.length, 0);
  assert.equal((await verifyChain(await store.all())).ok, true);
});

test("a late timer is flagged on its own", async () => {
  const { state, monitor } = makeEnv();
  await monitor.init();
  await monitor.setGrant("timing", true);
  state.late = 900;
  const r = await monitor.sample();
  assert.ok(r.record.payload.flags.some((f) => f.code === "TIMER_LATE"));
});

test("a reader that throws is reported as not read, and the others still record", async () => {
  const { collectors, monitor, store } = makeEnv();
  collectors.vitals.read = async () => {
    throw new Error("sensor exploded");
  };
  await monitor.init();
  await monitor.setGrant("vitals", true);
  await monitor.setGrant("clock", true);
  const r = await monitor.sample();
  assert.equal(r.sampled, true);
  assert.deepEqual(r.notRead, [{ group: "vitals", reason: "sensor exploded" }]);
  assert.ok(r.record.payload.readings.clock);
  assert.equal((await verifyChain(await store.all())).ok, true);
});

test("the browser refusing motion is logged, and the switch stays off", async () => {
  const { store, monitor } = makeEnv();
  await monitor.init();
  await monitor.recordDenial("motion", "the browser refused motion access");
  const rec = (await store.all()).at(-1);
  assert.equal(rec.type, "CONSENT");
  assert.equal(rec.payload.method, "browser-denied");
  assert.equal(monitor.grants().motion, false);
  assert.equal(loggedGrants(await store.all()).motion, false);
});

test("a switch change made outside the page shows up as a mismatch against the log", async () => {
  const { store, monitor } = makeEnv();
  await monitor.init();
  await monitor.setGrant("vitals", true);
  await store.setMeta("grants", { clock: true, timing: false, vitals: true, motion: false });
  const fresh = createMonitor({ store, collectors: fakeCollectors({ wall: 1, mono: 1, late: 0 }) });
  await fresh.init();
  const snap = await fresh.snapshot();
  assert.deepEqual(snap.mismatch, ["clock"]);
});

test("editing a stored record breaks the chain shown to the user", async () => {
  const { store, monitor } = makeEnv();
  await monitor.init();
  await monitor.setGrant("vitals", true);
  store.records[1].summary = "vitals off";
  const snap = await monitor.snapshot();
  assert.equal(snap.verification.ok, false);
  assert.equal(snap.verification.brokenAt, 2);
});

test("two tabs writing to one log never fork it", async () => {
  const store = new MemoryStore();
  const envA = makeEnv();
  const envB = makeEnv();
  const a = createMonitor({ store, collectors: envA.collectors, now: () => 1_000_000 });
  const b = createMonitor({ store, collectors: envB.collectors, now: () => 1_000_000 });
  await a.init();
  await b.init();
  await Promise.all([a.setGrant("vitals", true), b.setGrant("timing", true), a.sample(), b.sample()]);
  const v = await verifyChain(await store.all());
  assert.equal(v.ok, true, "every write was built on the head it was appended to");
  assert.equal(store.records.filter((r) => r.type === "GENESIS").length, 1);
});

test("an exported file from the page verifies and matches the saved head", async () => {
  const { store, monitor } = makeEnv();
  await monitor.init();
  await monitor.setGrant("vitals", true);
  await monitor.sample();
  const pack = await monitor.exportPack();
  const v = await verifyChain(await store.all());
  const r = await verifyExport(JSON.parse(JSON.stringify(pack)), v.headHash);
  assert.equal(r.ok, true);
  assert.equal(r.count, 3);
});

test("the consistency score is a weighted geometric mean, not an arithmetic one", () => {
  const mu = coherence({ clock: { score: 0.5 }, timing: { score: 1 } });
  assert.ok(Math.abs(mu - 0.5 ** 0.6) < 1e-12);
  const arithmetic = 0.6 * 0.5 + 0.4 * 1;
  assert.ok(mu < arithmetic);
  assert.equal(coherence({ clock: { score: 0.9 } }), null);
});
