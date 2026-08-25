package br.com.pavs.hydrotrack;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (getBridge() != null && getBridge().getWebView().canGoBack()) {
            getBridge().getWebView().goBack();
            return;
        }

        super.onBackPressed();
    }
}
