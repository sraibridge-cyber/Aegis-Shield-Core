import { j as e, P as Panel, S as SectionHeader, B as Badge, b as Button } from "./index-CL6IUdNY.js";
import { DISCOVERY_COPY, UNNAMED_COPY, ADDRESS_NOTE, identityLabel } from "./ble-9f3c2a.js";
function field(label, value) {
  return e.jsxs("div", { children: [
    e.jsx("p", { className: "label", children: label }),
    e.jsx("span", { className: "text-[11px] text-foreground", style: { wordBreak: "break-all" }, children: value })
  ]});
}
export function BlePanel({ t, f }) {
  const ble = t.ble;
  const identity = ble.identity;
  const watch = ble.watch || { status: "UNAVAILABLE", reason: "not probed" };
  const observations = ble.observations || [];
  const devices = ble.devices || [];
  const mode = ble.mode || "all";
  const namePrefix = ble.namePrefix || "";
  return e.jsxs(Panel, { children: [
    e.jsx(SectionHeader, {
      eyebrow: "Bluetooth",
      title: "User-selected device",
      description: "Web Bluetooth requires an explicit gesture. The browser cannot passively enumerate all nearby advertisements. The page cannot relabel the OS chooser.",
      right: e.jsx(Badge, { tone: ble.supported ? "phosphor" : "muted", children: ble.supported ? "AVAILABLE" : "UNAVAILABLE" })
    }),
    e.jsx("p", { className: "mt-2 font-mono text-[9.5px] leading-relaxed text-muted-foreground", children: ble.reason }),
    e.jsxs("div", { className: "mt-3 rounded-[6px] border border-border bg-black/25 p-3", children: [
      e.jsx("p", { className: "label", children: "Discovery mode" }),
      e.jsxs("div", { className: "mt-2 flex flex-wrap gap-2", children: [
        e.jsx(Button, { type: "button", variant: mode === "all" ? "primary" : "ghost", size: "md", onClick: () => f.setBleMode("all"), children: "All advertisers" }),
        e.jsx(Button, { type: "button", variant: mode === "named" ? "primary" : "ghost", size: "md", onClick: () => f.setBleMode("named"), children: "Named prefix only" })
      ]}),
      e.jsxs("p", { className: "mt-2 font-mono text-[9px] uppercase tracking-[0.12em] text-gold", children: ["ARMED: ", mode === "named" ? "NAMED PREFIX ONLY" : "ALL ADVERTISERS"] }),
      e.jsx("p", { className: "mt-1 text-[10px] leading-relaxed text-muted-foreground", children: DISCOVERY_COPY[mode] }),
      mode === "named" ? e.jsxs("div", { className: "mt-2", children: [
        e.jsx("label", { className: "label", htmlFor: "ble-prefix", children: "Name prefix" }),
        e.jsx("input", { id: "ble-prefix", type: "text", value: namePrefix, onChange: (ev) => f.setBlePrefix(ev.target.value), placeholder: "e.g. AEGIS", style: { width: "100%", marginTop: 4, borderRadius: 6, border: "1px solid var(--border)", background: "rgba(0,0,0,0.4)", padding: "8px", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--chalk)" } })
      ]}) : null
    ]}),
    identity ? e.jsxs("div", { className: "mt-3 rounded-[6px] border border-border bg-black/25 p-3", children: [
      e.jsx("p", { className: "label", children: "Resolved identity" }),
      e.jsxs("div", { className: "mt-2 grid gap-2 sm:grid-cols-2", children: [
        field("advertisedName", identity.advertisedName === null ? "null" : identity.advertisedName),
        field("resolvedName", identity.resolvedName === null ? "null" : identity.resolvedName),
        field("nameSource", identity.nameSource),
        field("browserDeviceId", identity.browserDeviceId === null ? "null" : identity.browserDeviceId),
        field("macAddress", "NOT EXPOSED"),
        field("discoveryMode", identity.discoveryMode)
      ]}),
      e.jsxs("p", { className: "mt-2 text-[10px] leading-relaxed text-muted-foreground", children: ["Label: ", e.jsx("span", { className: "text-foreground", children: identityLabel(identity) })] }),
      e.jsx("p", { className: "mt-1 font-mono text-[9px] leading-relaxed text-muted-foreground", children: ADDRESS_NOTE }),
      e.jsxs("p", { className: "mt-1 font-mono text-[9px] leading-relaxed text-muted-foreground", children: ["appearance=", identity.appearance === null ? "null" : identity.appearance, " · manufacturer=", identity.manufacturer === null ? "null" : identity.manufacturer, " · model=", identity.model === null ? "null" : identity.model, " · firmware=", identity.firmware === null ? "null" : identity.firmware] })
    ]}) : null,
    e.jsxs("div", { className: "mt-3 rounded-[6px] border border-border bg-black/25 p-3", children: [
      e.jsx("p", { className: "label", children: "Advertisement observation" }),
      e.jsx("p", { className: "mt-1 text-[10px] leading-relaxed text-muted-foreground", children: "This only observes a device you have already granted. It does not scan for nearby devices." }),
      e.jsxs("div", { className: "mt-2 flex flex-wrap items-center gap-2", children: [
        e.jsx(Button, { type: "button", variant: "ghost", size: "md", icon: "radio", disabled: !identity || watch.status === "OBSERVING", onClick: () => { f.observeBle(); }, children: "Observe advertisements" }),
        e.jsx(Badge, { tone: watch.status === "MEASURED" ? "phosphor" : watch.status === "OBSERVING" ? "gold" : "muted", children: watch.status })
      ]}),
      e.jsx("p", { className: "mt-1 font-mono text-[9px] leading-relaxed text-muted-foreground", children: watch.reason }),
      observations.length > 0 ? e.jsx("ul", { className: "mt-2 divide-y divide-border", children: observations.slice(-4).reverse().map((o, k) => e.jsxs("li", { className: "py-2", children: [
        e.jsxs("p", { className: "text-[10.5px] text-foreground", children: [o.deviceName, " · ", o.sampleCount, " sample(s)"] }),
        e.jsxs("p", { className: "font-mono text-[9px] text-muted-foreground", children: ["rssi ", o.rssiMin === null ? "not exposed" : o.rssiMin + "…" + o.rssiMax + " dBm", " · txPower ", o.txPower === null ? "not exposed" : o.txPower + " dBm"] })
      ]}, k)) }) : null
    ]}),
    e.jsxs("div", { className: "mt-3 rounded-[6px] border border-border bg-black/25 p-3", children: [
      e.jsx("p", { className: "label", children: UNNAMED_COPY.title }),
      e.jsx("ul", { className: "mt-2", style: { display: "grid", gap: 4 }, children: UNNAMED_COPY.lines.map((line, k) => e.jsx("li", { className: "text-[10px] leading-relaxed text-muted-foreground", children: line }, k)) })
    ]}),
    devices.length > 0 ? e.jsx("ul", { className: "mt-2 divide-y divide-border", children: devices.map((o) => e.jsxs("li", { className: "flex items-center justify-between gap-3 py-2", children: [
      e.jsx("span", { className: "truncate text-[11.5px] text-foreground", children: o.name }),
      e.jsx(Badge, { tone: "muted", children: "REAL BLE READ" })
    ]}, o.id)) }) : e.jsx("p", { className: "mt-2 text-[10.5px] text-muted-foreground", children: "No device selected in this session." })
  ]});
}
