export type HullFailureCode =
  | "PERMISSION_DENIED" | "PERMISSION_NOT_DECLARED" | "PERMISSION_NEVER_ASK_AGAIN"
  | "UNSUPPORTED_API_LEVEL" | "SENSOR_ABSENT" | "RESTRICTED_BY_OEM"
  | "SCREEN_OFF" | "SCAN_THROTTLED" | "RATE_LIMITED" | "TIMEOUT"
  | "ATTESTATION_UNPARSEABLE" | "RESTRICTED_BY_OS" | "NO_NATIVE_BRIDGE";

export type HullPermissionState = "granted" | "denied" | "not_requested" | "not_declared" | "n/a";

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

export interface HullGroupMeta {
  id: string;
  label: string;
  api: string;
  permission: string | null;
  permissionClass: "none" | "normal" | "dangerous";
  rationale: string;
  defaultOn: boolean;
  method: string;
}

export interface HullProbeValue {
  groups: Array<{
    group: string;
    available: boolean;
    api: string;
    apiLevel: number | null;
    permissionRequired: string | null;
    permissionState: HullPermissionState;
    reason?: string | null;
  }>;
  apiLevel: number | null;
  backend: "android" | "browser";
}

export declare const GROUPS: HullGroupMeta[];
export declare const FAILURE: HullFailureCode[];
export declare function probe(): Promise<HullEnvelope<HullProbeValue>>;
export declare function read(group: string): Promise<HullEnvelope<Record<string, unknown>>>;
export declare function requestPermission(group: string): Promise<HullEnvelope<{ group: string; permissionState: HullPermissionState }>>;
export declare function record(reading: HullEnvelope<unknown>, group: string): void;
export declare function recordCustody(group: string, next: string): void;

declare global {
  interface Window {
    AegisHull: {
      groups: HullGroupMeta[];
      probe: typeof probe;
      read: typeof read;
      requestPermission: typeof requestPermission;
      record: typeof record;
      recordCustody: typeof recordCustody;
      readonly matrix: HullEnvelope<HullProbeValue> | null;
      readonly readings: Record<string, HullEnvelope<unknown>>;
      failureCodes: HullFailureCode[];
    };
  }
}
