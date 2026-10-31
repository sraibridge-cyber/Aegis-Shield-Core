// AEGIS device monitor: the page. Wires the core to the screen.

import { GROUPS, createMonitor } from "./core.js";
import { browserCollectors, GROUP_INFO } from "./sensors.js";
import { MemoryStore, openIdbStore } from "./store.js";
import { verifyExport } from "./chain.js";

const $ = (sel) => document.querySelector(sel);
const esc = (v) =>
  String(v === undefined || v === null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const short = (h) => (h ? `${h.slice(0, 12)}…${h.slice(-8)}` : "none yet");
const when = (ts) => {
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });
};

const collectors = browserCollectors();
let monitor = null;
let storageNote = "";
let lastSnapshot = null;
let busy = false;

async function openStore() {
  try {
    return await openIdbStore();
  } catch (e) {
    storageNote = `This browser would not open local storage (${e.message}). Records last only until you close this page, and the chain cannot be kept between visits.`;
    return new MemoryStore();
  }
}

function permissionStatus(group, grants) {
  if (group === "motion") {
    if (typeof globalThis.DeviceMotionEvent === "undefined") return { label: "Not available in this browser", tone: "off", disabled: true };
    if (motionBlocked) return { label: "Browser blocked motion", tone: "warn", disabled: false };
  }
  return grants[group] ? { label: "On", tone: "on", disabled: false } : { label: "Off", tone: "off", disabled: false };
}

let motionBlocked = false;

function renderPermissions(snap) {
  return GROUPS.map((g) => {
    const info = GROUP_INFO[g];
    const st = permissionStatus(g, snap.grants);
    const checked = snap.grants[g] ? "checked" : "";
    return `
      <div class="row">
        <div class="row-main">
          <div class="row-title">${esc(info.title)} <span class="pill ${st.tone}">${esc(st.label)}</span></div>
          <div class="row-text">${esc(info.reads)}</div>
          <div class="row-gate">${esc(info.gate)}</div>
        </div>
        <label class="switch">
          <input type="checkbox" data-group="${g}" ${checked} ${st.disabled ? "disabled" : ""} aria-label="${esc(info.title)} permission" />
          <span class="slider"></span>
        </label>
      </div>`;
  }).join("");
}

function renderReadings(snap) {
  const obs = snap.lastObservation;
  if (!obs) {
    return `<p class="muted">No reading yet. Switch on at least one permission, or press "Take a reading now".</p>`;
  }
  const p = obs.payload || {};
  const lines = [];
  for (const g of GROUPS) {
    const r = p.readings && p.readings[g];
    if (!r) continue;
    lines.push(`<div class="kv"><span>${esc(GROUP_INFO[g].title)}</span><span>${esc(summariseReading(g, r))}</span></div>`);
  }
  for (const n of p.notRead || []) {
    lines.push(`<div class="kv"><span>${esc(GROUP_INFO[n.group].title)}</span><span class="muted">not read: ${esc(n.reason)}</span></div>`);
  }
  if (!lines.length) lines.push(`<p class="muted">The last reading (${esc(when(obs.ts))}) had no usable values.</p>`);
  return `<p class="muted">Last reading: ${esc(when(obs.ts))}</p>${lines.join("")}`;
}

function summariseReading(g, r) {
  if (g === "clock") return `wall ${Math.round(r.wallMs)} ms, steady ${r.monoMs} ms`;
  if (g === "timing") return `200 ms timer fired ${r.observedMs} ms (${r.lateMs >= 0 ? "+" : ""}${r.lateMs} ms)`;
  if (g === "motion") return `${r.samples} samples over 2 s, mean ${r.meanMs2} m/s², spread ${r.sdMs2}`;
  if (g === "vitals") {
    const b = typeof r.battery === "object" ? `battery ${Math.round(r.battery.level * 100)}%${r.battery.charging === true ? " charging" : ""}` : "battery not shared";
    const c = typeof r.connection === "object" ? `link ${r.connection.effectiveType ?? "unknown"}` : "link not shared";
    return `${b}; ${c}; ${r.visibility}; ${r.cores} CPU core(s)`;
  }
  return JSON.stringify(r);
}

function renderScore(snap) {
  const obs = snap.lastObservation;
  const mu = obs && obs.payload ? obs.payload.mu : null;
  const dims = obs && obs.payload ? Object.keys(obs.payload.dimensions || {}) : [];
  const muLine =
    mu === null || mu === undefined
      ? `<div class="kv"><span>Consistency index μ</span><span class="muted">not computed: needs both Clock agreement and Timer regularity switched on</span></div>`
      : `<div class="kv"><span>Consistency index μ</span><span>${esc(mu)} <span class="muted">(from ${esc(dims.join(" and "))})</span></span></div>`;
  const gateFailures = snap.records.filter((r) => r.type === "GATE_FAILED").length;
  return `
    ${muLine}
    <div class="kv"><span>Threshold τ</span><span class="muted">not set. No reference data exists yet, so no pass or fail verdict is shown.</span></div>
    <div class="kv"><span>Rule R(S): log intact</span><span>${snap.verification.ok ? "yes" : "no"}</span></div>
    <div class="kv"><span>Gate G(S): consent held at every reading</span><span>${gateFailures ? `${gateFailures} reading(s) dropped` : "no drops logged"}</span></div>
    <p class="muted small">μ is a weighted geometric mean of two timing-based scores. The scoring rules are our choice, not calibrated. A high or low μ does not say anything about monitoring.</p>`;
}

