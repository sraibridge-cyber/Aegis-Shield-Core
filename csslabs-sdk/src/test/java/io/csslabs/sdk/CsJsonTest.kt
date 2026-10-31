package io.csslabs.sdk

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test

class CsJsonTest {

    @Test
    fun canonicalSortsKeysAndKeepsNull() {
        assertEquals("{\"a\":{\"c\":[null,2]},\"b\":1,\"z\":null}", CsJson.canonical(linkedMapOf("b" to 1, "a" to linkedMapOf("c" to listOf(null, 2)), "z" to null)))
    }

    @Test
    fun parseReadsWhatCanonicalWrites() {
        val original = linkedMapOf<String, Any?>(
            "name" to "line one\nquote \" back \\ tab\t",
            "count" to 42L,
            "score" to 0.9946,
            "tiny" to 1.0E-5,
            "flag" to true,
            "missing" to null,
            "items" to listOf("a", "b"),
            "nested" to linkedMapOf("k" to 3L),
        )
        val text = CsJson.canonical(original)
        val back = CsJson.parse(text) as Map<*, *>
        assertEquals(text, CsJson.canonical(back))
        assertEquals(0.9946, back["score"])
        assertNull(back["missing"])
    }

    @Test
    fun parsesUnicodeEscapes() {
        assertEquals("A", CsJson.parse("\"\\u0041\""))
    }

    @Test
    fun rejectsMalformedText() {
        for (bad in listOf("{", "[1,", "{\"a\" 1}", "tru", "1 2")) {
            try {
                CsJson.parse(bad)
                fail("accepted: $bad")
            } catch (e: IllegalArgumentException) {
                assertTrue(true)
            }
        }
    }
}
