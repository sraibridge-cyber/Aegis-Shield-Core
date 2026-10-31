package io.aegis.monitor

import android.content.Context
import android.net.Uri
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.webkit.WebViewAssetLoader
import java.io.ByteArrayInputStream

object WebSetup {
    // A virtual host that serves files bundled in the APK. It is not a real
    // network address, and the app has no INTERNET permission to reach one.
    const val HOST = "appassets.androidplatform.net"
    const val START_URL = "https://$HOST/assets/monitor/index.html"

    fun loader(context: Context): WebViewAssetLoader =
        WebViewAssetLoader.Builder()
            .setDomain(HOST)
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(context))
            .build()
}

// Only the bundled monitor page may load. Any other address is refused, and
// the page never navigates away from itself.
class LocalOnlyClient(private val loader: WebViewAssetLoader) : WebViewClient() {

    override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? {
        val uri: Uri = request.url
        return if (uri.host == WebSetup.HOST) {
            loader.shouldInterceptRequest(uri)
        } else {
            blocked()
        }
    }

    override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
        // true means "handled here": anything outside the bundled host is not opened.
        return request.url.host != WebSetup.HOST
    }

    private fun blocked(): WebResourceResponse =
        WebResourceResponse("text/plain", "utf-8", 403, "Blocked", emptyMap(), ByteArrayInputStream(ByteArray(0)))
}
