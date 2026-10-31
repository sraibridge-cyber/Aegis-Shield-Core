import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildRecord,
  verifyChain,
  canonicalJson,
  buildExport,
  verifyExport,
  GENESIS_PREV,
} from "../../public/monitor/chain.js";

async function makeChain(n = 5) {
  const out = [];
  let prev = null;
  for (let i = 0; i < n; i++) {
    const rec = await buildRecord(prev, {
      type: i === 0 ? "GENESIS" : "OBSERVATION",
      summary: `entry ${i + 1}`,
      payload: { i, reading: { level: 0.5 + i / 100 } },
      ts: `2026-10-31T12:00:${String(i).padStart(2, "0")}.000Z`,
    });
    out.push(rec);
    prev = rec;
  }
  return out;
}

const clone = (x) => JSON.parse(JSON.stringify(x));

test("canonical JSON sorts keys, drops undefined and maps non-finite numbers to null", () => {
  assert.equal(canonicalJson({ b: 1, a: { d: undefined, c: [NaN, 2] } }), '{"a":{"c":[null,2]},"b":1}');
});

test("a clean chain verifies and reports its head", async () => {
  const chain = await makeChain(5);
  assert.equal(chain[0].prevHash, GENESIS_PREV);
  const v = await verifyChain(chain);
  assert.equal(v.ok, true);
  assert.equal(v.count, 5);
  assert.equal(v.headSeq, 5);
  assert.equal(v.headHash, chain[4].hash);
});

test("an empty log verifies with no head", async () => {
  const v = await verifyChain([]);
  assert.equal(v.ok, true);
  assert.equal(v.count, 0);
  assert.equal(v.headHash, null);
});

test("editing a payload is detected at that record", async () => {
  const chain = await makeChain(5);
  const bad = clone(chain);
  bad[2].payload.reading.level = 0.99;
  const v = await verifyChain(bad);
  assert.equal(v.ok, false);
  assert.equal(v.brokenAt, 3);
  assert.match(v.reason, /payload was changed/);
});

test("editing the summary text is detected, because the hash covers it", async () => {
  const chain = await makeChain(4);
  const bad = clone(chain);
  bad[1].summary = "nothing happened here";
  const v = await verifyChain(bad);
  assert.equal(v.ok, false);
  assert.equal(v.brokenAt, 2);
  assert.match(v.reason, /record fields were changed/);
});

test("editing a timestamp is detected", async () => {
  const chain = await makeChain(4);
  const bad = clone(chain);
  bad[3].ts = "2026-10-31T09:00:00.000Z";
  const v = await verifyChain(bad);
  assert.equal(v.ok, false);
  assert.equal(v.brokenAt, 4);
});

test("deleting a record in the middle is detected as a sequence gap", async () => {
  const chain = await makeChain(5);
  const bad = clone(chain);
  bad.splice(2, 1);
  const v = await verifyChain(bad);
  assert.equal(v.ok, false);
  assert.match(v.reason, /sequence gap/);
});

test("reordering two records is detected", async () => {
  const chain = await makeChain(4);
  const bad = clone(chain);
  [bad[1], bad[2]] = [bad[2], bad[1]];
  const v = await verifyChain(bad);
  assert.equal(v.ok, false);
});

test("a log that does not begin with GENESIS is rejected", async () => {
  const chain = await makeChain(3);
  const v = await verifyChain(clone(chain).slice(1));
  assert.equal(v.ok, false);
});

test("a malformed record is rejected rather than crashing the verifier", async () => {
  const chain = await makeChain(3);
  const bad = clone(chain);
  delete bad[1].hash;
  const v = await verifyChain(bad);
  assert.equal(v.ok, false);
  assert.match(v.reason, /malformed/);
});

test("dropping the newest records still verifies locally, but the saved head hash catches it", async () => {
  const chain = await makeChain(6);
  const saved = chain[5].hash;
  const truncated = chain.slice(0, 4);
  const local = await verifyChain(truncated);
  assert.equal(local.ok, true, "chain alone cannot see a clean tail cut");
  const pack = buildExport(truncated, local, new Date("2026-10-31T13:00:00Z"));
  const r = await verifyExport(pack, saved);
  assert.equal(r.ok, false);
  assert.match(r.reason, /head hash differs/);
});

test("a full rewrite with recomputed hashes passes locally but changes the head hash", async () => {
  const chain = await makeChain(4);
  const savedHead = chain[3].hash;
  const forged = [];
  let prev = null;
  for (const r of chain) {
    const rec = await buildRecord(prev, { type: r.type, summary: r.summary, payload: r.payload, ts: r.ts });
    if (rec.summary === "entry 2") {
      const edited = await buildRecord(prev, { type: r.type, summary: "entry 2 (edited)", payload: r.payload, ts: r.ts });
      forged.push(edited);
      prev = edited;
      continue;
    }
    forged.push(rec);
    prev = rec;
  }
  const local = await verifyChain(forged);
  assert.equal(local.ok, true, "someone with the file can rebuild a self-consistent chain");
  assert.notEqual(local.headHash, savedHead, "but the head hash moves, which an off-device copy reveals");
});

test("a good export verifies; an edited export fails", async () => {
  const chain = await makeChain(4);
  const v = await verifyChain(chain);
  const pack = buildExport(chain, v, new Date("2026-10-31T13:00:00Z"));
  const good = await verifyExport(clone(pack), v.headHash);
  assert.equal(good.ok, true);
  assert.equal(good.count, 4);

  const edited = clone(pack);
  edited.records[1].payload.i = 42;
  const bad = await verifyExport(edited);
  assert.equal(bad.ok, false);
  assert.equal(bad.brokenAt, 2);
});

test("an export with a wrong stated head hash is rejected", async () => {
  const chain = await makeChain(3);
  const v = await verifyChain(chain);
  const pack = buildExport(chain, v);
  pack.headHash = "f".repeat(64);
  const r = await verifyExport(pack);
  assert.equal(r.ok, false);
});

test("a file that is not an export is refused", async () => {
  const r = await verifyExport({ hello: "world" });
  assert.equal(r.ok, false);
});
