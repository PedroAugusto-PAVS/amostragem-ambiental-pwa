package br.com.pavs.hydrotrack;

import android.os.Bundle;

import androidx.activity.OnBackPressedCallback;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                navegarParaTelaAnterior();
            }
        });
    }

    private void navegarParaTelaAnterior() {
        if (getBridge() != null && getBridge().getWebView().canGoBack()) {
            getBridge().getWebView().goBack();
            return;
        }

        getBridge().getWebView().evaluateJavascript(
            "window.location.replace('dashboard.html');",
            null
        );
    }
}
