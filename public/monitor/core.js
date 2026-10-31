// AEGIS device monitor: consent, sampling, consistency scoring and the log.
// No browser globals are used at import time, so this module runs under Node
// for the tests. Every reader is injected through `collectors`.

import { buildRecord, verifyChain, buildExport, FORMAT } from "./chain.js";

export const GROUPS = ["clock", "timing", "vitals", "motion"];
export const DEFAULT_GRANTS = { clock: false, timing: false, vitals: false, motion: false };

// Operator choices for the CC layer. The framework requires tau to be derived
// from a reference battery; there is none yet, so tau is never set here.
export const WEIGHTS = { clock: 0.6, timing: 0.4 };
export const LIMITS = {
  clockScaleMs: 100, // drift of this size halves the clock score
  timerScaleMs: 50, // lateness of this size halves the timer score
  clockStepMs: 1000, // drift above this, with no sampling gap, is flagged
  timerLateMs: 500, // a probe this late is flagged
};

export const scoreClock = (driftMs) => 1 / (1 + Math.abs(driftMs) / LIMITS.clockScaleMs);
export const scoreTiming = (lateMs) => 1 / (1 + Math.max(0, lateMs) / LIMITS.timerScaleMs);

// Weighted geometric mean, mu = exp(sum w_i ln s_i). Computed only when both
// dimensions were measured in the same reading; otherwise there is no mu.
export function coherence(dims) {
  if (!dims.clock || !dims.timing) return null;
  return Math.exp(WEIGHTS.clock * Math.log(dims.clock.score) + WEIGHTS.timing * Math.log(dims.timing.score));
}

const round = (x, d = 4) => (typeof x === "number" && Number.isFinite(x) ? Math.round(x * 10 ** d) / 10 ** d : x);
const errText = (e) => String((e && e.message) || e);

export function loggedGrants(records) {
  const out = { ...DEFAULT_GRANTS };
  for (const r of records) {
    if (r.type === "CONSENT" && r.payload && GROUPS.includes(r.payload.group) && r.payload.method !== "browser-denied") {
      out[r.payload.group] = r.payload.granted === true;
    }
  }
  return out;
}

