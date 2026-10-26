// Seal A provider bridge. Runtime copy of src/lib/seal-a-provider.ts.
// Routes to the Capacitor AegisKeystore plugin when present, else WebCrypto.
// Never silently switches backends. Never claims hardware backing it did not get.

const ALIAS = "aegis-seal-a";
const capacitor = typeof window !== "undefined" ? window.Capacitor : null;
const nativePlugin = capacitor && typeof capacitor.isNativePlatform === "function" && capacitor.isNativePlatform()
  ? (capacitor.Plugins && capacitor.Plugins.AegisKeystore) || null
  : null;
let cachedSecurityLevel = "unknown";

export function detectSealAProvider() {
  return nativePlugin ? "android-keystore" : "webcrypto";
}

function base64FromBytes(bytes) {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function base64UrlFromBytes(bytes) {
  return base64FromBytes(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64ToBytes(value) {
  const s = atob(value.replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

async function sha256Hex(base64Spki) {
  const digest = await crypto.subtle.digest("SHA-256", base64ToBytes(base64Spki));
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("");
}

export async function ensureSealAKey() {
  if (!nativePlugin) throw new Error("AegisKeystore is not available");
  const generated = await nativePlugin.generateKey({ alias: ALIAS, preferStrongBox: true, requireUserAuth: false });
  if (!generated.available) throw new Error(generated.reason || "AegisKeystore generateKey unavailable");
  const pub = await nativePlugin.getPublicKeySpki({ alias: ALIAS });
  if (!pub.available || !pub.publicKeySpkiBase64) throw new Error(pub.reason || "AegisKeystore public key unavailable");
  const spki = pub.publicKeySpkiBase64;
  const hullId = pub.fingerprint ? pub.fingerprint.slice(0, 16) : (await sha256Hex(spki)).slice(0, 16);
  const securityLevel = generated.securityLevel || "unknown";
  cachedSecurityLevel = securityLevel;
  return {
    spki,
    hullId,
    keyProvider: "android-keystore",
    securityLevel,
    hardwareBacked: !!generated.hardwareBacked,
    strongBoxUsed: !!generated.strongBoxUsed
  };
}

export async function signWithSealA(bytes, webKey) {
  if (nativePlugin) {
    const result = await nativePlugin.sign({ alias: ALIAS, dataBase64: base64FromBytes(bytes) });
    if (!result.available || !result.signatureBase64) throw new Error(result.reason || "AegisKeystore sign unavailable");
    const raw = base64ToBytes(result.signatureBase64);
    return {
      signature: base64UrlFromBytes(raw),
      signatureRawB64: result.signatureBase64,
      keyProvider: "android-keystore",
      securityLevel: result.securityLevel || cachedSecurityLevel || "unknown"
    };
  }
  if (!webKey) throw new Error("WebCrypto Seal A key is unavailable");
  const raw = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, webKey, bytes));
  return { signature: base64UrlFromBytes(raw), signatureRawB64: base64FromBytes(raw), keyProvider: "webcrypto", securityLevel: "unknown" };
}
