package io.csslabs.sdk

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class SignalChangesTest {

    private fun base(): Map<String, Any?> = linkedMapOf(
        "accessibilityServices" to emptyList<String>(),
        "deviceAdmins" to emptyList<String>(),
        "vpnActive" to false,
        "microphoneRecordingClients" to 0L,
        "camerasInUse" to 0L,
    )

    @Test
    fun noFlagsWithoutAnEarlierReading() {
        assertTrue(SignalChanges.between(null, base()).isEmpty())
    }

    @Test
    fun newAccessibilityServiceIsFlaggedByName() {
        val cur = base() + mapOf("accessibilityServices" to listOf("evil.app/.Svc"))
        val f = SignalChanges.between(base(), cur)
        assertEquals(listOf("ACCESSIBILITY_ON"), f.map { it.code })
        assertTrue(f[0].text.contains("evil.app"))
    }

    @Test
    fun adminAndVpnChangesAreFlagged() {
        val cur = base() + mapOf("deviceAdmins" to listOf("p/q"), "vpnActive" to true)
        assertEquals(listOf("DEVICE_ADMIN_ON", "VPN_ON"), SignalChanges.between(base(), cur).map { it.code })
    }

    @Test
    fun otherAppRecordingAudioIsFlaggedWithoutAnAppName() {
        val cur = base() + mapOf("microphoneRecordingClients" to 2L)
        val f = SignalChanges.between(base(), cur)
        assertEquals(listOf("MICROPHONE_IN_USE"), f.map { it.code })
        assertFalse(Regex("[a-z]+\\.[a-z]+").containsMatchIn(f[0].text))
    }

    @Test
    fun fieldsThatAreNotVisibleAreNeverCompared() {
        val prev = base() + mapOf("deviceAdmins" to "not visible to this app")
        val cur = base() + mapOf("deviceAdmins" to listOf("p/q"))
        assertTrue(SignalChanges.between(prev, cur).isEmpty())
    }

    private fun assertFalse(b: Boolean) = org.junit.Assert.assertFalse(b)
}
