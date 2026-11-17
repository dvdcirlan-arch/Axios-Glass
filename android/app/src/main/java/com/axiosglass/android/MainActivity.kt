package com.axiosglass.android

import android.app.Activity
import android.app.AlertDialog
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.view.Menu
import android.view.MenuItem
import android.view.View
import android.webkit.CookieManager
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.ProgressBar
import android.widget.Toast
import android.widget.Toolbar
import org.json.JSONObject

class MainActivity : Activity() {

    companion object {
        private const val TAG = "AxiosGlass"
        private const val WEB_STATE = "webview_state"
        private const val AXIOS_HOST = "axioscloud.it"
        private const val USER_AGENT =
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
                "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 AxiosGlassAndroid/1.0"
        private val RUNTIME_FILES = listOf("core.js", "ui.js", "scraper.js", "content.js")
    }

    private lateinit var webView: WebView
    private lateinit var progress: ProgressBar
    private lateinit var toolbar: Toolbar
    private var glassActive = true
    private var menuToggle: MenuItem? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        toolbar = findViewById(R.id.toolbar)
        progress = findViewById(R.id.progress)
        webView = findViewById(R.id.webview)

        setActionBar(toolbar)
        actionBar?.setDisplayHomeAsUpEnabled(false)
        toolbar.setTitle(R.string.app_name)
        toolbar.setSubtitle(R.string.subtitle_connecting)

        configureWebView()

