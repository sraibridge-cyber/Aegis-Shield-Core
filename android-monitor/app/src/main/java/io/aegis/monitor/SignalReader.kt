package io.aegis.monitor

import android.app.admin.DevicePolicyManager
import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.provider.Settings
import java.security.KeyStore
import java.security.cert.X509Certificate
import java.util.Collections

// Reads the settings and indicators listed on the Android signals switch.
// Everything here is read-only. Values Android does not show to this app are
// reported as "not visible to this app" rather than guessed.
class SignalReader(private val context: Context, private val indicators: IndicatorWatch) {

    fun read(): Map<String, Any?> {
        val cr = context.contentResolver
        val network = readNetwork()
        return mapOf<String, Any?>(
            "readAt" to System.currentTimeMillis(),
            // Lists of "package/component" names the user turned on in Settings.
            "accessibilityServices" to SignalParsers.parseComponentList(
                Settings.Secure.getString(cr, "enabled_accessibility_services")
            ),
            "notificationListeners" to SignalParsers.parseComponentList(
                Settings.Secure.getString(cr, "enabled_notification_listeners")
            ),
            "deviceAdmins" to readAdmins(),
            "userCaCertificates" to readUserCa(),
            "vpnActive" to network.first,
            "proxy" to network.second,
            "developerOptions" to (Settings.Global.getInt(cr, Settings.Global.DEVELOPMENT_SETTINGS_ENABLED, 0) == 1),
            "usbDebugging" to (Settings.Global.getInt(cr, Settings.Global.ADB_ENABLED, 0) == 1),
        ) + indicators.snapshot()
    }

    private fun readAdmins(): Any {
        return try {
            val dpm = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
            (dpm.activeAdmins ?: emptyList()).map { it.flattenToShortString() }
        } catch (e: SecurityException) {
            "not visible to this app"
        }
    }

    // Counts and SHA-256 fingerprints of user-installed certificates. The
    // certificate contents are not stored.
    private fun readUserCa(): Map<String, Any?>? {
        return try {
            val store = KeyStore.getInstance("AndroidCAStore")
            store.load(null)
            val user = SignalParsers.userCaAliases(Collections.list(store.aliases()))
            val digests = user.mapNotNull { alias ->
                (store.getCertificate(alias) as? X509Certificate)?.encoded?.let { SignalParsers.sha256Hex(it) }
            }
            mapOf("count" to user.size, "sha256" to digests)
        } catch (e: Exception) {
            null
        }
    }

    // Returns (vpnActive, proxy "host:port" or null).
    private fun readNetwork(): Pair<Boolean?, String?> {
        val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val vpn: Boolean? = try {
            val caps = cm.activeNetwork?.let { cm.getNetworkCapabilities(it) }
            caps?.hasTransport(NetworkCapabilities.TRANSPORT_VPN) ?: false
        } catch (e: SecurityException) {
            null
        }
        val proxy: String? = try {
            cm.defaultProxy?.takeIf { !it.host.isNullOrEmpty() }?.let { "${it.host}:${it.port}" }
        } catch (e: SecurityException) {
            null
        }
        return Pair(vpn, proxy)
    }
}
