import { WebPlugin } from "@capacitor/core";
import type {
  AegisKeystorePlugin,
  DeleteKeyOptions,
  DeleteKeyResult,
  GenerateKeyOptions,
  GenerateKeyResult,
  GetKeyInfoOptions,
  GetKeyInfoResult,
  GetPublicKeySpkiOptions,
  GetPublicKeySpkiResult,
  IsAvailableResult,
  SignOptions,
  SignResult,
} from "./definitions";

const REASON = "NOT_A_NATIVE_BUILD";

/**
 * Web stub. It never fabricates a signature, a public key, or a security level.
 * Every method reports available:false with reason NOT_A_NATIVE_BUILD.
 */
export class AegisKeystoreWeb extends WebPlugin implements AegisKeystorePlugin {
  async isAvailable(): Promise<IsAvailableResult> {
    return { available: false, androidApiLevel: null, strongBoxSupported: false, reason: REASON };
  }

  async generateKey(_options: GenerateKeyOptions): Promise<GenerateKeyResult> {
    return { available: false, reason: REASON };
  }

  async getPublicKeySpki(_options: GetPublicKeySpkiOptions): Promise<GetPublicKeySpkiResult> {
    return { available: false, reason: REASON };
  }

  async sign(_options: SignOptions): Promise<SignResult> {
    return { available: false, reason: REASON };
  }

  async getKeyInfo(_options: GetKeyInfoOptions): Promise<GetKeyInfoResult> {
    return { available: false, reason: REASON };
  }

  async deleteKey(_options: DeleteKeyOptions): Promise<DeleteKeyResult> {
    return { available: false, reason: REASON };
  }
}
