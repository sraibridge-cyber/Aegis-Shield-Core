package io.aegis.keystore;

import java.util.Arrays;

/**
 * DER ↔ raw ECDSA signature conversion.
 *
 * Android Keystore's SHA256withECDSA returns DER:
 *   SEQUENCE { r INTEGER, s INTEGER }
 * WebCrypto's ECDSA verify expects IEEE P1363 raw R||S:
 *   64 bytes for P-256.
 *
 * A Keystore signature passed unchanged to crypto.subtle.verify fails.
 * This class parses the SEQUENCE, strips the INTEGER sign byte, left-pads
 * each integer to exactly 32 bytes, and concatenates r then s.
 */
public final class EcdsaDer {
    public static final int P256_COORDINATE_BYTES = 32;
    public static final int P256_RAW_BYTES = 64;

    private EcdsaDer() {}

    public static byte[] derToRaw(byte[] der) {
        if (der == null) throw new IllegalArgumentException("TRUNCATED: null DER");
        int[] offset = {0};
        if (der.length < 2) throw new IllegalArgumentException("TRUNCATED: no SEQUENCE");
        if ((der[0] & 0xff) != 0x30) throw new IllegalArgumentException("WRONG_TAG: expected SEQUENCE");
        int seqLength = readLength(der, offset);
        if (offset[0] + seqLength != der.length) {
            throw new IllegalArgumentException("BAD_LENGTH: SEQUENCE length does not match input");
        }
        byte[] r = readInteger(der, offset);
        byte[] s = readInteger(der, offset);
        if (offset[0] != der.length) throw new IllegalArgumentException("BAD_LENGTH: trailing bytes");
        byte[] raw = new byte[P256_RAW_BYTES];
        writePadded(r, raw, 0);
        writePadded(s, raw, P256_COORDINATE_BYTES);
        return raw;
    }

    public static byte[] rawToDer(byte[] raw) {
        if (raw == null || raw.length != P256_RAW_BYTES) {
            throw new IllegalArgumentException("BAD_LENGTH: raw signature must be 64 bytes");
        }
        byte[] r = encodeInteger(Arrays.copyOfRange(raw, 0, P256_COORDINATE_BYTES));
        byte[] s = encodeInteger(Arrays.copyOfRange(raw, P256_COORDINATE_BYTES, P256_RAW_BYTES));
        int contentLength = r.length + s.length;
        if (contentLength > 127) throw new IllegalArgumentException("BAD_LENGTH: DER content too long");
        byte[] der = new byte[2 + contentLength];
        der[0] = 0x30;
        der[1] = (byte) contentLength;
        System.arraycopy(r, 0, der, 2, r.length);
        System.arraycopy(s, 0, der, 2 + r.length, s.length);
        return der;
    }

    private static int readLength(byte[] der, int[] offset) {
        if (offset[0] >= der.length) throw new IllegalArgumentException("TRUNCATED: missing length");
        int first = der[offset[0]++] & 0xff;
        if (first < 0x80) return first;
        int count = first & 0x7f;
        if (count == 0) throw new IllegalArgumentException("BAD_LENGTH: indefinite length is not allowed");
        if (count > 2) throw new IllegalArgumentException("BAD_LENGTH: length too long");
        if (offset[0] + count > der.length) throw new IllegalArgumentException("TRUNCATED: length bytes");
        int length = 0;
        for (int i = 0; i < count; i++) {
            length = (length << 8) | (der[offset[0]++] & 0xff);
        }
        if (length < 0x80) throw new IllegalArgumentException("BAD_LENGTH: non-minimal long-form length");
        return length;
    }

    private static byte[] readInteger(byte[] der, int[] offset) {
        if (offset[0] >= der.length) throw new IllegalArgumentException("TRUNCATED: missing INTEGER");
        if ((der[offset[0]++] & 0xff) != 0x02) throw new IllegalArgumentException("WRONG_TAG: expected INTEGER");
        int length = readLength(der, offset);
        if (offset[0] + length > der.length) throw new IllegalArgumentException("TRUNCATED: INTEGER value");
        if (length == 0) throw new IllegalArgumentException("BAD_LENGTH: empty INTEGER");
        byte[] value = Arrays.copyOfRange(der, offset[0], offset[0] + length);
        offset[0] += length;
        int start = 0;
        while (start < value.length - 1 && value[start] == 0) start++;
        int significant = value.length - start;
        if (significant > P256_COORDINATE_BYTES) {
            throw new IllegalArgumentException("INTEGER_TOO_LONG: coordinate exceeds 32 bytes");
        }
        return Arrays.copyOfRange(value, start, value.length);
    }

    private static void writePadded(byte[] value, byte[] out, int offset) {
        if (value.length > P256_COORDINATE_BYTES) {
            throw new IllegalArgumentException("INTEGER_TOO_LONG: coordinate exceeds 32 bytes");
        }
        System.arraycopy(value, 0, out, offset + (P256_COORDINATE_BYTES - value.length), value.length);
    }

    private static byte[] encodeInteger(byte[] value) {
        int start = 0;
        while (start < value.length - 1 && value[start] == 0) start++;
        int significant = value.length - start;
        boolean needsSignByte = (value[start] & 0x80) != 0;
        int length = significant + (needsSignByte ? 1 : 0);
        if (length > 127) throw new IllegalArgumentException("BAD_LENGTH: INTEGER too long");
        byte[] out = new byte[2 + length];
        out[0] = 0x02;
        out[1] = (byte) length;
        if (needsSignByte) {
            out[2] = 0x00;
            System.arraycopy(value, start, out, 3, significant);
        } else {
            System.arraycopy(value, start, out, 2, significant);
        }
        return out;
    }
}
