/*
 * ECDSA DER ↔ raw interop (runtime copy of src/lib/ecdsa-interop.ts).
 *
 * Android Keystore's SHA256withECDSA returns DER:
 *   SEQUENCE { r INTEGER, s INTEGER }
 * WebCrypto's ECDSA verify expects IEEE P1363 raw R||S:
 *   64 bytes for P-256.
 *
 * derToRaw parses the SEQUENCE, strips the INTEGER sign byte, left-pads each
 * integer to exactly 32 bytes, and concatenates r then s.
 *
 * Pure functions. No network, no storage.
 */
export class EcdsaInteropError extends Error {
  constructor(code, message) {
    super(`${code}: ${message}`);
    this.name = "EcdsaInteropError";
    this.code = code;
  }
}

const P256_COORDINATE_BYTES = 32;
const P256_RAW_BYTES = 64;

function readLength(der, state) {
  if (state.offset >= der.length) throw new EcdsaInteropError("TRUNCATED", "missing length");
  const first = der[state.offset++];
  if (first < 0x80) return first;
  const count = first & 0x7f;
  if (count === 0) throw new EcdsaInteropError("BAD_LENGTH", "indefinite length is not allowed");
  if (count > 2) throw new EcdsaInteropError("BAD_LENGTH", "length too long");
  if (state.offset + count > der.length) throw new EcdsaInteropError("TRUNCATED", "length bytes");
  let length = 0;
  for (let i = 0; i < count; i++) length = (length << 8) | der[state.offset++];
  if (length < 0x80) throw new EcdsaInteropError("BAD_LENGTH", "non-minimal long-form length");
  return length;
}

function readInteger(der, state) {
  if (state.offset >= der.length) throw new EcdsaInteropError("TRUNCATED", "missing INTEGER");
  if (der[state.offset++] !== 0x02) throw new EcdsaInteropError("WRONG_TAG", "expected INTEGER");
  const length = readLength(der, state);
  if (state.offset + length > der.length) throw new EcdsaInteropError("TRUNCATED", "INTEGER value");
  if (length === 0) throw new EcdsaInteropError("BAD_LENGTH", "empty INTEGER");
  const value = der.slice(state.offset, state.offset + length);
  state.offset += length;
  let start = 0;
  while (start < value.length - 1 && value[start] === 0) start++;
  const significant = value.slice(start);
  if (significant.length > P256_COORDINATE_BYTES) {
    throw new EcdsaInteropError("INTEGER_TOO_LONG", "coordinate exceeds 32 bytes");
  }
  return significant;
}

export function derToRaw(der) {
  if (!der || der.length < 2) throw new EcdsaInteropError("TRUNCATED", "no SEQUENCE");
  if (der[0] !== 0x30) throw new EcdsaInteropError("WRONG_TAG", "expected SEQUENCE");
  const state = { offset: 1 };
  const seqLength = readLength(der, state);
  if (state.offset + seqLength !== der.length) {
    throw new EcdsaInteropError("BAD_LENGTH", "SEQUENCE length does not match input");
  }
  const r = readInteger(der, state);
  const s = readInteger(der, state);
  if (state.offset !== der.length) throw new EcdsaInteropError("BAD_LENGTH", "trailing bytes");
  const raw = new Uint8Array(P256_RAW_BYTES);
  raw.set(r, P256_COORDINATE_BYTES - r.length);
  raw.set(s, P256_RAW_BYTES - s.length);
  return raw;
}

function encodeInteger(value) {
  let start = 0;
  while (start < value.length - 1 && value[start] === 0) start++;
  const significant = value.slice(start);
  const needsSignByte = (significant[0] & 0x80) !== 0;
  const length = significant.length + (needsSignByte ? 1 : 0);
  if (length > 127) throw new EcdsaInteropError("BAD_LENGTH", "INTEGER too long");
  const out = new Uint8Array(2 + length);
  out[0] = 0x02;
  out[1] = length;
  if (needsSignByte) {
    out[2] = 0x00;
    out.set(significant, 3);
  } else {
    out.set(significant, 2);
  }
  return out;
}

export function rawToDer(raw) {
  if (!raw || raw.length !== P256_RAW_BYTES) {
    throw new EcdsaInteropError("BAD_LENGTH", "raw signature must be 64 bytes");
  }
  const r = encodeInteger(raw.slice(0, P256_COORDINATE_BYTES));
  const s = encodeInteger(raw.slice(P256_COORDINATE_BYTES, P256_RAW_BYTES));
  const contentLength = r.length + s.length;
  if (contentLength > 127) throw new EcdsaInteropError("BAD_LENGTH", "DER content too long");
  const der = new Uint8Array(2 + contentLength);
  der[0] = 0x30;
  der[1] = contentLength;
  der.set(r, 2);
  der.set(s, 2 + r.length);
  return der;
}

export async function importSpkiVerifyKey(spkiDer) {
  return crypto.subtle.importKey(
    "spki",
    spkiDer,
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["verify"],
  );
}

function base64ToBytes(value) {
  const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

export async function verifyRaw(publicKeyJwkOrSpki, data, signatureRaw) {
  let key;
  if (publicKeyJwkOrSpki instanceof Uint8Array) {
    key = await importSpkiVerifyKey(publicKeyJwkOrSpki);
  } else if (typeof publicKeyJwkOrSpki === "string") {
    key = await importSpkiVerifyKey(base64ToBytes(publicKeyJwkOrSpki));
  } else if (publicKeyJwkOrSpki && typeof publicKeyJwkOrSpki === "object" && "kty" in publicKeyJwkOrSpki) {
    key = await crypto.subtle.importKey(
      "jwk",
      publicKeyJwkOrSpki,
      { name: "ECDSA", namedCurve: "P-256" },
      true,
      ["verify"],
    );
  } else {
    key = publicKeyJwkOrSpki;
  }
  return crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, key, signatureRaw, data);
}
