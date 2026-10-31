package io.csslabs.sdk

import kotlin.math.exp
import kotlin.math.ln
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class CoherenceTest {

    @Test
    fun geometricMeanMatchesTheFrameworkFormula() {
        val scores = mapOf("clock" to 0.5, "timing" to 1.0)
        val weights = mapOf("clock" to 0.6, "timing" to 0.4)
        assertEquals(exp(0.6 * ln(0.5)), Coherence.geometricMean(scores, weights)!!, 1e-12)
    }

    @Test
    fun geometricMeanIsBelowArithmeticWhenOneDimensionIsWeak() {
        val scores = mapOf("a" to 0.5, "b" to 1.0)
        val weights = mapOf("a" to 0.6, "b" to 0.4)
        val geo = Coherence.geometricMean(scores, weights)!!
        assertEquals(true, geo < 0.6 * 0.5 + 0.4 * 1.0)
    }

    @Test
    fun needsTwoDimensionsWeightsSummingToOneAndValidScores() {
        assertNull(Coherence.geometricMean(mapOf("a" to 0.9), mapOf("a" to 1.0)))
        assertNull(Coherence.geometricMean(mapOf("a" to 0.9, "b" to 0.9), mapOf("a" to 0.5, "b" to 0.3)))
        assertNull(Coherence.geometricMean(mapOf("a" to 0.0, "b" to 0.9), mapOf("a" to 0.5, "b" to 0.5)))
        assertNull(Coherence.geometricMean(mapOf("a" to 0.9), mapOf("a" to 0.5, "b" to 0.5)))
    }
}
