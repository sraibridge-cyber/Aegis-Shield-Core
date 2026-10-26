package io.aegis.keystore;

import android.os.Build;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyInfo;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.security.KeyFactory;
import java.security.KeyPairGenerator;
import java.security.KeyStore;
import java.security.MessageDigest;
import java.security.PrivateKey;
import java.security.Signature;
import java.security.cert.Certificate;
import java.security.spec.ECGenParameterSpec;

/**
 * AegisKeystore — Android Keystore signing plugin for AEGIS Seal A.
 *
 * The key is generated in AndroidKeyStore with PURPOSE_SIGN|PURPOSE_VERIFY and
 * DIGEST_SHA256. StrongBox is requested when preferStrongBox is true; when the
 * platform reports StrongBoxUnavailableException, the plugin retries in the TEE
 * and reports strongBoxUsed:false. It never pretends StrongBox was used.
 *
 * The public key is exported as X.509 SubjectPublicKeyInfo DER. That is exactly
 * the format crypto.subtle.importKey("spki", ...) accepts.
 *
 * The signature is converted from DER to raw R||S before it leaves the plugin.
 * See EcdsaDer for the interop invariant.
 */
@CapacitorPlugin(name = "AegisKeystore")
public class AegisKeystorePlugin extends Plugin {

    private static final String PROVIDER = "AndroidKeyStore";
    private static final String KEY_ALGORITHM = "EC";
    private static final String CURVE = "secp256r1";
    private static final String SIGNATURE_ALGORITHM = "SHA256withECDSA";

    @PluginMethod
    public void isAvailable(PluginCall call) {
        boolean strongBoxSupported = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
                && getContext().getPackageManager().hasSystemFeature("android.hardware.strongbox_keystore");
        JSObject result = new JSObject();
        result.put("available", true);
        result.put("androidApiLevel", Build.VERSION.SDK_INT);
        result.put("strongBoxSupported", strongBoxSupported);
        call.resolve(result);
    }

    @PluginMethod
    public void generateKey(PluginCall call) {
        String alias = call.getString("alias");
        boolean preferStrongBox = Boolean.TRUE.equals(call.getBoolean("preferStrongBox", false));
        boolean requireUserAuth = Boolean.TRUE.equals(call.getBoolean("requireUserAuth", false));
        if (alias == null || alias.isEmpty()) {
            call.reject("alias is required");
            return;
        }
        try {
            KeyStore keyStore = loadKeyStore();
            if (keyStore.containsAlias(alias)) {
                call.resolve(describe(alias));
                return;
            }
            boolean strongBoxUsed = false;
            if (preferStrongBox && Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                try {
                    generate(alias, true, requireUserAuth);
                    strongBoxUsed = true;
                } catch (Exception first) {
                    if (!isStrongBoxUnavailable(first)) throw first;
                    generate(alias, false, requireUserAuth);
                }
            } else {
                generate(alias, false, requireUserAuth);
            }
            JSObject result = describe(alias);
            result.put("strongBoxUsed", strongBoxUsed && "strongbox".equals(result.getString("securityLevel")));
            call.resolve(result);
        } catch (Exception error) {
            call.reject("generateKey failed: " + error.getClass().getSimpleName() + ": " + error.getMessage(), error);
        }
    }

    private void generate(String alias, boolean strongBox, boolean requireUserAuth) throws Exception {
        KeyPairGenerator generator = KeyPairGenerator.getInstance(KEY_ALGORITHM, PROVIDER);
        KeyGenParameterSpec.Builder builder = new KeyGenParameterSpec.Builder(
                alias,
                KeyProperties.PURPOSE_SIGN | KeyProperties.PURPOSE_VERIFY)
                .setAlgorithmParameterSpec(new ECGenParameterSpec(CURVE))
                .setDigests(KeyProperties.DIGEST_SHA256)
                .setUserAuthenticationRequired(requireUserAuth);
        if (requireUserAuth && Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            builder.setInvalidatedByBiometricEnrollment(true);
        }
        if (strongBox && Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            builder.setIsStrongBoxBacked(true);
        }
        generator.initialize(builder.build());
        generator.generateKeyPair();
    }

