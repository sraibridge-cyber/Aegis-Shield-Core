export const BLE_MODES = {
  all: {
    id: "all",
    label: "All advertisers",
    consequence: "Surfaces devices that advertise no name, which is the common case for trackers and beacons. That is why rows can read Unknown."
  },
  named: {
    id: "named",
    label: "Named prefix only",
    consequence: "This filter cannot match an unnamed device, so it hides exactly the devices the unnamed case is meant to catch."
  }
};
export const DISCOVERY_COPY = {
  all: BLE_MODES.all.consequence,
  named: BLE_MODES.named.consequence
};
export const OPTIONAL_SERVICES = ["generic_access", "device_information"];
export function requestDeviceOptions(mode, namePrefix) {
  if (mode === "named") {
    const prefix = String(namePrefix || "").trim();
    return { filters: [{ namePrefix: prefix }], optionalServices: OPTIONAL_SERVICES };
  }
  return { acceptAllDevices: true, optionalServices: OPTIONAL_SERVICES };
}
export function nameSourceOf(advertisedName, resolvedName) {
  if (advertisedName) return "advertised";
  if (resolvedName) return "gap-0x2A00";
  return "none";
}
export function identityLabel(identity) {
  if (!identity) return "UNNAMED DEVICE";
  if (identity.nameSource === "advertised" && identity.advertisedName) return identity.advertisedName;
  if (identity.nameSource === "gap-0x2A00" && identity.resolvedName) return identity.resolvedName;
  return "UNNAMED DEVICE";
}
export function makeIdentity(input) {
  const device = input && input.device ? input.device : null;
  const resolved = input && input.resolved ? input.resolved : null;
  const advertisedName = device && device.name ? device.name : null;
  const resolvedName = resolved && resolved.deviceName ? resolved.deviceName : null;
  return {
    advertisedName,
    resolvedName,
    nameSource: nameSourceOf(advertisedName, resolvedName),
    browserDeviceId: device && device.id ? device.id : null,
    macAddress: "not-exposed",
    discoveryMode: input && input.discoveryMode === "named" ? "named" : "all",
    appearance: resolved && resolved.appearance != null ? resolved.appearance : null,
    manufacturer: resolved && resolved.manufacturer ? resolved.manufacturer : null,
    model: resolved && resolved.model ? resolved.model : null,
    firmware: resolved && resolved.firmware ? resolved.firmware : null,
    resolutionErrors: resolved && resolved.errors ? resolved.errors : {}
  };
}
export async function readText(service, uuid) {
  try {
    const ch = await service.getCharacteristic(uuid);
    const value = await ch.readValue();
    const text = new TextDecoder().decode(value).replace(/\u0000+$/g, "").trim();
    return { value: text || null, error: null };
  } catch (e) {
    return { value: null, error: (e && e.name) || "Error" };
  }
}
export async function readUint16(service, uuid) {
  try {
    const ch = await service.getCharacteristic(uuid);
    const value = await ch.readValue();
    return { value: value.byteLength >= 2 ? value.getUint16(0, true) : null, error: null };
  } catch (e) {
    return { value: null, error: (e && e.name) || "Error" };
  }
}
export async function resolveIdentity(device, discoveryMode) {
  const out = { deviceName: null, appearance: null, manufacturer: null, model: null, firmware: null, errors: {} };
  let server;
  try {
    server = await device.gatt.connect();
  } catch (e) {
    out.errors.gatt = (e && e.name) || "Error";
    return out;
  }
  try {
    const ga = await server.getPrimaryService("generic_access");
    const dn = await readText(ga, "device_name");
    out.deviceName = dn.value;
    if (dn.error) out.errors.device_name = dn.error;
    const ap = await readUint16(ga, "appearance");
    out.appearance = ap.value;
    if (ap.error) out.errors.appearance = ap.error;
  } catch (e) {
    out.errors.generic_access = (e && e.name) || "Error";
  }
  try {
    const di = await server.getPrimaryService("device_information");
    const mf = await readText(di, "manufacturer_name_string");
    out.manufacturer = mf.value;
    if (mf.error) out.errors.manufacturer = mf.error;
    const md = await readText(di, "model_number_string");
    out.model = md.value;
    if (md.error) out.errors.model = md.error;
    const fw = await readText(di, "firmware_revision_string");
    out.firmware = fw.value;
    if (fw.error) out.errors.firmware = fw.error;
  } catch (e) {
    out.errors.device_information = (e && e.name) || "Error";
  }
  return out;
}
export function watchSupport(device) {
  if (device && typeof device.watchAdvertisements === "function") {
    return { supported: true, reason: "device.watchAdvertisements is exposed" };
  }
  return { supported: false, reason: "UNAVAILABLE — device.watchAdvertisements is not exposed by this browser" };
}
export async function observeAdvertisements(device, options) {
  const opts = options || {};
  const durationMs = typeof opts.durationMs === "number" ? opts.durationMs : 8000;
  if (!device || typeof device.watchAdvertisements !== "function") {
    return { supported: false, reason: "UNAVAILABLE — device.watchAdvertisements is not exposed by this browser", samples: [] };
  }
  const samples = [];
  const handler = (event) => {
    const sample = {
      seenAt: new Date().toISOString(),
      rssi: typeof event.rssi === "number" ? event.rssi : null,
      txPower: typeof event.txPower === "number" ? event.txPower : null
    };
    samples.push(sample);
    if (typeof opts.onSample === "function") opts.onSample(sample);
  };
  device.addEventListener("advertisementreceived", handler);
  try {
    await device.watchAdvertisements();
  } catch (error) {
    device.removeEventListener("advertisementreceived", handler);
    return { supported: true, reason: "watchAdvertisements failed: " + ((error && error.name) || "Error"), samples };
  }
  await new Promise((resolve) => setTimeout(resolve, durationMs));
  try { device.removeEventListener("advertisementreceived", handler); } catch (ignored) {}
  if (typeof device.unwatchAdvertisements === "function") {
    try { device.unwatchAdvertisements(); } catch (ignored) {}
  }
  return { supported: true, samples };
}
export function makeObservation(identity, samples) {
  const list = Array.isArray(samples) ? samples : [];
  const rssiValues = list.map((s) => s.rssi).filter((v) => typeof v === "number");
  const last = list.length ? list[list.length - 1] : null;
  return {
    deviceName: identityLabel(identity),
    deviceId: identity && identity.browserDeviceId ? identity.browserDeviceId : null,
    rssi: last && typeof last.rssi === "number" ? last.rssi : null,
    seenAt: last ? last.seenAt : new Date().toISOString(),
    advertisedName: identity ? identity.advertisedName : null,
    resolvedName: identity ? identity.resolvedName : null,
    nameSource: identity ? identity.nameSource : "none",
    browserDeviceId: identity ? identity.browserDeviceId : null,
    macAddress: "not-exposed",
    discoveryMode: identity ? identity.discoveryMode : "all",
    firstSeen: list.length ? list[0].seenAt : null,
    lastSeen: list.length ? list[list.length - 1].seenAt : null,
    sampleCount: samples.length,
    rssiMin: rssiCount(list) ? Math.min.apply(null, rssiValues) : null,
    rssiMax: rssiCount(list) ? Math.max.apply(null, rssiValues) : null,
    txPower: last && typeof last.txPower === "number" ? last.txPower : null,
    note: "observed from advertisement events on an already-granted device; the app did not scan the open air"
  };
}
function rssiCount(list) {
  return list.some((s) => typeof s.rssi === "number");
}
export const UNNAMED_COPY = {
  title: "WHAT AN UNNAMED ADVERTISER MEANS",
  lines: [
    "An advertiser that persists while advertising no name is a normal, recordable observation class.",
    "It is recorded with its own fields: opaque id, first seen, last seen, sample count, and RSSI range where measurable.",
    "The app does not infer a vendor, owner or purpose from an unnamed advertiser.",
    "The OS chooser labels each row from the name in the advertising packet. A device that advertises no name gets the generic label. The page cannot rename that row."
  ]
};
export const ADDRESS_NOTE = "The partial address strings in the OS dialog are rendered by the operating system, not by this page. Web Bluetooth does not expose hardware addresses to pages; the page receives an opaque per-origin id instead.";
