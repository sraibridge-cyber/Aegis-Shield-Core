import { registerPlugin } from "@capacitor/core";
import type { AegisKeystorePlugin } from "./definitions";

const AegisKeystore = registerPlugin<AegisKeystorePlugin>("AegisKeystore", {
  web: () => import("./web").then((m) => new m.AegisKeystoreWeb()),
});

export * from "./definitions";
export { AegisKeystore };
