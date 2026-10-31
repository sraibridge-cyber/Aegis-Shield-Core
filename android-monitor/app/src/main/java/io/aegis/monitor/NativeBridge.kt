package io.aegis.monitor

import android.app.Activity
import android.content.Intent
import android.provider.Settings
import android.webkit.JavascriptInterface
import io.csslabs.sdk.CsJson
import io.csslabs.sdk.CssLabsMonitor
import io.csslabs.sdk.Signal

// Exposed to the monitor page as window.AegisNative. It reads signals through
// the CSS Labs SDK, sets the SDK's consent, reports the native log's status, and
// opens Android's own Settings screens. It has no method that changes an Android
// setting, sends data, or touches files.
class NativeBridge(private val activity: Activity, private val monitor: CssLabsMonitor) {

    // Records one entry in the native log for the granted signals, then returns
    // their readings as JSON. With no signal granted it returns an empty object.
    @JavascriptInterface
    fun readSignals(): String = CsJson.canonical(monitor.sample().reading)

    // The page's single "Device signals" switch turns all signals on or off.
    @JavascriptInterface
    fun setSignalConsent(on: Boolean): Boolean {
        monitor.setConsent(Signal.values().toList(), on)
        return true
    }

    @JavascriptInterface
    fun verifyNativeLog(): String {
        val v = monitor.verify()
        val out = LinkedHashMap<String, Any?>()
        out["ok"] = v.ok
        out["count"] = v.count.toLong()
        out["headHash"] = v.headHash
        out["reason"] = v.reason
        return CsJson.canonical(out)
    }

    @JavascriptInterface
    fun openSettings(kind: String): Boolean {
        val action = when (kind) {
            "accessibility" -> Settings.ACTION_ACCESSIBILITY_SETTINGS
            "notifications" -> Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS
            "security" -> Settings.ACTION_SECURITY_SETTINGS
            "developer" -> Settings.ACTION_APPLICATION_DEVELOPMENT_SETTINGS
            else -> return false
        }
        activity.runOnUiThread {
            try {
                activity.startActivity(Intent(action))
            } catch (e: Exception) {
                // Some devices hide a Settings screen. The page keeps working.
            }
        }
        return true
    }
}
