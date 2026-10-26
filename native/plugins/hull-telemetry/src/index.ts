import { registerPlugin } from "@capacitor/core";
import type { HullTelemetryPlugin } from "./definitions";

const HullTelemetry = registerPlugin<HullTelemetryPlugin>("HullTelemetry", {
  web: () => import("./web").then((m) => new m.HullTelemetryWeb()),
});

export * from "./definitions";
export { HullTelemetry };
