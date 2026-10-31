package io.aegis.monitor

import android.app.Activity
import android.os.Bundle
import android.webkit.WebSettings
import android.webkit.WebView

class MainActivity : Activity() {
    private lateinit var web: WebView
    private lateinit var indicators: IndicatorWatch

    @Suppress("DEPRECATION")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        indicators = IndicatorWatch(this)
        indicators.start()

        web = WebView(this)
        setContentView(web)
        web.settings.apply {
            javaScriptEnabled = true
            // Needed for the monitor's IndexedDB log.
            domStorageEnabled = true
            allowFileAccess = false
            allowContentAccess = false
            allowFileAccessFromFileURLs = false
            allowUniversalAccessFromFileURLs = false
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            setGeolocationEnabled(false)
        }
        web.webViewClient = LocalOnlyClient(WebSetup.loader(this))
        web.addJavascriptInterface(NativeBridge(this, SignalReader(this, indicators)), "AegisNative")
        web.loadUrl(WebSetup.START_URL)
    }

    override fun onBackPressed() {
        if (web.canGoBack()) web.goBack() else super.onBackPressed()
    }

    override fun onDestroy() {
        web.destroy()
        super.onDestroy()
    }
}
