package io.csslabs.sdk

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ChainTest {

    private fun chain(n: Int): List<ChainRecord> {
        val out = ArrayList<ChainRecord>()
        var prev: ChainRecord? = null
        for (i in 0 until n) {
            val rec = Chain.build(
                prev,
                if (i == 0) "GENESIS" else "OBSERVATION",
                "entry ${i + 1}",
                linkedMapOf("i" to i.toLong(), "reading" to linkedMapOf("level" to 0.5 + i / 100.0)),
                "2026-10-31T12:00:%02d.000Z".format(i),
            )
            out.add(rec)
            prev = rec
        }
        return out
    }

    @Test
    fun cleanChainVerifiesAndReportsHead() {
        val c = chain(5)
        assertEquals(Chain.GENESIS_PREV, c[0].prevHash)
        val v = Chain.verify(c)
        assertTrue(v.ok)
        assertEquals(5, v.count)
        assertEquals(5L, v.headSeq)
        assertEquals(c[4].hash, v.headHash)
    }

    @Test
    fun emptyLogVerifies() {
        val v = Chain.verify(emptyList())
        assertTrue(v.ok)
        assertEquals(null, v.headHash)
    }

    @Test
    fun editedPayloadIsDetectedAtThatRecord() {
        val c = chain(5).toMutableList()
        c[2] = c[2].copy(payload = linkedMapOf("i" to 99L))
        val v = Chain.verify(c)
        assertFalse(v.ok)
        assertEquals(3L, v.brokenAt)
        assertTrue(v.reason!!.contains("payload"))
    }

    @Test
    fun editedSummaryIsDetectedBecauseTheHashCoversIt() {
        val c = chain(4).toMutableList()
        c[1] = c[1].copy(summary = "nothing happened here")
        val v = Chain.verify(c)
        assertFalse(v.ok)
        assertEquals(2L, v.brokenAt)
        assertTrue(v.reason!!.contains("record fields"))
    }

    @Test
    fun editedTimestampIsDetected() {
        val c = chain(4).toMutableList()
        c[3] = c[3].copy(ts = "2026-10-31T09:00:00.000Z")
        assertFalse(Chain.verify(c).ok)
    }

    @Test
    fun deletionInTheMiddleIsDetected() {
        val c = chain(5).toMutableList()
        c.removeAt(2)
        val v = Chain.verify(c)
        assertFalse(v.ok)
        assertTrue(v.reason!!.contains("sequence"))
    }

    @Test
    fun reorderingIsDetected() {
        val c = chain(4).toMutableList()
        val t = c[1]
        c[1] = c[2]
        c[2] = t
        assertFalse(Chain.verify(c).ok)
    }

    @Test
    fun logThatDoesNotStartWithGenesisIsRejected() {
        val c = chain(3)
        assertFalse(Chain.verify(c.drop(1)).ok)
    }

    @Test
    fun droppingNewestRecordsStillVerifiesLocallyButSavedHeadCatchesIt() {
        val c = chain(6)
        val saved = c[5].hash
        val cut = c.take(4)
        assertTrue(Chain.verify(cut).ok)
        val text = CsJson.canonical(linkedMapOf("format" to CssLabsCore.EXPORT_FORMAT, "version" to 1L, "headHash" to cut.last().hash, "records" to cut.map { it.toMap() }))
        val r = CssLabsCore.checkExport(text, saved)
        assertFalse(r.ok)
        assertTrue(r.reason!!.contains("head hash differs"))
    }

    @Test
    fun fullRewriteWithRecomputedHashesPassesLocallyButMovesTheHead() {
        val original = chain(4)
        val savedHead = original[3].hash
        val forged = ArrayList<ChainRecord>()
        var prev: ChainRecord? = null
        for (r in original) {
            val summary = if (r.seq == 2L) "entry 2 (edited)" else r.summary
            val rec = Chain.build(prev, r.type, summary, r.payload, r.ts)
            forged.add(rec)
            prev = rec
        }
        assertTrue(Chain.verify(forged).ok)
        assertNotEquals(savedHead, Chain.verify(forged).headHash)
    }
}
