# Market Calm Check Android APK

This is the real Android build path for The Dispatch Market Calm Check.

It is not a hand-made APK. GitHub Actions builds it with the official Android Gradle plugin.

## Build locally

```bash
gradle assembleDebug
```

APK output:

```text
app/build/outputs/apk/debug/app-debug.apk
```

## Backend connection

The APK shell works offline with manual/recent VIX and VIXEQ readings.

Live readings and analyst chat expect a deployed backend at:

```text
https://market-calm.thedispatch.uk
```

Inside the app you can later change this through Android WebView localStorage key:

```js
localStorage.marketCalmApiBase = "https://your-backend-domain.com"
```

## Source basis

The mobile product is based on the original `market-calm-check.jsx` logic: VIX, VIXEQ, spread, regime label, beginner explanation, manual controls, live reading endpoint, and analyst endpoint.