function renderFlags(snap) {
  const obs = snap.lastObservation;
  const flags = obs && obs.payload && obs.payload.flags ? obs.payload.flags : [];
  if (!flags.length) {
    return `<p class="muted">None in the last reading.</p><p class="muted small">A flag means the page could not explain a change. Sleep, clock sync, a busy processor, or a power setting can each cause one. A flag is not evidence that anyone is monitoring this device.</p>`;
  }
  return `<ul class="flags">${flags.map((f) => `<li><strong>${esc(f.code)}</strong>: ${esc(f.text)}</li>`).join("")}</ul>
    <p class="muted small">Sleep, clock sync, a busy processor, or a power setting can each cause one. A flag is not evidence that anyone is monitoring this device.</p>`;
}

function renderChain(snap) {
  const v = snap.verification;
  const head = snap.head;
  const status = v.ok
    ? `<div class="chain ok">CHAIN VERIFIES: ${v.count} record${v.count === 1 ? "" : "s"}</div>`
    : `<div class="chain bad">CHAIN BROKEN at record ${esc(v.brokenAt)}: ${esc(v.reason)}</div>`;
  const mismatch = snap.mismatch.length
    ? `<div class="notice warn">The log's switch history does not match the switches shown: ${esc(snap.mismatch.map((g) => GROUP_INFO[g].title).join(", "))}. Something other than this page changed them.</div>`
    : "";
  const durable = snap.durable ? "" : `<div class="notice warn">${esc(storageNote || "Local storage is off. This log is not kept.")}</div>`;
  return `
    ${status}${mismatch}${durable}
    <div class="kv"><span>Head hash</span><span class="mono">${esc(short(head ? head.hash : null))}</span></div>
    <p class="muted small">The head hash is the fingerprint of the whole log. Copy it and keep it somewhere other than this device. If the log is later rewritten, the new head hash will not match the one you kept.</p>
    <div class="actions">
      <button type="button" data-action="verify">Check chain now</button>
      <button type="button" data-action="copy-head" ${head ? "" : "disabled"}>Copy head hash</button>
      <button type="button" data-action="export" ${snap.records.length ? "" : "disabled"}>Export log (.json)</button>
      <label class="button-like">Check an exported file<input type="file" accept="application/json,.json" id="verify-file" hidden /></label>
    </div>
    <label class="field">Head hash you saved elsewhere (optional, used when checking a file)
      <input type="text" id="expected-head" autocomplete="off" spellcheck="false" placeholder="64 hex characters" />
    </label>
    <div id="verify-result"></div>`;
}

