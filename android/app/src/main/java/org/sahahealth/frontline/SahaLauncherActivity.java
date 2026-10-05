package org.sahahealth.frontline;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import com.google.androidbrowserhelper.trusted.LauncherActivity;

/** Browser-owned auth and vault: the APK does not copy cookies, keys or clinical data. */
public final class SahaLauncherActivity extends LauncherActivity {
    private static final String ORIGIN = "https://saha-staging.nakul17.workers.dev";
    private Uri destination = Uri.parse(ORIGIN + "/app");
    private boolean launching;

    @Override protected boolean shouldLaunchImmediately() { return false; }

    // Never take a launch URL, share payload or token from an exported Intent.
    @Override protected Uri getUrlForIntent(Intent intent) { return null; }
    @Override protected Uri getLaunchingUrl() { return destination; }

    @Override protected void onCreate(Bundle savedInstanceState) {
        // Preserve only task placement; explicit callers cannot inject share/file/browser extras.
        Intent clean = new Intent(this, SahaLauncherActivity.class);
        clean.setAction(Intent.ACTION_MAIN);
        clean.setFlags(getIntent().getFlags() & Intent.FLAG_ACTIVITY_NEW_TASK);
        setIntent(clean);
        super.onCreate(savedInstanceState);
        if (isFinishing()) return;
        if (connected()) open("/app"); else showOffline();
    }

    private boolean connected() {
        ConnectivityManager manager = (ConnectivityManager) getSystemService(CONNECTIVITY_SERVICE);
        if (manager == null) return false;
        Network network = manager.getActiveNetwork();
        NetworkCapabilities capabilities = manager.getNetworkCapabilities(network);
        return capabilities != null
            && capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            && capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED);
    }

    private void open(String path) {
        if (launching || isFinishing()) return;
        destination = Uri.parse(ORIGIN + path);
        launching = true;
        try { launchTwa(); }
        catch (ActivityNotFoundException | IllegalStateException failure) {
            launching = false;
            showOffline();
        }
    }

    private void showOffline() {
        LinearLayout content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        int padding = (int) (24 * getResources().getDisplayMetrics().density);
        content.setPadding(padding, padding * 2, padding, padding);
        content.setBackgroundColor(getColor(R.color.saha_background));
        content.setFitsSystemWindows(true);
        TextView title = new TextView(this);
        title.setText(R.string.offline_title);
        title.setTextSize(28);
        content.addView(title);
        TextView help = new TextView(this);
        help.setText(R.string.offline_help);
        help.setTextSize(17);
        help.setPadding(0, padding, 0, padding);
        content.addView(help);
        button(content, R.string.retry, view -> {
            if (connected()) open("/app"); else showOffline();
        });
        // Browser's existing service worker can open only a previously prepared notebook.
        button(content, R.string.notebook, view -> open("/field/index.html"));
        button(content, R.string.close, view -> finish());
        setContentView(content);
    }

    private void button(LinearLayout parent, int label, View.OnClickListener action) {
        Button button = new Button(this);
        button.setText(label);
        button.setOnClickListener(action);
        parent.addView(button);
    }
    // Web history and Back belong to the browser. The native fallback uses standard Activity Back.
}
