package io.aegis.monitor

import org.junit.Assert.assertEquals
import org.junit.Test

class PureTest {

    @Test
    fun componentListIsSplitDeduplicatedAndTrimmed() {
        val list = SignalParsers.parseComponentList("com.a/.Svc: com.b/.X:com.a/.Svc:")
        assertEquals(listOf("com.a/.Svc", "com.b/.X"), list)
    }

    @Test
    fun emptyOrMissingComponentListIsEmpty() {
        assertEquals(emptyList<String>(), SignalParsers.parseComponentList(null))
        assertEquals(emptyList<String>(), SignalParsers.parseComponentList("   "))
    }

    @Test
    fun packageIsThePartBeforeTheSlash() {
        assertEquals("com.a", SignalParsers.packageOf("com.a/.Svc"))
    }

    @Test
    fun onlyUserInstalledCertificatesAreCounted() {
        val aliases = listOf("system:1234", "user:abcd", "system:9", "user:ef01")
        assertEquals(listOf("user:abcd", "user:ef01"), SignalParsers.userCaAliases(aliases))
    }

    @Test
    fun sha256MatchesTheKnownVector() {
        assertEquals(
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
            SignalParsers.sha256Hex("abc".toByteArray())
        )
    }

    @Test
    fun jsonEscapesAndKeepsOrder() {
        val json = Json.encode(mapOf("a" to "x\"y\n", "b" to listOf(1, true, null), "c" to null))
        assertEquals("{\"a\":\"x\\\"y\\n\",\"b\":[1,true,null],\"c\":null}", json)
    }

    @Test
    fun nonFiniteDoublesBecomeNull() {
        assertEquals("[null]", Json.encode(listOf(Double.NaN)))
    }
}
