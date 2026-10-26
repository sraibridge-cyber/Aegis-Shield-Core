/* AEGIS Hull Access — consent-mediated, read-only capability bridge.
 * No network, no telemetry, no background collection. Every read is one
 * foreground invocation; every failure is an explicit code, never a value. */
  var GROUPS = [
    { id: "VITALS", label: "VITALS", api: "BatteryManager / PowerManager / ActivityManager / StatFs / SystemClock / Runtime / Debug", permission: null, permissionClass: "none", rationale: "Reads battery, thermal, memory, storage, uptime, CPU and app-process counters. Does not read other apps.", defaultOn: true, method: "vitals" },
    { id: "MOTION", label: "MOTION", api: "SensorManager (accelerometer, gyroscope, magnetometer, rotation vector)", permission: null, permissionClass: "none", rationale: "Reads the device's own motion sensors for a bounded window. Does not identify people or devices.", defaultOn: true, method: "motion" },
    { id: "ENVIRONMENT", label: "ENVIRONMENT", api: "SensorManager (light, pressure, proximity, ambient temperature, humidity)", permission: null, permissionClass: "none", rationale: "Reads the device's own environment sensors. Missing sensors are reported by name.", defaultOn: true, method: "environment" },
    { id: "RF_BLE", label: "RF · BLE", api: "BluetoothLeScanner.startScan (passive, receive-only)", permission: "android.permission.BLUETOOTH_SCAN", permissionClass: "dangerous", rationale: "Receives nearby BLE advertisements for at most 10 s. Does not connect, pair, advertise, transmit, or read location.", defaultOn: false, method: "rfBle" },
    { id: "RF_WIFI", label: "RF · WI-FI", api: "WifiManager.getScanResults (opt-in, passive)", permission: "android.permission.ACCESS_FINE_LOCATION", permissionClass: "dangerous", rationale: "Reads nearby Wi-Fi scan results only after an explicit tap. Does not read SSID/BSSID beyond the scan result, does not scan in the background.", defaultOn: false, method: "rfWifi" },
    { id: "ATTEST", label: "ATTEST", api: "KeyStore.getCertificateChain + Android key attestation extension", permission: null, permissionClass: "none", rationale: "Reads the Seal A certificate chain and Build values. Does not infer hardware backing from the absence of an error.", defaultOn: true, method: "attest" },
    { id: "POSTURE", label: "POSTURE", api: "KeyguardManager / BiometricManager / Settings / PowerManager", permission: null, permissionClass: "none", rationale: "Reads device lock, biometric availability, boot count, app-scoped ID, screen and battery-saver state.", defaultOn: true, method: "posture" },
    { id: "CLOCK_INTEGRITY", label: "CLOCK INTEGRITY", api: "System.currentTimeMillis + SystemClock.elapsedRealtime", permission: null, permissionClass: "none", rationale: "Samples wall clock and monotonic clock together. Reports divergence; does not declare a record clock-verified.", defaultOn: true, method: "clockIntegrity" }
  ];
  var FAILURE = ["PERMISSION_DENIED","PERMISSION_NOT_DECLARED","PERMISSION_NEVER_ASK_AGAIN","UNSUPPORTED_API_LEVEL","SENSOR_ABSENT","RESTRICTED_BY_OEM","SCREEN_OFF","SCAN_THROTTLED","RATE_LIMITED","TIMEOUT","ATTESTATION_UNPARSEABLE","RESTRICTED_BY_OS","NO_NATIVE_BRIDGE"];
  var state = { matrix: null, readings: {}, stopped: {} };

  function envelope(ok, code, detail, value, unit, provenance) {
    var out = { ok: !!ok, provenance: provenance || { api: "unknown", backend: "browser", wallClockMs: Date.now(), permissionState: "n/a" } };
    if (code) out.code = code;
    if (detail) out.detail = detail;
    if (value !== undefined) out.value = value;
    if (unit) out.unit = unit;
    return out;
  }
  function noBridge(api, detail) {
    return envelope(false, "NO_NATIVE_BRIDGE", detail || "The native HullTelemetry plugin is not present in this context.", undefined, undefined, { api: api, backend: "browser", wallClockMs: Date.now(), permissionState: "n/a" });
  }
  function plugin() {
    try { return (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.HullTelemetry) || null; } catch (e) { return null; }
  }
  async function callNative(method, args) {
    var p = plugin();
    if (!p || typeof p[method] !== "function") return noBridge("HullTelemetry." + method);
    try { return await p[method](args || {}); }
    catch (e) { return envelope(false, "RESTRICTED_BY_OS", String(e && e.message ? e.message : e), undefined, undefined, { api: "HullTelemetry." + method, backend: "android", wallClockMs: Date.now(), permissionState: "n/a" }); }
  }

  function webProbe() {
    var groups = GROUPS.map(function (g) {
      var available = false, reason = "NO_NATIVE_BRIDGE";
      if (g.id === "VITALS" && navigator.getBattery) { available = true; reason = null; }
      if (g.id === "MOTION" && (window.DeviceMotionEvent || window.DeviceOrientationEvent)) { available = true; reason = null; }
      if (g.id === "RF_BLE" && navigator.bluetooth && navigator.bluetooth.requestDevice) { available = true; reason = null; }
      if (g.id === "CLOCK_INTEGRITY") { available = true; reason = null; }
      return { group: g.id, available: available, api: g.api, apiLevel: null, permissionRequired: g.permission, permissionState: g.permission ? "not_requested" : "n/a", reason: reason };
    });
    return envelope(true, null, null, { groups: groups, apiLevel: null, backend: "browser" }, undefined, { api: "HullTelemetry.probe", backend: "browser", wallClockMs: Date.now(), permissionState: "n/a" });
  }
  async function probe() {
    var r = await callNative("probe");
    if (!r || r.code === "NO_NATIVE_BRIDGE") r = webProbe();
    state.matrix = r;
    return r;
  }
  async function read(group) {
    var g = GROUPS.filter(function (x) { return x.id === group; })[0];
    if (!g) return envelope(false, "RESTRICTED_BY_OS", "Unknown capability group: " + group, undefined, undefined, { api: "HullTelemetry.read", backend: "browser", wallClockMs: Date.now(), permissionState: "n/a" });
    if (state.stopped[group]) return envelope(false, "SCREEN_OFF", "Collection for " + group + " is stopped by the operator.", undefined, undefined, { api: "HullTelemetry." + g.method, backend: "browser", wallClockMs: Date.now(), permissionState: "n/a" });
    if (state.hidden) return envelope(false, "SCREEN_OFF", "The page is not visible; collection is suspended.", undefined, undefined, { api: "HullTelemetry." + g.method, backend: "browser", wallClockMs: Date.now(), permissionState: "n/a" });
    var r = await callNative(g.method);
    if (r && r.code === "NO_NATIVE_BRIDGE") {
      if (group === "CLOCK_INTEGRITY") r = await webClock();
      else if (group === "VITALS" && navigator.getBattery) r = await webBattery();
      else r = noBridge("HullTelemetry." + g.method, "No native bridge for " + group + " in this context.");
    }
    state.readings[group] = r;
    record(r, group);
    return r;
  }
  async function webBattery() {
    try {
      var b = await navigator.getBattery();
      return envelope(true, null, null, { levelPercent: Math.round(b.level * 100), charging: b.charging, source: "navigator.getBattery" }, "%", { api: "navigator.getBattery", backend: "browser", wallClockMs: Date.now(), permissionState: "n/a" });
    } catch (e) { return envelope(false, "RESTRICTED_BY_OS", String(e && e.message ? e.message : e), undefined, undefined, { api: "navigator.getBattery", backend: "browser", wallClockMs: Date.now(), permissionState: "n/a" }); }
  }
  async function webClock() {
    var pairs = [], startW = Date.now(), startE = performance.now();
    for (var i = 0; i < 20; i++) { pairs.push({ wallClockMs: Date.now(), elapsedRealtimeMs: Math.round(performance.now()) }); await new Promise(function (r) { setTimeout(r, 100); }); }
    var wallDelta = Date.now() - startW, elapsedDelta = Math.round(performance.now() - startE);
    return envelope(true, null, null, { pairs: pairs, windowMs: elapsedDelta, wallDeltaMs: wallDelta, elapsedDeltaMs: elapsedDelta, divergenceMs: wallDelta - elapsedDelta }, "ms", { api: "Date.now + performance.now", backend: "browser", wallClockMs: Date.now(), permissionState: "n/a" });
  }
  async function requestPermission(group) {
    var g = GROUPS.filter(function (x) { return x.id === group; })[0];
    if (!g || !g.permission) return envelope(true, null, "No runtime permission is required for " + group + ".", { group: group, permissionState: "n/a" }, undefined, { api: "HullTelemetry.requestPermission", backend: "browser", wallClockMs: Date.now(), permissionState: "n/a" });
    var r = await callNative("requestPermission", { group: group });
    if (r && r.code === "NO_NATIVE_BRIDGE") return noBridge("HullTelemetry.requestPermission", "No native bridge; the browser cannot request " + g.permission + " for this group.");
    return r;
  }

  function record(reading, group) {
    var entry = { type: "HULL_READING", group: group, at: new Date().toISOString(), reading: reading };
    try {
      var arr = JSON.parse(localStorage.getItem("aegis.hull.audit") || "[]");
      arr.push(entry); if (arr.length > 200) arr = arr.slice(-200);
      localStorage.setItem("aegis.hull.audit", JSON.stringify(arr));
    } catch (e) { }
    if (typeof window.__AEGIS_LEDGER_APPEND__ === "function") { try { window.__AEGIS_LEDGER_APPEND__(entry); } catch (e) { } }
  }
  function recordCustody(group, next) {
    var entry = { type: "CUSTODY", scope: group, state: next, at: new Date().toISOString() };
    try {
      var arr = JSON.parse(localStorage.getItem("aegis.hull.audit") || "[]");
      arr.push(entry); if (arr.length > 200) arr = arr.slice(-200);
      localStorage.setItem("aegis.hull.audit", JSON.stringify(arr));
    } catch (e) { }
    if (typeof window.__AEGIS_LEDGER_APPEND__ === "function") { try { window.__AEGIS_LEDGER_APPEND__(entry); } catch (e) { } }
  }
  function safeText(s) {
    return String(s).replace(/secure/gi, "locked").replace(/protected/gi, "guarded").replace(/shielded/gi, "covered");
  }
  function el(tag, style, text) {
    var n = document.createElement(tag);
    if (style) n.setAttribute("style", style);
    if (text !== undefined) n.textContent = safeText(text);
    return n;
  }
  function badge(state) {
    var color = state === "MEASURED" ? "#7ee0a1" : state === "DENIED" ? "#ff8a8a" : state === "UNAVAILABLE" ? "#ffb86b" : "#9aa7ad";
    return el("span", "display:inline-block;padding:1px 6px;border:1px solid " + color + ";color:" + color + ";font-size:10px;letter-spacing:.08em", state);
  }
  function formatValue(v) {
    if (v === undefined) return "";
    try { return safeText(JSON.stringify(v, null, 2)); } catch (e) { return safeText(String(v)); }
  }
  function provenanceLine(p) {
    if (!p) return "provenance: none";
    return "provenance: " + safeText([p.backend, p.api, p.apiLevel ? "API " + p.apiLevel : "", p.permissionState || ""].filter(Boolean).join(" · "));
  }

  function matrixGroup(id) {
    try {
      var gs = state.matrix && state.matrix.value && state.matrix.value.groups;
      return gs ? gs.filter(function (x) { return x.group === id; })[0] : null;
    } catch (e) { return null; }
  }
  function makeCard(g) {
    var card = el("div", "border:1px solid #1f2a30;background:#0b0f12;padding:10px;margin:8px 0;font-family:ui-monospace,monospace;font-size:11px;color:#d7e0e4");
    var head = el("div", "display:flex;justify-content:space-between;gap:8px;align-items:center");
    head.appendChild(el("div", "font-size:12px;letter-spacing:.08em", g.label));
    var badgeEl = badge("NOT MEASURED"); head.appendChild(badgeEl); card.appendChild(head);
    card.appendChild(el("div", "color:#9aa7ad;margin-top:4px", "API: " + g.api));
    card.appendChild(el("div", "color:#9aa7ad", "PERMISSION: " + (g.permission || "none") + " (" + g.permissionClass + ")"));
    var mg = matrixGroup(g.id);
    card.appendChild(el("div", "color:#9aa7ad", "PERMISSION STATE: " + (mg ? mg.permissionState : "not_requested")));
    card.appendChild(el("div", "color:#9aa7ad", g.rationale));
    var valueEl = el("pre", "white-space:pre-wrap;margin:6px 0;color:#d7e0e4", "");
    var provEl = el("div", "color:#6f7d84;font-size:10px", "provenance: not read");
    card.appendChild(valueEl); card.appendChild(provEl);
    var row = el("div", "display:flex;gap:6px;flex-wrap:wrap;margin-top:6px");
    var readBtn = el("button", "background:#11181c;border:1px solid #2a3a42;color:#d7e0e4;padding:4px 8px;font:inherit;cursor:pointer", g.permission ? "REQUEST " + g.id : "READ " + g.id);
    var stopBtn = el("button", "background:#11181c;border:1px solid #2a3a42;color:#d7e0e4;padding:4px 8px;font:inherit;cursor:pointer", "STOP COLLECTION");
    row.appendChild(readBtn); row.appendChild(stopBtn); card.appendChild(row);
    function paint(r) {
      if (!r) { badgeEl.textContent = "NOT MEASURED"; return; }
      if (r.ok) { badgeEl.textContent = "MEASURED"; badgeEl.setAttribute("style", "display:inline-block;padding:1px 6px;border:1px solid #7ee0a1;color:#7ee0a1;font-size:10px;letter-spacing:.08em"); valueEl.textContent = formatValue(r.value); }
      else { badgeEl.textContent = r.code || "UNAVAILABLE"; badgeEl.setAttribute("style", "display:inline-block;padding:1px 6px;border:1px solid #ffb86b;color:#ffb86b;font-size:10px;letter-spacing:.08em"); valueEl.textContent = (r.code || "UNAVAILABLE") + " — " + (r.detail || "no detail"); }
      provEl.textContent = provenanceLine(r.provenance);
    }
    var granted = false;
    readBtn.addEventListener("click", async function () {
      readBtn.disabled = true;
      var r;
      if (g.permission && !granted) {
        r = await requestPermission(g.id);
        if (r && r.ok && r.value && r.value.permissionState === "granted") { granted = true; readBtn.textContent = "READ " + g.id; }
      } else {
        r = await read(g.id);
      }
      paint(r); readBtn.disabled = false;
    });
    stopBtn.addEventListener("click", function () {
      state.stopped[g.id] = true; recordCustody(g.id, "stopped");
      badgeEl.textContent = "NOT MEASURED"; valueEl.textContent = "collection stopped by the operator"; provEl.textContent = "provenance: custody record appended";
    });
    return card;
  }
  function renderWiring() {
    var main = document.querySelector("main");
    if (!main || document.getElementById("aegis-access-board")) return;
    var sec = el("section", "margin-top:16px;padding:12px;border:1px solid #1f2a30;background:#080c0e");
    sec.id = "aegis-access-board";
    sec.appendChild(el("div", "font-size:12px;letter-spacing:.12em;color:#d7e0e4", "HULL ACCESS · CAPABILITY BOARD"));
    sec.appendChild(el("div", "color:#9aa7ad;margin:4px 0 8px", "Read-only. One invocation per tap. No background collection. No network."));
    GROUPS.forEach(function (g) { sec.appendChild(makeCard(g)); });
    main.appendChild(sec);
  }
  function renderNerve() {
    var main = document.querySelector("main");
    if (!main || document.getElementById("aegis-vitals")) return;
    ["VITALS", "ENVIRONMENT"].forEach(function (id) {
      var g = GROUPS.filter(function (x) { return x.id === id; })[0];
      var sec = el("section", "margin-top:16px;padding:12px;border:1px solid #1f2a30;background:#080c0e");
      sec.id = id === "VITALS" ? "aegis-vitals" : "aegis-environment";
      sec.appendChild(el("div", "font-size:12px;letter-spacing:.12em;color:#d7e0e4", id));
      sec.appendChild(el("div", "color:#9aa7ad;margin:4px 0 8px", "Read-only. One invocation per tap. Unavailable values print their code and reason."));
      sec.appendChild(makeCard(g));
      main.appendChild(sec);
    });
  }

  function route() {
    var h = location.hash || "";
    if (h.indexOf("/wiring") !== -1) renderWiring();
    if (h.indexOf("/nerve") !== -1) renderNerve();
  }
  var pending = null;
  function schedule() {
    if (pending) return;
    pending = setTimeout(function () { pending = null; route(); }, 120);
  }
  function init() {
    probe().then(function () { route(); }).catch(function () { route(); });
    try { new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true }); } catch (e) { }
    window.addEventListener("hashchange", schedule);
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) { state.hidden = true; } else { state.hidden = false; }
    });
  }
  window.AegisHull = {
    groups: GROUPS,
    probe: probe,
    read: read,
    requestPermission: requestPermission,
    record: record,
    recordCustody: recordCustody,
    get matrix() { return state.matrix; },
    get readings() { return state.readings; },
    failureCodes: FAILURE
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
export { GROUPS, FAILURE, probe, read, requestPermission, record, recordCustody };