    @PluginMethod
    public void getPublicKeySpki(PluginCall call) {
        String alias = call.getString("alias");
        if (alias == null || alias.isEmpty()) {
            call.reject("alias is required");
            return;
        }
        try {
            KeyStore keyStore = loadKeyStore();
            Certificate certificate = keyStore.getCertificate(alias);
            if (certificate == null) {
                call.reject("no public key for alias " + alias);
                return;
            }
            byte[] spki = certificate.getPublicKey().getEncoded();
            JSObject result = new JSObject();
            result.put("available", true);
            result.put("publicKeySpkiBase64", Base64.encodeToString(spki, Base64.NO_WRAP));
            result.put("fingerprint", fingerprint(spki));
            call.resolve(result);
        } catch (Exception error) {
            call.reject("getPublicKeySpki failed: " + error.getClass().getSimpleName() + ": " + error.getMessage(), error);
        }
    }

    @PluginMethod
    public void sign(PluginCall call) {
        String alias = call.getString("alias");
        String dataBase64 = call.getString("dataBase64");
        if (alias == null || dataBase64 == null) {
            call.reject("alias and dataBase64 are required");
            return;
        }
        try {
            KeyStore keyStore = loadKeyStore();
            KeyStore.Entry entry = keyStore.getEntry(alias, null);
            if (!(entry instanceof KeyStore.PrivateKeyEntry)) {
                call.reject("no private key for alias " + alias);
                return;
            }
            PrivateKey privateKey = ((KeyStore.PrivateKeyEntry) entry).getPrivateKey();
            Signature signature = Signature.getInstance(SIGNATURE_ALGORITHM);
            signature.initSign(privateKey);
            signature.update(Base64.decode(dataBase64, Base64.DEFAULT));
            byte[] der = signature.sign();
            byte[] raw = EcdsaDer.derToRaw(der);
            JSObject result = new JSObject();
            result.put("available", true);
            result.put("signatureBase64", Base64.encodeToString(raw, Base64.NO_WRAP));
            result.put("backend", "android-keystore");
            result.put("securityLevel", securityLevel(describeKeyInfo(alias)));
            call.resolve(result);
        } catch (Exception error) {
            if (isKeyInvalidated(error)) {
                call.reject("KEY_INVALIDATED: the key was permanently invalidated; it was not regenerated", error);
                return;
            }
            call.reject("sign failed: " + error.getClass().getSimpleName() + ": " + error.getMessage(), error);
        }
    }

    @PluginMethod
    public void getKeyInfo(PluginCall call) {
        String alias = call.getString("alias");
        if (alias == null || alias.isEmpty()) {
            call.reject("alias is required");
            return;
        }
        try {
            KeyStore keyStore = loadKeyStore();
            if (!keyStore.containsAlias(alias)) {
                JSObject result = new JSObject();
                result.put("available", true);
                result.put("exists", false);
                result.put("securityLevel", "software");
                result.put("hardwareBacked", false);
                result.put("strongBoxUsed", false);
                result.put("userAuthRequired", false);
                result.put("invalidated", false);
                call.resolve(result);
                return;
            }
            KeyInfo keyInfo = describeKeyInfo(alias);
            String level = securityLevel(keyInfo);
            JSObject result = new JSObject();
            result.put("available", true);
            result.put("securityLevel", level);
            result.put("hardwareBacked", keyInfo.isInsideSecureHardware() || !"software".equals(level));
            result.put("strongBoxUsed", "strongbox".equals(level));
            result.put("userAuthRequired", keyInfo.isUserAuthenticationRequired());
            result.put("exists", true);
            result.put("invalidated", false);
            call.resolve(result);
        } catch (Exception error) {
            if (isKeyInvalidated(error)) {
                JSObject result = new JSObject();
                result.put("available", true);
                result.put("exists", true);
                result.put("invalidated", true);
                result.put("securityLevel", "software");
                result.put("hardwareBacked", false);
                result.put("strongBoxUsed", false);
                result.put("userAuthRequired", true);
                call.resolve(result);
                return;
            }
            call.reject("getKeyInfo failed: " + error.getClass().getSimpleName() + ": " + error.getMessage(), error);
        }
    }

