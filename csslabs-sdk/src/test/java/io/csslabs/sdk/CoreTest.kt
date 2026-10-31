package io.csslabs.sdk

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class CoreTest {

    private class FakeSource(var reading: Map<Signal, Map<String, Any?>> = emptyMap()) : SignalSource {
        var reads = 0
        override fun read(signal: Signal): Map<String, Any?> {
            reads++
            return reading[signal] ?: emptyMap()
        }
    }

    private class FixedScorer : CoherenceScorer {
        override val dimensions = listOf("clock", "timing")
        override val weights = mapOf("clock" to 0.6, "timing" to 0.4)
        override fun score(reading: Map<String, Any?>): Map<String, Double>? = mapOf("clock" to 1.0, "timing" to 0.5)
    }

    private fun core(store: LogStore = MemoryLogStore(), source: FakeSource = FakeSource(), scorer: CoherenceScorer = NoScorer): Triple<CssLabsCore, LogStore, FakeSource> {
        var t = 1_000_000L
        val c = CssLabsCore(store, MemoryConsent(), source, scorer) { t += 1000; t }
        return Triple(c, store, source)
    }

    @Test
    fun withNoSignalGrantedNothingIsReadAndOnlyGenesisIsWritten() {
        val (c, store, source) = core()
        val r = c.sample()
        assertFalse(r.sampled)
        assertEquals("no permissions granted", r.reason)
        assertEquals(0, source.reads)
        assertEquals(listOf("GENESIS"), store.all().map { it.type })
        assertTrue(c.verify().ok)
    }

    @Test
    fun turningASignalOnLogsConsentAndThenReadings() {
        val source = FakeSource(mapOf(Signal.ACCESSIBILITY to mapOf("accessibilityServices" to listOf("a/.S"))))
        val (c, store, _) = core(source = source)
        assertTrue(c.setConsent(Signal.ACCESSIBILITY, true))
        assertFalse(c.setConsent(Signal.ACCESSIBILITY, true))
        val r = c.sample()
        assertTrue(r.sampled)
        assertEquals(listOf("GENESIS", "CONSENT", "OBSERVATION"), store.all().map { it.type })
        assertEquals(1, source.reads)
        assertTrue(c.verify().ok)
    }

    @Test
    fun onlyGrantedSignalsAreRead() {
        val source = FakeSource()
        val (c, _, _) = core(source = source)
        c.setConsent(Signal.DEVELOPER, true)
        c.sample()
        assertEquals(1, source.reads)
    }

    @Test
    fun aChangeBetweenReadingsIsFlagged() {
        val source = FakeSource(mapOf(Signal.ADMINS to mapOf("deviceAdmins" to emptyList<String>())))
        val (c, _, _) = core(source = source)
        c.setConsent(Signal.ADMINS, true)
        c.sample()
        source.reading = mapOf(Signal.ADMINS to mapOf("deviceAdmins" to listOf("x/y")))
        val r = c.sample()
        assertEquals(listOf("DEVICE_ADMIN_ON"), r.flags.map { it.code })
    }

    @Test
    fun turningOffResetsTheBaseline() {
        val source = FakeSource(mapOf(Signal.ADMINS to mapOf("deviceAdmins" to emptyList<String>())))
        val (c, _, _) = core(source = source)
        c.setConsent(Signal.ADMINS, true)
        c.sample()
        c.setConsent(Signal.ADMINS, false)
        c.setConsent(Signal.ADMINS, true)
        source.reading = mapOf(Signal.ADMINS to mapOf("deviceAdmins" to listOf("x/y")))
        assertTrue(c.sample().flags.isEmpty())
    }

    @Test
    fun coherenceIsNotInventedWithoutAScorer() {
        val source = FakeSource(mapOf(Signal.NETWORK to mapOf("vpnActive" to false)))
        val (c, _, _) = core(source = source)
        c.setConsent(Signal.NETWORK, true)
        val r = c.sample()
        assertNull(r.coherence.value)
        assertFalse(r.coherence.calibrated)
        assertNull(r.coherence.tau)
    }

    @Test
    fun aSuppliedScorerIsUsedAndStillUncalibrated() {
        val source = FakeSource(mapOf(Signal.NETWORK to mapOf("vpnActive" to false)))
        val (c, _, _) = core(source = source, scorer = FixedScorer())
        c.setConsent(Signal.NETWORK, true)
        val r = c.sample()
        assertEquals(true, r.coherence.value != null)
        assertFalse(r.coherence.calibrated)
    }

    @Test
    fun sanityReportsRuleAndGateAndNeverGivesAVerdictWithoutTau() {
        val source = FakeSource(mapOf(Signal.NETWORK to mapOf("vpnActive" to false)))
        val (c, _, _) = core(source = source)
        c.setConsent(Signal.NETWORK, true)
        c.sample()
        val s = c.sanity()
        assertTrue(s.ruleLogIntact)
        assertTrue(s.gateConsentHeld)
        assertNull(s.threshold)
        assertTrue(s.verdict.startsWith("Not evaluated"))
    }

    @Test
    fun aReadingWithoutConsentBreaksTheGate() {
        val store = MemoryLogStore()
        val (c, _, _) = core(store = store)
        val head = store.head()!!
        val forged = Chain.build(head, "OBSERVATION", "readings: network", linkedMapOf("readings" to linkedMapOf("vpnActive" to true)), "2026-10-31T12:00:09.000Z")
        assertTrue(store.appendIfHead(head.seq, head.hash, forged))
        assertFalse(c.sanity().gateConsentHeld)
        assertTrue(c.verify().ok)
    }

    @Test
    fun exportChecksOnAnotherMachineAndCatchesEdits() {
        val source = FakeSource(mapOf(Signal.NETWORK to mapOf("vpnActive" to false)))
        val (c, _, _) = core(source = source)
        c.setConsent(Signal.NETWORK, true)
        c.sample()
        val text = c.exportText()
        val ok = CssLabsCore.checkExport(text)
        assertTrue(ok.ok)
        assertEquals(3, ok.count)
        val edited = text.replace("network on", "network off")
        assertFalse(CssLabsCore.checkExport(edited).ok)
        assertFalse(CssLabsCore.checkExport(text, "00".repeat(32)).ok)
        assertFalse(CssLabsCore.checkExport("{\"format\":\"nope\"}").ok)
    }
}