export function createMonitor({ store, collectors, now = () => Date.now(), intervalMs = 30000 }) {
  let grants = { ...DEFAULT_GRANTS };
  let prevClock = null;
  let busy = false;
  let sampleCount = 0;

  const grantedNow = () => GROUPS.filter((g) => grants[g]);
  const stamp = () => new Date(now()).toISOString();

  // Every write goes through here: build on the current head, then append only
  // if the head has not moved. A moved head means another tab wrote first.
  async function append(type, summary, payload) {
    for (let attempt = 0; attempt < 5; attempt++) {
      const head = await store.head();
      const rec = await buildRecord(head, { type, summary, payload, ts: stamp() });
      const r = await store.appendIfHead(head ? head.seq : 0, head ? head.hash : null, rec);
      if (r.ok) return rec;
      if (r.reason !== "HEAD_MOVED") break;
    }
    throw new Error("could not write to the log");
  }

  async function init() {
    const saved = await store.getMeta("grants");
    grants = { ...DEFAULT_GRANTS };
    for (const g of GROUPS) grants[g] = !!(saved && saved[g] === true);
    if (!(await store.head())) {
      const rec = await buildRecord(null, {
        type: "GENESIS",
        summary: "device monitor chain started",
        payload: { format: FORMAT, grants: { ...grants } },
        ts: stamp(),
      });
      await store.appendIfHead(0, null, rec);
    }
    return { ...grants };
  }

  async function setGrant(group, granted, { method = "switch" } = {}) {
    if (!GROUPS.includes(group)) throw new Error(`unknown group: ${group}`);
    const want = granted === true;
    if (grants[group] === want) return { changed: false, grants: { ...grants } };
    grants = { ...grants, [group]: want };
    await store.setMeta("grants", grants);
    if (want) {
      if (collectors[group] && collectors[group].start) collectors[group].start();
    } else {
      if (collectors[group] && collectors[group].stop) collectors[group].stop();
      if (group === "clock") prevClock = null;
    }
    await append("CONSENT", `${group} ${want ? "on" : "off"}`, { group, granted: want, method });
    return { changed: true, grants: { ...grants } };
  }

  // Called when the browser itself refuses a permission. Logged, grants unchanged.
  async function recordDenial(group, reason) {
    await append("CONSENT", `${group} not granted by the browser`, {
      group,
      granted: false,
      method: "browser-denied",
      reason,
    });
  }

  async function sample() {
    if (busy) return { sampled: false, reason: "a reading is already in progress" };
    const asked = grantedNow();
    if (asked.length === 0) return { sampled: false, reason: "no permissions granted" };
    busy = true;
    try {
      const results = {};
      await Promise.all(
        asked.map(async (g) => {
          try {
            results[g] = await collectors[g].read();
          } catch (e) {
            results[g] = { ok: false, reason: errText(e) };
          }
        }),
      );

      // Consent gate, checked again now that the readings are in. A switch
      // turned off during a reading means that reading is dropped and logged.
      const still = new Set(grantedNow());
      const gateFailed = asked.filter((g) => !still.has(g));
      for (const g of gateFailed) delete results[g];
      if (gateFailed.length) {
        await append("GATE_FAILED", `reading dropped: ${gateFailed.join(", ")} switched off during the reading`, {
          groups: gateFailed,
        });
      }
      const kept = asked.filter((g) => still.has(g));
      if (kept.length === 0) return { sampled: false, reason: "all permissions were switched off during the reading" };

      const readings = {};
      const notRead = [];
      for (const g of kept) {
        if (results[g] && results[g].ok) readings[g] = results[g].metrics;
        else notRead.push({ group: g, reason: results[g] ? results[g].reason : "no result" });
      }

      const dims = {};
      const flags = [];
      let gap = false;
      if (readings.clock) {
        const cur = { wallMs: readings.clock.wallMs, monoMs: readings.clock.monoMs };
        if (prevClock) {
          const dWall = cur.wallMs - prevClock.wallMs;
          const dMono = cur.monoMs - prevClock.monoMs;
          // A long gap between readings (sleep, suspended tab) is not scored.
          gap = dWall > intervalMs * 2 || dMono > intervalMs * 2 || dMono < 0;
          if (!gap) {
            const drift = dWall - dMono;
            dims.clock = { score: round(scoreClock(drift)), driftMs: round(drift, 1) };
            if (Math.abs(drift) > LIMITS.clockStepMs) {
              flags.push({
                code: "CLOCK_STEP",
                text: `The wall clock moved ${Math.round(Math.abs(drift) / 100) / 10} s against the steady clock since the last reading.`,
              });
            }
          }
        }
        prevClock = cur;
      }
      if (readings.timing) {
        dims.timing = { score: round(scoreTiming(readings.timing.lateMs)), lateMs: readings.timing.lateMs };
        if (readings.timing.lateMs > LIMITS.timerLateMs) {
          flags.push({
            code: "TIMER_LATE",
            text: `A 200 ms timer fired ${Math.round(readings.timing.lateMs)} ms late.`,
          });
        }
      }

      const mu = coherence(dims);
      const payload = {
        readings,
        notRead,
        dimensions: dims,
        mu: mu === null ? null : round(mu),
        mu_basis: {
          weights: { ...WEIGHTS },
          dimensions_used: Object.keys(dims),
          calibrated: false,
          tau: null,
        },
        gap,
        flags,
      };
      const parts = [`readings: ${Object.keys(readings).join(", ") || "none"}`];
      parts.push(mu === null ? "mu not computed" : `mu ${payload.mu} (uncalibrated)`);
      if (flags.length) parts.push(`${flags.length} unexplained change(s)`);
      const rec = await append("OBSERVATION", parts.join("; "), payload);
      sampleCount += 1;
      return { sampled: true, record: rec, mu: payload.mu, flags, notRead };
    } finally {
      busy = false;
    }
  }

  async function snapshot() {
    const records = await store.all();
    const verification = await verifyChain(records);
    const logged = loggedGrants(records);
    const mismatch = GROUPS.filter((g) => logged[g] !== grants[g]);
    const lastObs = [...records].reverse().find((r) => r.type === "OBSERVATION") || null;
    return {
      grants: { ...grants },
      loggedGrants: logged,
      mismatch,
      records,
      verification,
      head: records.length ? records[records.length - 1] : null,
      lastObservation: lastObs,
      durable: !!store.durable,
      intervalMs,
      sampleCount,
    };
  }

  async function exportPack() {
    const records = await store.all();
    const verification = await verifyChain(records);
    return buildExport(records, verification, new Date(now()));
  }

  return { init, setGrant, recordDenial, sample, snapshot, exportPack, grants: () => ({ ...grants }) };
}
