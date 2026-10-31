// Browser readers for the device monitor. Each reader is only called by core.js
// when its switch is on. Nothing here runs at import time, and nothing here
// sends data anywhere.

const round = (x, d = 2) => (typeof x === "number" && Number.isFinite(x) ? Math.round(x * 10 ** d) / 10 ** d : null);
const exposed = (v) => (v === undefined || v === null ? "not exposed by this browser" : v);

export const GROUP_INFO = {
  clock: {
    title: "Clock agreement",
    reads: "The wall clock compared with the device's steady clock, once per reading. Catches time changes between readings.",
    gate: "Your switch. Browsers do not ask for this.",
  },
  timing: {
    title: "Timer regularity",
    reads: "How late a 200 ms timer fires. Shows delays the page can see.",
    gate: "Your switch. Browsers do not ask for this.",
  },
  vitals: {
    title: "Device status",
    reads: "Battery level and charging, where the browser shares them. Connection type. Memory and core count. Storage used by this site. Screen size. Whether this tab is visible.",
    gate: "Your switch. Browsers do not ask for this, and many fields are missing on iPhone and some browsers.",
  },
  motion: {
    title: "Motion",
    reads: "Acceleration from the browser's motion sensor, summarised over the last 2 seconds. Only while this page is open.",
    gate: "The browser asks first where it requires it (iPhone, some Android browsers). Your switch too.",
  },
};

export function browserCollectors(env = globalThis) {
  const nav = env.navigator || {};
  const doc = env.document || {};
  let listener = null;
  const motionBuf = [];

  return {
    clock: {
      async read() {
        return { ok: true, metrics: { wallMs: Date.now(), monoMs: round(performance.now(), 3) } };
      },
    },

    timing: {
      async read() {
        const t0 = performance.now();
        await new Promise((resolve) => setTimeout(resolve, 200));
        const dt = performance.now() - t0;
        return { ok: true, metrics: { expectedMs: 200, observedMs: round(dt, 1), lateMs: round(dt - 200, 1) } };
      },
    },

    vitals: {
      async read() {
        const m = {};
        m.visibility = exposed(doc.visibilityState);
        m.online = exposed(typeof nav.onLine === "boolean" ? nav.onLine : undefined);
        const c = nav.connection;
        m.connection = c
          ? { effectiveType: exposed(c.effectiveType), downlinkMbps: exposed(c.downlink), saveData: exposed(c.saveData) }
          : "not exposed by this browser";
        m.cores = exposed(nav.hardwareConcurrency);
        m.memoryGiB = exposed(nav.deviceMemory);
        m.battery = "not exposed by this browser";
        if (typeof nav.getBattery === "function") {
          try {
            const b = await nav.getBattery();
            m.battery = { level: round(b.level, 2), charging: exposed(b.charging) };
          } catch {
            m.battery = "not exposed by this browser";
          }
        }
        m.storage = "not exposed by this browser";
        if (nav.storage && typeof nav.storage.estimate === "function") {
          try {
            const e = await nav.storage.estimate();
            m.storage = { usedMB: round((e.usage || 0) / 1e6, 1), quotaGB: round((e.quota || 0) / 1e9, 2) };
          } catch {
            m.storage = "not exposed by this browser";
          }
        }
        const s = env.screen || {};
        m.screen = {
          width: exposed(s.width),
          height: exposed(s.height),
          pixelRatio: exposed(env.devicePixelRatio),
          orientation: exposed(s.orientation && s.orientation.type),
        };
        return { ok: true, metrics: m };
      },
    },

    motion: {
      // Must be called first, synchronously, inside the user's tap, because
      // iOS only shows its motion prompt in direct response to a gesture.
      requestAccess() {
        const DME = env.DeviceMotionEvent;
        if (!DME || !env.addEventListener) return Promise.resolve("unsupported");
        if (typeof DME.requestPermission === "function") {
          return DME.requestPermission().then(
            (r) => (r === "granted" ? "granted" : "denied"),
            () => "denied",
          );
        }
        return Promise.resolve("granted");
      },
      start() {
        if (listener || !env.addEventListener) return;
        listener = (e) => {
          const a = e.accelerationIncludingGravity || e.acceleration;
          if (!a) return;
          motionBuf.push({ t: Date.now(), m: Math.hypot(a.x || 0, a.y || 0, a.z || 0) });
          if (motionBuf.length > 400) motionBuf.splice(0, motionBuf.length - 400);
        };
        env.addEventListener("devicemotion", listener);
      },
      stop() {
        if (listener && env.removeEventListener) env.removeEventListener("devicemotion", listener);
        listener = null;
        motionBuf.length = 0;
      },
      async read() {
        const cutoff = Date.now() - 2000;
        const win = motionBuf.filter((s) => s.t >= cutoff);
        if (!win.length) {
          return { ok: false, reason: listener ? "no motion readings in the last 2 seconds" : "motion listener is not running" };
        }
        const mean = win.reduce((s, x) => s + x.m, 0) / win.length;
        const sd = Math.sqrt(win.reduce((s, x) => s + (x.m - mean) ** 2, 0) / win.length);
        return { ok: true, metrics: { samples: win.length, meanMs2: round(mean, 2), sdMs2: round(sd, 3), windowS: 2 } };
      },
    },
  };
}
