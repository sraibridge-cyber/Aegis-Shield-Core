package io.aegis.monitor

import android.app.Activity
import android.content.Intent
import android.provider.Settings
import android.webkit.JavascriptInterface

// Exposed to the monitor page as window.AegisNative. It only reads signals and
// opens Android's own Settings screens. It has no method that changes a
// setting, sends data, or touches files.
class NativeBridge(private val activity: Activity, private val reader: SignalReader) {

    @JavascriptInterface
    fun readSignals(): String = Json.encode(reader.read())

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
