export type HullFailureCode =
  | "PERMISSION_DENIED"
  | "PERMISSION_NOT_DECLARED"
  | "PERMISSION_NEVER_ASK_AGAIN"
  | "UNSUPPORTED_API_LEVEL"
  | "SENSOR_ABSENT"
  | "RESTRICTED_BY_OEM"
  | "SCREEN_OFF"
  | "SCAN_THROTTLED"
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "ATTESTATION_UNPARSEABLE"
  | "RESTRICTED_BY_OS"
  | "NO_NATIVE_BRIDGE";

export type HullPermissionState =
  | "granted"
  | "denied"
  | "not_requested"
  | "not_declared"
  | "n/a";

export interface HullProvenance {
  api: string;
  backend: "android" | "browser";
  apiLevel?: number;
  elapsedRealtimeMs?: number;
  wallClockMs?: number;
  permissionRequired?: string;
  permissionState?: HullPermissionState;
}

export interface HullEnvelope<T = unknown> {
  ok: boolean;
  code?: HullFailureCode;
  detail?: string;
  value?: T;
  unit?: string;
  provenance: HullProvenance;
}

export type HullGroup =
  | "VITALS"
  | "MOTION"
  | "ENVIRONMENT"
  | "RF_BLE"
  | "RF_WIFI"
  | "ATTEST"
  | "POSTURE"
  | "CLOCK_INTEGRITY";

export interface HullGroupProbe {
  group: HullGroup;
  available: boolean;
  api: string;
  apiLevel?: number;
  permissionRequired: string | null;
  permissionState: HullPermissionState;
  sensors?: string[];
  reason?: string;
}

export interface HullProbeValue {
  groups: HullGroupProbe[];
  apiLevel: number;
  backend: "android" | "browser";
}

export interface HullTelemetryPlugin {
  probe(): Promise<HullEnvelope<HullProbeValue>>;
  vitals(): Promise<HullEnvelope<Record<string, unknown>>>;
  thermalStream(): Promise<HullEnvelope<Record<string, unknown>>>;
  motion(): Promise<HullEnvelope<Record<string, unknown>>>;
  environment(): Promise<HullEnvelope<Record<string, unknown>>>;
  rfBle(): Promise<HullEnvelope<Record<string, unknown>>>;
  rfWifi(): Promise<HullEnvelope<Record<string, unknown>>>;
  attest(): Promise<HullEnvelope<Record<string, unknown>>>;
  posture(): Promise<HullEnvelope<Record<string, unknown>>>;
  clockIntegrity(): Promise<HullEnvelope<Record<string, unknown>>>;
  requestPermission(options: { group: HullGroup }): Promise<HullEnvelope<{ group: HullGroup; permissionState: HullPermissionState }>>;
}
