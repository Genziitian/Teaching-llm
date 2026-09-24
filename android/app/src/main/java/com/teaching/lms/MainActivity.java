package com.teaching.lms;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.webkit.JavascriptInterface;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final String PLAY_PACKAGE = "com.teaching.lms";
    private static final String PLAY_REFERRER = "utm_source=capacitor&utm_medium=sunset_banner";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Window window = getWindow();
        WindowCompat.setDecorFitsSystemWindows(window, false);

        View rootView = window.getDecorView();
        ViewCompat.setOnApplyWindowInsetsListener(rootView, (v, insets) -> {
            int navBottomPx = insets.getInsets(WindowInsetsCompat.Type.navigationBars()).bottom;
            float density = getResources().getDisplayMetrics().density;
            int navBottomDp = Math.round(navBottomPx / density);

            if (this.bridge != null && this.bridge.getWebView() != null) {
                this.bridge.getWebView().post(() -> {
                    try {
                        String js = String.format(
                            "document.documentElement.style.setProperty('--android-nav-bottom', '%dpx');",
                            navBottomDp
                        );
                        this.bridge.getWebView().evaluateJavascript(js, null);
                    } catch (Exception ignored) {}
                });
            }
            return ViewCompat.onApplyWindowInsets(v, insets);
        });
    }

    @Override
    public void onStart() {
        super.onStart();
        attachPlayInlineBridge();
    }

    @Override
    public void onResume() {
        super.onResume();
        attachPlayInlineBridge();
    }

    private void attachPlayInlineBridge() {
        if (this.bridge == null || this.bridge.getWebView() == null) return;
        this.bridge.getWebView().addJavascriptInterface(new PlayInlineBridge(), "GenZPlayInline");
    }

    /**
     * Google Play inline install half-sheet.
     * https://developer.android.com/distribute/marketing-tools/inline-installs
     * If Play will not show the sheet, the same intent opens the full listing.
     */
    private void openPlayInlineInstall() {
        Intent intent = new Intent(Intent.ACTION_VIEW);
        intent.setPackage("com.android.vending");
        intent.setData(Uri.parse(
            "https://play.google.com/d?id=" + PLAY_PACKAGE
                + "&referrer=" + Uri.encode(PLAY_REFERRER)
        ));
        intent.putExtra("overlay", true);
        intent.putExtra("callerId", getPackageName());

        if (intent.resolveActivity(getPackageManager()) != null) {
            startActivityForResult(intent, 0);
            return;
        }
        openPlayListing();
    }

    private void openPlayListing() {
        Intent intent = new Intent(Intent.ACTION_VIEW);
        intent.setData(Uri.parse(
            "https://play.google.com/store/apps/details?id=" + PLAY_PACKAGE
                + "&referrer=" + Uri.encode(PLAY_REFERRER)
        ));
        try {
            startActivity(intent);
        } catch (Exception ignored) {}
    }

    public class PlayInlineBridge {
        @JavascriptInterface
        public void openOfficialApp() {
            runOnUiThread(MainActivity.this::openPlayInlineInstall);
        }
    }
}