        val savedWebState = savedInstanceState?.getBundle(WEB_STATE)
        if (savedWebState != null) {
            webView.restoreState(savedWebState)
            webView.postDelayed({
                if (isAxiosUrl(webView.url.orEmpty())) injectGlass(webView)
            }, 400)
        } else {
            webView.loadUrl(getString(R.string.url_axios))
        }
    }

    /* ------------------------------------------------------------- WebView */

    private fun configureWebView() {
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            cacheMode = WebSettings.LOAD_DEFAULT
            loadWithOverviewMode = true
            useWideViewPort = true
            setSupportZoom(true)
            builtInZoomControls = true
            displayZoomControls = false
            allowFileAccess = false
            allowContentAccess = true
            mediaPlaybackRequiresUserGesture = true
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            userAgentString = USER_AGENT
        }

        CookieManager.getInstance().apply {
            setAcceptCookie(true)
            setAcceptThirdPartyCookies(webView, true)
        }

        if (BuildConfig.DEBUG) {
            WebView.setWebContentsDebuggingEnabled(true)
        }

        progress.visibility = View.VISIBLE

        webView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                progress.progress = newProgress
                progress.visibility = if (newProgress >= 100) View.GONE else View.VISIBLE
            }
        }

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val uri = request?.url ?: return false
                return when (uri.scheme?.lowercase()) {
                    "http", "https" -> false
                    "tel", "mailto", "intent", "market" -> openExternally(uri)
                    else -> false
                }
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                progress.visibility = View.GONE
                val current = url.orEmpty()
                if (view == webView && current == webView.url && isAxiosUrl(current)) {
                    toolbar.setSubtitle(R.string.subtitle_loading_glass)
                    view.postDelayed({ injectGlass(view) }, 250)
                } else {
                    toolbar.subtitle = Uri.parse(current).host ?: getString(R.string.subtitle_connecting)
                }
            }
        }

        webView.setDownloadListener { url, _, _, _, _ ->
            openExternally(Uri.parse(url))
        }
    }

    private fun injectGlass(view: WebView) {
        try {
            val css = readAsset("axiosglass/styles.css")
            val cssScript = """
                (function () {
                  var id = 'axglass-mobile-styles';
                  var old = document.getElementById(id);
                  if (old) old.remove();
                  var style = document.createElement('style');
                  style.id = id;
                  style.textContent = ${JSONObject.quote(css)};
                  (document.head || document.documentElement).appendChild(style);
                })();
            """.trimIndent()

            val runtime = RUNTIME_FILES.joinToString("\n") { readAsset("axiosglass/$it") }

            val bridge = """
                (function () {
                  document.documentElement.setAttribute('data-axiosglass-mobile', '1');
                  if (!window.AxiosGlassMobile) return false;
                  var stored = null;
                  try { stored = localStorage.getItem('axiosglass:active'); } catch (e) {}
                  var active = stored == null ? true : JSON.parse(stored);
                  window.AxiosGlassMobile.setActive(active);
                  return window.AxiosGlassMobile.isActive();
                })()
            """.trimIndent()

            view.evaluateJavascript("$cssScript\n$runtime\n$bridge") { result ->
                glassActive = result != "false"
                toolbar.setSubtitle(if (glassActive) R.string.subtitle_ready else R.string.subtitle_classic)
                updateToggleMenu()
            }
        } catch (error: Exception) {
            Log.e(TAG, "Failed to inject Axios Glass", error)
            toolbar.setSubtitle(R.string.subtitle_injection_error)
        }
    }

    private fun readAsset(path: String): String =
        assets.open(path).bufferedReader(Charsets.UTF_8).use { it.readText() }

    private fun isAxiosUrl(url: String): Boolean {
        val host = Uri.parse(url).host ?: return false
        return host.equals(AXIOS_HOST, ignoreCase = true) ||
            host.endsWith(".$AXIOS_HOST", ignoreCase = true)
    }

    private fun openExternally(uri: Uri): Boolean {
        val intent = Intent(Intent.ACTION_VIEW, uri).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        return try {
            startActivity(intent)
            true
        } catch (error: Exception) {
            Toast.makeText(this, R.string.error_open, Toast.LENGTH_SHORT).show()
            true
        }
    }

    /* ---------------------------------------------------------------- Menu */

    override fun onCreateOptionsMenu(menu: Menu): Boolean {
        menuInflater.inflate(R.menu.menu_main, menu)
        menuToggle = menu.findItem(R.id.action_toggle)
        updateToggleMenu()
        return true
    }

    private fun updateToggleMenu() {
        menuToggle?.setTitle(if (glassActive) R.string.menu_classic else R.string.menu_glass)
    }

    override fun onOptionsItemSelected(item: MenuItem): Boolean = when (item.itemId) {
        R.id.action_reload -> {
            webView.reload()
            true
        }
        R.id.action_refresh -> {
            webView.evaluateJavascript(
                "(function(){ if(!window.AxiosGlassMobile) return false; window.AxiosGlassMobile.render(); return true; })()",
                null
            )
            true
        }
        R.id.action_toggle -> {
            toggleGlass()
            true
        }
        R.id.action_open -> {
            openExternally(Uri.parse(webView.url ?: getString(R.string.url_axios)))
            true
        }
        R.id.action_about -> {
            AlertDialog.Builder(this)
                .setTitle(R.string.about_title)
                .setMessage(R.string.about_message)
                .setPositiveButton(android.R.string.ok, null)
                .show()
            true
        }
        else -> super.onOptionsItemSelected(item)
    }

    private fun toggleGlass() {
        webView.evaluateJavascript(
            """
            (function () {
              if (!window.AxiosGlassMobile) return null;
              var next = !window.AxiosGlassMobile.isActive();
              window.AxiosGlassMobile.setActive(next);
              return next;
            })()
            """.trimIndent()
        ) { result ->
            if (result != "null") {
                glassActive = result == "true"
                toolbar.setSubtitle(if (glassActive) R.string.subtitle_ready else R.string.subtitle_classic)
                updateToggleMenu()
            }
        }
    }

    /* ------------------------------------------------------------ Lifecycle */

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (webView.canGoBack()) webView.goBack() else super.onBackPressed()
    }

    override fun onPause() {
        super.onPause()
        webView.onPause()
    }

    override fun onResume() {
        super.onResume()
        webView.onResume()
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        val webState = Bundle()
        webView.saveState(webState)
        outState.putBundle(WEB_STATE, webState)
    }

    override fun onDestroy() {
        webView.destroy()
        super.onDestroy()
    }
}