    @PluginMethod
    public void deleteKey(PluginCall call) {
        String alias = call.getString("alias");
        if (alias == null || alias.isEmpty()) {
            call.reject("alias is required");
            return;
        }
        try {
            KeyStore keyStore = loadKeyStore();
            keyStore.deleteEntry(alias);
            JSObject result = new JSObject();
            result.put("available", true);
            result.put("deleted", true);
            call.resolve(result);
        } catch (Exception error) {
            call.reject("deleteKey failed: " + error.getClass().getSimpleName() + ": " + error.getMessage(), error);
        }
    }

    private KeyStore loadKeyStore() throws Exception {
        KeyStore keyStore = KeyStore.getInstance(PROVIDER);
        keyStore.load(null);
        return keyStore;
    }

    private JSObject describe(String alias) throws Exception {
        KeyStore keyStore = loadKeyStore();
        if (!keyStore.containsAlias(alias)) {
            JSObject result = new JSObject();
            result.put("available", true);
            result.put("exists", false);
            result.put("securityLevel", "software");
            result.put("hardwareBacked", false);
            result.put("strongBoxUsed", false);
            result.put("userAuthRequired", false);
            result.put("invalidated", false);
            return result;
        }
        KeyInfo keyInfo = describeKeyInfo(alias);
        String level = securityLevel(keyInfo);
        Certificate certificate = keyStore.getCertificate(alias);
        byte[] spki = certificate == null ? null : certificate.getPublicKey().getEncoded();
        JSObject result = new JSObject();
        result.put("available", true);
        result.put("publicKeySpkiBase64", spki == null ? null : Base64.encodeToString(spki, Base64.NO_WRAP));
        result.put("fingerprint", spki == null ? null : fingerprint(spki));
        result.put("backend", "android-keystore");
        result.put("securityLevel", level);
        result.put("hardwareBacked", keyInfo.isInsideSecureHardware() || !"software".equals(level));
        result.put("strongBoxUsed", "strongbox".equals(level));
        result.put("userAuthRequired", keyInfo.isUserAuthenticationRequired());
        result.put("exists", true);
        result.put("invalidated", false);
        return result;
    }

    private KeyInfo describeKeyInfo(String alias) throws Exception {
        KeyStore keyStore = loadKeyStore();
        KeyStore.Entry entry = keyStore.getEntry(alias, null);
        if (!(entry instanceof KeyStore.PrivateKeyEntry)) {
            throw new IllegalStateException("no private key for alias " + alias);
        }
        PrivateKey privateKey = ((KeyStore.PrivateKeyEntry) entry).getPrivateKey();
        KeyFactory factory = KeyFactory.getInstance(privateKey.getAlgorithm(), PROVIDER);
        return factory.getKeySpec(privateKey, KeyInfo.class);
    }

    private String securityLevel(KeyInfo keyInfo) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            int level = keyInfo.getSecurityLevel();
            if (level == KeyProperties.SECURITY_LEVEL_STRONGBOX) return "strongbox";
            if (level == KeyProperties.SECURITY_LEVEL_TRUSTED_ENVIRONMENT) return "tee";
            return "software";
        }
        return keyInfo.isInsideSecureHardware() ? "tee" : "software";
    }

    private String fingerprint(byte[] spki) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        return toHex(digest.digest(spki));
    }

    private static String toHex(byte[] bytes) {
        StringBuilder builder = new StringBuilder(bytes.length * 2);
        for (byte value : bytes) {
            builder.append(String.format("%02x", value));
        }
        return builder.toString();
    }

    private boolean isStrongBoxUnavailable(Throwable error) {
        Throwable cause = error;
        while (cause != null) {
            if (cause.getClass().getName().contains("StrongBoxUnavailableException")) return true;
            cause = cause.getCause();
        }
        return false;
    }

    private boolean isKeyInvalidated(Throwable error) {
        Throwable cause = error;
        while (cause != null) {
            if (cause.getClass().getName().contains("KeyPermanentlyInvalidatedException")) return true;
            cause = cause.getCause();
        }
        return false;
    }
}
