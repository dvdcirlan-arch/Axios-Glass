# No code shrinking enabled yet. Keep WebView JS bridge names stable if added later.
-keepattributes JavascriptInterface
-keepclassmembers class com.axiosglass.android.MainActivity$NativeBridge {
    @android.webkit.JavascriptInterface <methods>;
}
