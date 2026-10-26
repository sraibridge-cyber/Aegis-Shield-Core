package io.aegis.keystore;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.fail;

import org.junit.Test;

/**
 * Known-answer test for the DER → raw conversion.
 *
 * This file is source only. It has not been compiled or run in this
 * environment; there is no JVM or Android toolchain here.
 */
public class EcdsaDerTest {
    private static final String DER_HEX =
            "30440220"
            + "0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20"
            + "0220"
            + "2122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f40";
    private static final String RAW_HEX =
            "0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20"
            + "2122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f40";

    @Test
    public void knownAnswerDerToRaw() {
        assertArrayEquals(hex(RAW_HEX), EcdsaDer.derToRaw(hex(DER_HEX)));
    }

    @Test
    public void rawToDerRoundTrip() {
        assertArrayEquals(hex(DER_HEX), EcdsaDer.rawToDer(hex(RAW_HEX)));
    }

    @Test
    public void malformedDerIsRejected() {
        assertCode("TRUNCATED", new byte[]{0x30});
        byte[] wrongTag = hex(DER_HEX);
        wrongTag[0] = 0x31;
        assertCode("WRONG_TAG", wrongTag);
        byte[] tooLong = hex("30450221" + "01".repeat(33) + "0220" + "21".repeat(32));
        assertCode("INTEGER_TOO_LONG", tooLong);
    }

    private static void assertCode(String code, byte[] der) {
        try {
            EcdsaDer.derToRaw(der);
            fail("expected " + code);
        } catch (IllegalArgumentException error) {
            assertEquals(code, error.getMessage().split(":")[0]);
        }
    }

    private static byte[] hex(String value) {
        byte[] out = new byte[value.length() / 2];
        for (int i = 0; i < out.length; i++) {
            out[i] = (byte) Integer.parseInt(value.substring(i * 2, i * 2 + 2), 16);
        }
        return out;
    }
}
