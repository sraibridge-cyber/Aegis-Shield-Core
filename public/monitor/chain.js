// AEGIS device monitor: hash-chained record format and verifier.
// Pure logic, no DOM, no network. Runs in the browser and under Node 20+.

export const FORMAT = "aegis-monitor.v1";
export const EXPORT_FORMAT = "aegis-monitor.export";
export const GENESIS_PREV = "0".repeat(64);

// Same canonical rule as the shipped ledger: sorted keys, undefined dropped,
// non-finite numbers rendered as null, no whitespace.
export function canonicalJson(value) {
  return JSON.stringify(canon(value));
}

function canon(v) {
  if (v === null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string" || typeof v === "boolean") return v;
  if (Array.isArray(v)) {
    return v.map((x) => (x === undefined || typeof x === "function" || typeof x === "symbol" ? null : canon(x)));
  }
  if (typeof v === "object") {
    const out = {};
    for (const k of Object.keys(v).sort()) {
      const x = v[k];
      if (x === undefined || typeof x === "function" || typeof x === "symbol") continue;
      out[k] = canon(x);
    }
    return out;
  }
  return null;
}

export async function sha256Hex(text) {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

// The record hash covers the summary as well as the payload, so editing the
// text shown in the log breaks the chain just as editing the data does.
export function hashInput(r) {
  return canonicalJson({
    seq: r.seq,
    ts: r.ts,
    type: r.type,
    summary: r.summary,
    payloadHash: r.payloadHash,
    prevHash: r.prevHash,
  });
}

export async function buildRecord(prev, { type, summary, payload = {}, ts }) {
  const seq = prev ? prev.seq + 1 : 1;
  const prevHash = prev ? prev.hash : GENESIS_PREV;
  const payloadHash = await sha256Hex(canonicalJson(payload));
  const partial = { seq, ts, type, summary, payloadHash, prevHash };
  const hash = await sha256Hex(hashInput(partial));
  return { ...partial, payload, hash };
}

const SHAPE_KEYS = ["seq", "ts", "type", "summary", "payload", "payloadHash", "prevHash", "hash"];

export async function verifyChain(records) {
  const count = records.length;
  const fail = (index, reason, expected, found) => {
    const r = records[index];
    return {
      ok: false,
      count,
      brokenAt: r && Number.isInteger(r.seq) ? r.seq : index + 1,
      index,
      reason,
      expected,
      found,
    };
  };
  let prevHash = GENESIS_PREV;
  let prevSeq = 0;
  for (let i = 0; i < count; i++) {
    const r = records[i];
    if (!r || typeof r !== "object" || SHAPE_KEYS.some((k) => !(k in r))) {
      return fail(i, "record is malformed", "full record", typeof r);
    }
    if (i === 0 && r.type !== "GENESIS") return fail(i, "first record is not GENESIS", "GENESIS", r.type);
    if (r.seq !== prevSeq + 1) return fail(i, "sequence gap, reorder, or deletion", prevSeq + 1, r.seq);
    if (r.prevHash !== prevHash) return fail(i, "link to the previous record is broken", prevHash, r.prevHash);
    const payloadHash = await sha256Hex(canonicalJson(r.payload ?? {}));
    if (payloadHash !== r.payloadHash) return fail(i, "payload was changed after it was written", r.payloadHash, payloadHash);
    const hash = await sha256Hex(hashInput(r));
    if (hash !== r.hash) return fail(i, "record fields were changed after it was written", r.hash, hash);
    prevHash = r.hash;
    prevSeq = r.seq;
  }
  return { ok: true, count, headSeq: prevSeq, headHash: count ? prevHash : null };
}

export function buildExport(records, verification, now = new Date()) {
  const last = records.length ? records[records.length - 1] : null;
  return {
    format: EXPORT_FORMAT,
    version: 1,
    exportedAt: now.toISOString(),
    recordFormat: FORMAT,
    count: records.length,
    headSeq: last ? last.seq : 0,
    headHash: last ? last.hash : null,
    chainAtExport: verification.ok ? "verified" : `broken at record ${verification.brokenAt}`,
    records,
  };
}

// Checks a saved export file. The file's own headHash is compared, and the
// caller may pass a head hash saved somewhere else; a match there is the
// check that catches a whole-chain rewrite.
export async function verifyExport(pack, expectedHeadHash = null) {
  if (!pack || pack.format !== EXPORT_FORMAT || !Array.isArray(pack.records)) {
    return { ok: false, reason: "not an AEGIS device monitor export" };
  }
  const v = await verifyChain(pack.records);
  if (!v.ok) return { ok: false, reason: v.reason, brokenAt: v.brokenAt, count: v.count };
  if (pack.headHash !== v.headHash) {
    return { ok: false, reason: "file's stated head hash does not match its records", count: v.count };
  }
  if (expectedHeadHash && expectedHeadHash.trim() !== v.headHash) {
    return {
      ok: false,
      reason: "chain is internally consistent, but its head hash differs from the one you saved",
      count: v.count,
      headHash: v.headHash,
    };
  }
  return { ok: true, count: v.count, headSeq: v.headSeq, headHash: v.headHash };
}
