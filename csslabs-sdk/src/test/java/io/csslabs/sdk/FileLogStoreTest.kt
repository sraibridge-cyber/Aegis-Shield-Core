package io.csslabs.sdk

import java.io.File
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class FileLogStoreTest {

    @Test
    fun appendsPersistAndVerifyAfterReopen() {
        val dir = File(System.getProperty("java.io.tmpdir"), "csslabs-test-${System.nanoTime()}")
        val file = File(dir, "chain.jsonl")
        val store = FileLogStore(file)
        val g = Chain.build(null, "GENESIS", "start", linkedMapOf("a" to 1L), "2026-10-31T12:00:00.000Z")
        assertTrue(store.appendIfHead(0L, null, g))
        val r2 = Chain.build(g, "OBSERVATION", "second", linkedMapOf("readings" to linkedMapOf("x" to true)), "2026-10-31T12:00:01.000Z")
        assertTrue(store.appendIfHead(1L, g.hash, r2))

        val reopened = FileLogStore(file)
        val recs = reopened.all()
        assertEquals(2, recs.size)
        assertTrue(Chain.verify(recs).ok)
        assertEquals(r2.hash, reopened.head()!!.hash)
    }

    @Test
    fun refusesAStaleHeadAndABrokenLink() {
        val dir = File(System.getProperty("java.io.tmpdir"), "csslabs-test-${System.nanoTime()}")
        val store = FileLogStore(File(dir, "chain.jsonl"))
        val g = Chain.build(null, "GENESIS", "start", emptyMap(), "2026-10-31T12:00:00.000Z")
        assertTrue(store.appendIfHead(0L, null, g))
        val stale = Chain.build(null, "OBSERVATION", "forked from nothing", emptyMap(), "2026-10-31T12:00:02.000Z")
        assertFalse(store.appendIfHead(0L, null, stale))
        val r2 = Chain.build(g, "OBSERVATION", "ok", emptyMap(), "2026-10-31T12:00:03.000Z")
        assertFalse(store.appendIfHead(0L, g.hash, r2))
        assertEquals(1, store.all().size)
    }

    @Test
    fun editingTheFileOnDiskIsDetectedByVerification() {
        val dir = File(System.getProperty("java.io.tmpdir"), "csslabs-test-${System.nanoTime()}")
        val file = File(dir, "chain.jsonl")
        val store = FileLogStore(file)
        val g = Chain.build(null, "GENESIS", "start", emptyMap(), "2026-10-31T12:00:00.000Z")
        store.appendIfHead(0L, null, g)
        val r2 = Chain.build(g, "CONSENT", "accessibility on", linkedMapOf("granted" to true), "2026-10-31T12:00:01.000Z")
        store.appendIfHead(1L, g.hash, r2)
        file.writeText(file.readText().replace("accessibility on", "accessibility off"))
        assertFalse(Chain.verify(FileLogStore(file).all()).ok)
    }
}
