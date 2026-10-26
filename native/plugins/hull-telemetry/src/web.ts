import { WebPlugin } from "@capacitor/core";
import type {
  HullEnvelope,
  HullGroup,
  HullProbeValue,
  HullTelemetryPlugin,
} from "./definitions";

const NO_BRIDGE = "NO_NATIVE_BRIDGE";

function envelope<T>(api: string, detail: string): HullEnvelope<T> {
  return {
    ok: false,
    code: NO_BRIDGE,
    detail,
    provenance: {
      api,
      backend: "browser",
      permissionState: "n/a",
      wallClockMs: Date.now(),
    },
  };
}

export class HullTelemetryWeb extends WebPlugin implements HullTelemetryPlugin {
  async probe(): Promise<HullEnvelope<HullProbeValue>> {
    return envelope<HullProbeValue>(
      "HullTelemetry.probe",
      "The native HullTelemetry plugin is not present in this browser context.",
    );
  }
  async vitals() { return envelope("HullTelemetry.vitals", "No native bridge."); }
  async thermalStream() { return envelope("HullTelemetry.thermalStream", "No native bridge."); }
  async motion() { return envelope("HullTelemetry.motion", "No native bridge."); }
  async environment() { return envelope("HullTelemetry.environment", "No native bridge."); }
  async rfBle() { return envelope("HullTelemetry.rfBle", "No native bridge."); }
  async rfWifi() { return envelope("HullTelemetry.rfWifi", "No native bridge."); }
  async attest() { return envelope("HullTelemetry.attest", "No native bridge."); }
  async posture() { return envelope("HullTelemetry.posture", "No native bridge."); }
  async clockIntegrity() { return envelope("HullTelemetry.clockIntegrity", "No native bridge."); }
  async requestPermission(options: { group: HullGroup }) {
    return envelope<{ group: HullGroup; permissionState: "n/a" }>(
      "HullTelemetry.requestPermission",
      `No native bridge for ${options.group}.`,
    );
  }
}
