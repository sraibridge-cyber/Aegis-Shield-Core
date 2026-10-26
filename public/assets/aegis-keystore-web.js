/*
 * Web stub for the AegisKeystore plugin (runtime copy of src/web.ts).
 *
 * It never fabricates a signature, a public key, or a security level.
 * Every method reports available:false with reason NOT_A_NATIVE_BUILD.
 */
const REASON = "NOT_A_NATIVE_BUILD";

export class AegisKeystoreWeb {
  async isAvailable() {
    return { available: false, androidApiLevel: null, strongBoxSupported: false, reason: REASON };
  }

  async generateKey(_options) {
    return { available: false, reason: REASON };
  }

  async getPublicKeySpki(_options) {
    return { available: false, reason: REASON };
  }

  async sign(_options) {
    return { available: false, reason: REASON };
  }

  async getKeyInfo(_options) {
    return { available: false, reason: REASON };
  }

  async deleteKey(_options) {
    return { available: false, reason: REASON };
  }
}
