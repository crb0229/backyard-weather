package io.github.crb0229.backyardweather;

import android.app.Activity;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

// Full-screen window onto the live TV page. The page itself does all the work, so page updates
// reach the TV without reinstalling the app.
public class MainActivity extends Activity {
    private static final String PAGE = "https://crb0229.github.io/backyard-weather/tv.html";
    private WebView web;

    @Override
    protected void onCreate(Bundle saved) {
        super.onCreate(saved);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);   // no screensaver while it's open

        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);                  // remembers music on/off and station
        s.setMediaPlaybackRequiresUserGesture(false);  // music can resume on its own
        web.setBackgroundColor(0xFF0F151B);
        web.setWebViewClient(new WebViewClient() {
            @Override
            public void onReceivedError(WebView v, WebResourceRequest r, WebResourceError e) {
                if (r.isForMainFrame()) v.postDelayed(() -> v.loadUrl(PAGE), 30000);   // no internet yet: try again in 30 s
            }
        });
        setContentView(web);
        web.loadUrl(PAGE);
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
    }

    @Override
    protected void onStop() {
        super.onStop();
        finish();   // leaving the app (Home button) closes it, so the music stops; reopening starts fresh
    }
}