function renderLog(snap) {
  const rows = snap.records.slice(-15).reverse();
  if (!rows.length) return `<p class="muted">Nothing recorded yet.</p>`;
  return `<div class="log">${rows
    .map(
      (r) => `<div class="log-row"><span class="mono">#${esc(r.seq)}</span><span class="muted">${esc(when(r.ts))}</span><span class="tag">${esc(r.type)}</span><span>${esc(r.summary)}</span></div>`,
    )
    .join("")}</div>`;
}

function render(snap) {
  lastSnapshot = snap;
  const app = $("#app");
  app.innerHTML = `
    <section class="card">
      <h2>What you have allowed</h2>
      <p class="muted">Every switch starts off. The page works with all of them off. With all of them off it records only changes to the switches.</p>
      ${renderPermissions(snap)}
    </section>
    <section class="card">
      <h2>What it saw</h2>
      ${renderReadings(snap)}
      <div class="actions"><button type="button" data-action="sample">Take a reading now</button></div>
    </section>
    <section class="card">
      <h2>Score and rules</h2>
      ${renderScore(snap)}
    </section>
    <section class="card">
      <h2>Unexplained changes</h2>
      ${renderFlags(snap)}
    </section>
    <section class="card">
      <h2>Sealed log</h2>
      ${renderChain(snap)}
      <h3>Latest entries</h3>
      ${renderLog(snap)}
    </section>
    <section class="card">
      <h2>What this page cannot reach</h2>
      <ul class="list">
        <li>Readings happen only while this page is open and visible. Browsers pause pages in the background.</li>
        <li>Other apps, processes, files, network traffic, and messages on this device.</li>
        <li>Camera, microphone, location, contacts. They are not requested.</li>
        <li>Bluetooth and Wi-Fi scanning, and radio signals. Web pages cannot read them.</li>
        <li>Battery, temperature, and sensor detail on iPhone and some browsers. They share less.</li>
        <li>Whether the browser, the operating system, or the device itself is compromised.</li>
      </ul>
      <p class="muted small">Your records stay in this browser's local storage. The page sends nothing anywhere and loads no outside scripts. Only files it serves itself are used.</p>
    </section>`;
}

async function refresh() {
  const snap = await monitor.snapshot();
  snap.grantedCount = Object.values(snap.grants).filter(Boolean).length;
  render(snap);
}

// Switch changes run one at a time, in the order the taps happened. A tap is
// never dropped because an earlier change is still being written.
let queue = Promise.resolve();
function enqueue(task) {
  const run = queue.then(task, task);
  queue = run.catch(() => {});
  return run;
}

// `access` is the browser's motion prompt, started inside the tap itself.
async function onSwitch(group, turningOn, access) {
  try {
    if (access) {
      const answer = await access;
      if (answer !== "granted") {
        motionBlocked = answer === "denied";
        await monitor.recordDenial("motion", answer === "denied" ? "the browser refused motion access" : "motion is not available here");
        await refresh();
        return;
      }
      motionBlocked = false;
      await monitor.setGrant(group, true, { method: "browser-prompt" });
    } else {
      await monitor.setGrant(group, turningOn, { method: "switch" });
    }
    if (turningOn) await monitor.sample();
    await refresh();
  } catch (e) {
    showNotice(`Could not save that change: ${e.message}`);
    await refresh().catch(() => {});
  }
}

function showNotice(text) {
  const n = $("#global-notice");
  if (n) n.textContent = text;
}

function download(name, text) {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function onAction(action) {
  if (action === "sample") {
    const r = await monitor.sample();
    if (!r.sampled) showNotice(r.reason);
    await refresh();
  } else if (action === "verify") {
    await refresh();
    const v = lastSnapshot.verification;
    $("#verify-result").innerHTML = `<p class="muted small">Checked ${esc(v.count)} record(s) just now. ${v.ok ? "Intact." : `Broken at record ${esc(v.brokenAt)}.`}</p>`;
  } else if (action === "copy-head") {
    const h = lastSnapshot.head && lastSnapshot.head.hash;
    if (h && navigator.clipboard) {
      await navigator.clipboard.writeText(h).catch(() => {});
      showNotice("Head hash copied. Keep it somewhere other than this device.");
    }
  } else if (action === "export") {
    const pack = await monitor.exportPack();
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    download(`aegis-monitor-${stamp}.json`, JSON.stringify(pack, null, 2));
  }
}

function bind() {
  document.addEventListener("change", async (ev) => {
    const t = ev.target;
    if (t && t.matches && t.matches("input[data-group]")) {
      const group = t.dataset.group;
      const on = t.checked;
      // Start the motion prompt before anything else, so it stays inside the tap.
      const access = group === "motion" && on ? collectors.motion.requestAccess() : null;
      enqueue(() => onSwitch(group, on, access));
    } else if (t && t.id === "verify-file" && t.files && t.files[0]) {
      const file = t.files[0];
      let pack;
      try {
        pack = JSON.parse(await file.text());
      } catch {
        pack = null;
      }
      const expected = (document.querySelector("#expected-head") || {}).value || null;
      const r = pack ? await verifyExport(pack, expected) : { ok: false, reason: "file is not valid JSON" };
      const box = $("#verify-result");
      if (r.ok) {
        box.innerHTML = `<div class="chain ok">FILE VERIFIES: ${r.count} record(s), head ${esc(short(r.headHash))}</div>`;
      } else {
        box.innerHTML = `<div class="chain bad">FILE DOES NOT VERIFY${r.brokenAt ? ` at record ${esc(r.brokenAt)}` : ""}: ${esc(r.reason)}</div>`;
      }
      t.value = "";
    }
  });
  document.addEventListener("click", async (ev) => {
    const b = ev.target.closest && ev.target.closest("button[data-action]");
    if (b && !b.disabled) await onAction(b.dataset.action);
  });
}

// Same worker and scope as the AEGIS root, so the page also works offline when
// it is opened on its own. The worker only caches files this site serves.
function registerWorker() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("../service-worker.js").catch(() => {});
}

async function boot() {
  registerWorker();
  const store = await openStore();
  monitor = createMonitor({ store, collectors });
  await monitor.init();
  bind();
  await refresh();
  // Sample every 30 s, only while this page is visible. Readings stop when
  // the page is hidden or closed, and the log shows that gap.
  setInterval(async () => {
    if (document.visibilityState !== "visible") return;
    try {
      await monitor.sample();
      await refresh();
    } catch (e) {
      showNotice(`Reading failed: ${e.message}`);
    }
  }, 30000);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") refresh();
  });
}

boot().catch((e) => {
  const app = $("#app");
  if (app) app.innerHTML = `<section class="card"><h2>Could not start</h2><p>${esc(e.message)}</p></section>`;
});
