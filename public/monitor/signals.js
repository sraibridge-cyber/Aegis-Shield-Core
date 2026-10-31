// Changes between two readings of the Android signals group.
// Pure logic: no DOM, no Android calls. A flag means a setting or indicator
// changed since the previous reading. It does not say who changed it.

const sameList = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

// Returns flags for changes between `prev` and `cur` (both are the `signals`
// reading objects). When either side is missing, nothing is compared, so the
// first reading after a switch is turned on never produces a flag.
export function signalFlags(prev, cur) {
  if (!prev || !cur) return [];
  const flags = [];

  const a = Array.isArray(prev.accessibilityServices) ? prev.accessibilityServices : null;
  const b = Array.isArray(cur.accessibilityServices) ? cur.accessibilityServices : null;
  if (a && b) {
    for (const s of b.filter((x) => !a.includes(x))) {
      flags.push({
        code: "ACCESSIBILITY_ON",
        text: `An accessibility service was turned on since the last reading: ${s}. Accessibility services can read what is on screen and act for you. You may have turned it on yourself.`,
      });
    }
    for (const s of a.filter((x) => !b.includes(x))) {
      flags.push({ code: "ACCESSIBILITY_OFF", text: `An accessibility service was turned off since the last reading: ${s}.` });
    }
  }

  const n1 = Array.isArray(prev.notificationListeners) ? prev.notificationListeners : null;
  const n2 = Array.isArray(cur.notificationListeners) ? cur.notificationListeners : null;
  if (n1 && n2) {
    for (const s of n2.filter((x) => !n1.includes(x))) {
      flags.push({
        code: "NOTIFICATION_LISTENER_ON",
        text: `An app was given access to notifications since the last reading: ${s}. Notification access shows the content of incoming notifications.`,
      });
    }
  }

  const d1 = Array.isArray(prev.deviceAdmins) ? prev.deviceAdmins : null;
  const d2 = Array.isArray(cur.deviceAdmins) ? cur.deviceAdmins : null;
  if (d1 && d2) {
    for (const s of d2.filter((x) => !d1.includes(x))) {
      flags.push({
        code: "DEVICE_ADMIN_ON",
        text: `A device administrator was added since the last reading: ${s}. Device administrators can lock the device, wipe it, and set policy.`,
      });
    }
  }

  const c1 = prev.userCaCertificates && Array.isArray(prev.userCaCertificates.sha256) ? prev.userCaCertificates.sha256 : null;
  const c2 = cur.userCaCertificates && Array.isArray(cur.userCaCertificates.sha256) ? cur.userCaCertificates.sha256 : null;
  if (c1 && c2) {
    const added = c2.filter((x) => !c1.includes(x));
    if (added.length) {
      flags.push({
        code: "USER_CA_ADDED",
        text: `${added.length} user-installed certificate authorit${added.length === 1 ? "y" : "ies"} appeared since the last reading. A user certificate authority can let someone read encrypted traffic from this device.`,
      });
    }
  }

  if (typeof prev.vpnActive === "boolean" && typeof cur.vpnActive === "boolean" && prev.vpnActive !== cur.vpnActive) {
    flags.push({
      code: cur.vpnActive ? "VPN_ON" : "VPN_OFF",
      text: cur.vpnActive ? "A VPN turned on since the last reading. A VPN carries your traffic through another operator." : "A VPN turned off since the last reading.",
    });
  }

  if (prev.proxy !== undefined && cur.proxy !== undefined && prev.proxy !== cur.proxy) {
    flags.push({
      code: "PROXY_CHANGED",
      text: cur.proxy ? `A network proxy is set: ${cur.proxy}. A proxy can route web traffic through another machine.` : "The network proxy was removed since the last reading.",
    });
  }

  for (const key of ["developerOptions", "usbDebugging"]) {
    if (prev[key] === false && cur[key] === true) {
      flags.push({
        code: key === "usbDebugging" ? "USB_DEBUGGING_ON" : "DEVELOPER_OPTIONS_ON",
        text: key === "usbDebugging" ? "USB debugging was turned on since the last reading." : "Developer options were turned on since the last reading.",
      });
    }
  }

  if (typeof prev.microphoneRecordingClients === "number" && typeof cur.microphoneRecordingClients === "number") {
    if (prev.microphoneRecordingClients === 0 && cur.microphoneRecordingClients > 0) {
      flags.push({
        code: "MICROPHONE_IN_USE",
        text: `${cur.microphoneRecordingClients} app(s) started recording audio since the last reading. Android does not say which apps from here.`,
      });
    }
  }

  if (typeof prev.camerasInUse === "number" && typeof cur.camerasInUse === "number") {
    if (prev.camerasInUse === 0 && cur.camerasInUse > 0) {
      flags.push({
        code: "CAMERA_IN_USE",
        text: "A camera became unavailable to this app since the last reading, which usually means another app is using it. Android does not say which app from here.",
      });
    }
  }

  return flags;
}

export { sameList };
