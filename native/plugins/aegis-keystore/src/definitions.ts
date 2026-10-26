export type SecurityLevel = "strongbox" | "tee" | "software";

export interface IsAvailableResult {
  available: boolean;
  androidApiLevel: number | null;
  strongBoxSupported: boolean;
  reason?: string;
}

export interface GenerateKeyOptions {
  alias: string;
  preferStrongBox?: boolean;
  requireUserAuth?: boolean;
}

export interface GenerateKeyResult {
  available: boolean;
  publicKeySpkiBase64?: string;
  backend?: "android-keystore";
  securityLevel?: SecurityLevel;
  hardwareBacked?: boolean;
  strongBoxUsed?: boolean;
  reason?: string;
}

export interface GetPublicKeySpkiOptions {
  alias: string;
}

export interface GetPublicKeySpkiResult {
  available: boolean;
  publicKeySpkiBase64?: string;
  fingerprint?: string;
  reason?: string;
}

export interface SignOptions {
  alias: string;
  dataBase64: string;
}

export interface SignResult {
  available: boolean;
  signatureBase64?: string;
  backend?: "android-keystore";
  securityLevel?: SecurityLevel;
  reason?: string;
}

export interface GetKeyInfoOptions {
  alias: string;
}

export interface GetKeyInfoResult {
  available: boolean;
  securityLevel?: SecurityLevel;
  hardwareBacked?: boolean;
  strongBoxUsed?: boolean;
  userAuthRequired?: boolean;
  exists?: boolean;
  invalidated?: boolean;
  reason?: string;
}

export interface DeleteKeyOptions {
  alias: string;
}

export interface DeleteKeyResult {
  available: boolean;
  deleted?: boolean;
  reason?: string;
}

export interface AegisKeystorePlugin {
  isAvailable(): Promise<IsAvailableResult>;
  generateKey(options: GenerateKeyOptions): Promise<GenerateKeyResult>;
  getPublicKeySpki(options: GetPublicKeySpkiOptions): Promise<GetPublicKeySpkiResult>;
  sign(options: SignOptions): Promise<SignResult>;
  getKeyInfo(options: GetKeyInfoOptions): Promise<GetKeyInfoResult>;
  deleteKey(options: DeleteKeyOptions): Promise<DeleteKeyResult>;
}
