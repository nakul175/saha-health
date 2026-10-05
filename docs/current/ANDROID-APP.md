# Android ASHA demonstrator

5 October 2026 (IST). Synthetic data only; no production or clinical acceptance.

`android/` is a real Android application project using Google's Android Browser Helper 2.7.3. It opens the shared `/app` journey at the fixed HTTPS staging origin `https://saha-staging.nakul17.workers.dev`. The browser owns cookies, Cloudflare Access sign-in, web history, permissions and the encrypted field notebook. The APK injects no identity and contains no service credentials, patient records or native patient database.

Until the signing certificate is associated with the host through Digital Asset Links, the site opens as a Custom Tab with browser origin visible. Other origins, including Access login, are not declared trusted. There is no WebView fallback or disabled verification. The exported launcher ignores incoming intent URLs and payloads; it always opens a fixed destination. Android Back in web content is handled by the browser; Back on the native fallback closes the activity. These behaviors still require a device test.

## Offline boundary

Without a validated connection the application renders a native connection screen. Retry opens `/app` when connectivity returns. “Open previously prepared notebook” opens `/field/index.html` in the browser so its existing static service worker and encrypted IndexedDB vault can be used if prepared earlier in that same browser. A first offline launch cannot create an authenticated workspace or recover a notebook from a different browser. The native screen stores no data. Network validation does not guarantee that the staging host is reachable; a later host failure remains a browser error.

Existing field grants, draft/registration capacity, media size limits, account checks, exact idempotent retries and reconciliation remain unchanged. Sync saves an unconfirmed visit; confirmation requires the existing online patient check. The full `/app` interface does not gain durable offline storage merely because it is launched from an APK. There is no Keystore-backed patient storage, native background sync or proven Android camera/voice reliability in this batch.

## Build and install

Requirements: JDK 17, Android SDK platform 36 and build-tools 35.0.0, SDK licences accepted by an authorised developer. Dependencies download from official Gradle, Google Maven and Maven Central repositories. Gradle 8.11.1 is pinned with its official distribution SHA-256 checksum. No SDK or dependency files belong in Git.

```sh
cd android
./gradlew --no-daemon assembleDebug lintDebug
# Output: app/build/outputs/apk/debug/app-debug.apk
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

Use `ANDROID_HOME`/`ANDROID_SDK_ROOT` or an ignored `android/local.properties` to locate the SDK. `JAVA_HOME` selects JDK 17. To keep demonstration tooling entirely local, set `GRADLE_USER_HOME` and `ANDROID_USER_HOME` to task-specific directories. The debug signing key is generated inside ignored `app/build/`; cleaning that directory creates a different certificate. Preserve the key securely for repeat demonstration installs or uninstall the old build before changing signing keys. Release builds require sponsor-controlled signing and are unsigned by default; no release key is checked in.

## Certificate association

Export the **actual APK signing certificate**, not a private key:

```sh
keytool -exportcert -keystore android/app/build/debug.keystore \
  -alias androiddebugkey -storepass android -file /tmp/saha-demo.cer
node scripts/android-assetlinks.mjs /tmp/saha-demo.cer > /tmp/saha-assetlinks.json
```

The generator parses a genuine X.509 certificate and calculates its SHA-256 fingerprint. It refuses malformed input and private keys. Publish the reviewed output as `https://saha-staging.nakul17.workers.dev/.well-known/assetlinks.json`, with JSON content type, HTTP 200, **no authentication or redirect**. That path is not published automatically and no placeholder fingerprint is present in source. Cloudflare Access policy must allow only this public association file anonymously while keeping application/API access protected. The sponsor controls that policy. A release/Play-signed build needs the corresponding release/Play app-signing certificate, rather than the debug or upload certificate.

## Verification and outstanding checks

`node tests/android-app-contract.mjs` tests real temporary certificates in PEM/DER form and refuses private keys/fake fingerprints. It also checks the launch/security configuration and browser icon dimensions. Its output is `tests/evidence/android-app/contract-result.json`. These checks do not establish device behavior or acceptance. The isolated JDK 17/Gradle 8.11.1 configuration check (`gradle tasks`) passed; 20 contract checks, XML parsing and test catalogue checks passed on 5 October 2026. SDK licence acceptance remains pending, so APK assembly and Android lint have not run. `tests/evidence/android-app/configuration-result.json` records this boundary. No installation or device result is claimed.

Before demonstrating a real phone, check installation; first online/first offline launch; Access OTP/login origin visibility; `/app` navigation and Back; browser change; prepared notebook reopen offline; app background locking; expired/revoked grants; uncertain sync retry; media limits; permission refusal; successful host certificate verification; and unverified certificate visible fallback. Publish/merge decisions remain sponsor-controlled.

Primary references: [Android Browser Helper](https://github.com/GoogleChrome/android-browser-helper), [TWA integration](https://developer.chrome.com/docs/android/trusted-web-activity/integration-guide), [native first-offline fallback](https://developer.chrome.com/docs/android/trusted-web-activity/offline-first), [Digital Asset Links](https://developers.google.com/digital-asset-links/v1/getting-started), [AGP 8.10 compatibility](https://developer.android.com/build/releases/agp-8-10-0-release-notes).
