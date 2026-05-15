#!/usr/bin/env bash
# Headless Android APK build via Capacitor.
#
# Designed for remote containers: reads .env.android (or prompts), checks
# the toolchain, wraps the Vite build in a Capacitor Android project,
# patches in RECORD_AUDIO permission, and runs gradle to produce an APK.
#
# Outputs:
#   dist-android/<app>-<version>-debug.apk      (no keystore configured)
#   dist-android/<app>-<version>-release.apk    (keystore configured)
#
# Usage:
#   cp .env.android.example .env.android  # then edit
#   bash scripts/build-android-apk.sh
#
# Container-friendly: see Dockerfile.android for a preinstalled image.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# ---------------------------------------------------------------- env loading
if [[ -f .env.android ]]; then
  echo "→ Loading .env.android"
  set -a
  # shellcheck disable=SC1091
  source .env.android
  set +a
else
  echo "→ No .env.android found, will prompt for required values"
  echo "  (copy .env.android.example to skip prompts next time)"
fi

prompt_if_empty() {
  local var="$1" label="$2" default="${3:-}"
  local val="${!var:-}"
  if [[ -z "$val" ]]; then
    if [[ -n "$default" ]]; then
      read -r -p "$label [$default]: " val
      val="${val:-$default}"
    else
      read -r -p "$label: " val
    fi
    eval "$var=\"\$val\""
  fi
}

prompt_if_empty APP_ID      "App ID (reverse-DNS, e.g. co.example.app)" "co.fruitcast.voicetally"
prompt_if_empty APP_NAME    "App display name" "Voice Tally"
prompt_if_empty APP_VERSION "Version (semver)" "1.0.0"

SIGN_RELEASE=0
if [[ -n "${KEYSTORE_PATH:-}" ]]; then
  SIGN_RELEASE=1
  if [[ ! -f "$KEYSTORE_PATH" ]]; then
    echo "✗ KEYSTORE_PATH set but file not found: $KEYSTORE_PATH" >&2
    exit 1
  fi
  : "${KEYSTORE_PASSWORD:?KEYSTORE_PASSWORD required when KEYSTORE_PATH is set}"
  : "${KEY_ALIAS:?KEY_ALIAS required when KEYSTORE_PATH is set}"
  : "${KEY_PASSWORD:?KEY_PASSWORD required when KEYSTORE_PATH is set}"
fi

# ----------------------------------------------------------------- toolchain
need() { command -v "$1" >/dev/null 2>&1 || { echo "✗ Missing: $1" >&2; return 1; }; }
need node
need npm
need javac || { echo "  Install: apt-get install -y openjdk-17-jdk"; exit 1; }

if [[ -z "${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}" ]]; then
  echo "✗ ANDROID_HOME not set. Install Android SDK cmdline-tools + platforms;android-34 + build-tools;34.0.0" >&2
  echo "  Or use the prebuilt container: Dockerfile.android" >&2
  exit 1
fi
export ANDROID_HOME="${ANDROID_HOME:-$ANDROID_SDK_ROOT}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"

JAVA_MAJOR=$(javac -version 2>&1 | awk '{print $2}' | cut -d. -f1)
if [[ "$JAVA_MAJOR" -lt 17 ]]; then
  echo "✗ JDK 17+ required (found $JAVA_MAJOR)" >&2
  exit 1
fi

# --------------------------------------------------- install Capacitor (local)
# --no-save keeps these out of package.json; they're only needed for APK builds.
if [[ ! -d node_modules/@capacitor/cli ]]; then
  echo "→ Installing Capacitor (local, --no-save)"
  npm install --no-save --no-audit --no-fund \
    @capacitor/cli @capacitor/core @capacitor/android
fi

# ---------------------------------------------------------- build the web app
echo "→ Building web bundle (vite)"
npm run build

# ------------------------------------------------------- capacitor.config.json
cat > capacitor.config.json <<EOF
{
  "appId": "${APP_ID}",
  "appName": "${APP_NAME}",
  "webDir": "dist",
  "android": { "allowMixedContent": true },
  "server": { "androidScheme": "https" }
}
EOF

# ----------------------------------------------------- android platform setup
if [[ ! -d android ]]; then
  echo "→ Adding Android platform (first run)"
  npx --yes cap add android
fi

# Compute the package's filesystem path (co.example.app -> co/example/app).
# Used for writing Kotlin sources under android/app/src/main/java/.
PKG_PATH=$(echo "$APP_ID" | tr '.' '/')

# Patch AndroidManifest: permissions + foreground-service declaration.
# Idempotent: keyed off RECORD_AUDIO presence. The foreground service +
# microphone-typed FOREGROUND_SERVICE permission keep the mic alive when the
# screen is off / app backgrounded (Android 14+ enforces typed perms).
MANIFEST=android/app/src/main/AndroidManifest.xml
if [[ -f "$MANIFEST" ]] && ! grep -q "android.permission.RECORD_AUDIO" "$MANIFEST"; then
  echo "→ Injecting permissions + MicForegroundService into AndroidManifest"
  awk '
    /<manifest [^>]*>/ && !perms_done {
      print
      print "    <uses-permission android:name=\"android.permission.RECORD_AUDIO\" />"
      print "    <uses-permission android:name=\"android.permission.INTERNET\" />"
      print "    <uses-permission android:name=\"android.permission.FOREGROUND_SERVICE\" />"
      print "    <uses-permission android:name=\"android.permission.FOREGROUND_SERVICE_MICROPHONE\" />"
      print "    <uses-permission android:name=\"android.permission.POST_NOTIFICATIONS\" />"
      print "    <uses-permission android:name=\"android.permission.WAKE_LOCK\" />"
      perms_done = 1
      next
    }
    /<\/application>/ && !svc_done {
      print "        <service"
      print "            android:name=\".MicForegroundService\""
      print "            android:exported=\"false\""
      print "            android:foregroundServiceType=\"microphone\" />"
      svc_done = 1
    }
    { print }
  ' "$MANIFEST" > "$MANIFEST.tmp" && mv "$MANIFEST.tmp" "$MANIFEST"
fi

# ------------------------------------------- foreground-service Kotlin sources
# Write a Service + Capacitor plugin into the app's java/ tree. The plugin
# exposes start()/stop() to JS via window.Capacitor.Plugins.MicForeground.
JAVA_DIR="android/app/src/main/java/$PKG_PATH"
if [[ -d "$JAVA_DIR" && ! -f "$JAVA_DIR/MicForegroundService.kt" ]]; then
  echo "→ Writing MicForegroundService.kt + MicForegroundPlugin.kt"

  cat > "$JAVA_DIR/MicForegroundService.kt" <<KOTLIN
package $APP_ID

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder

// Foreground service that keeps the mic alive while the app is in the
// background or the screen is off. On Android 14+ FOREGROUND_SERVICE_TYPE_MICROPHONE
// is required for the OS to let our MediaRecorder / AudioRecord stream keep
// running outside the foreground.
class MicForegroundService : Service() {
    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val channelId = "voice_tally_mic"
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val mgr = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            if (mgr.getNotificationChannel(channelId) == null) {
                val ch = NotificationChannel(
                    channelId,
                    "Voice Tally Listening",
                    NotificationManager.IMPORTANCE_LOW,
                )
                ch.description = "Shown while the mic is active in the background"
                mgr.createNotificationChannel(ch)
            }
        }
        val notif: Notification = Notification.Builder(this, channelId)
            .setContentTitle("Voice Tally")
            .setContentText("Listening for tally words")
            .setSmallIcon(applicationInfo.icon)
            .setOngoing(true)
            .build()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(1, notif, ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE)
        } else {
            startForeground(1, notif)
        }
        return START_STICKY
    }

    override fun onDestroy() {
        super.onDestroy()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            stopForeground(STOP_FOREGROUND_REMOVE)
        } else {
            @Suppress("DEPRECATION")
            stopForeground(true)
        }
    }
}
KOTLIN

  cat > "$JAVA_DIR/MicForegroundPlugin.kt" <<KOTLIN
package $APP_ID

import android.content.Intent
import android.os.Build
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

// JS bridge to MicForegroundService.
//   Capacitor.Plugins.MicForeground.start()
//   Capacitor.Plugins.MicForeground.stop()
@CapacitorPlugin(name = "MicForeground")
class MicForegroundPlugin : Plugin() {
    @PluginMethod
    fun start(call: PluginCall) {
        val intent = Intent(context, MicForegroundService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(intent)
        } else {
            context.startService(intent)
        }
        call.resolve()
    }

    @PluginMethod
    fun stop(call: PluginCall) {
        context.stopService(Intent(context, MicForegroundService::class.java))
        call.resolve()
    }
}
KOTLIN

  # Register the plugin in MainActivity. Default Capacitor MainActivity has
  # an empty body, so we replace it with one that registers our plugin
  # before super.onCreate (required by Capacitor's plugin loader).
  MAIN_ACTIVITY="$JAVA_DIR/MainActivity.kt"
  if [[ -f "$MAIN_ACTIVITY" ]] && ! grep -q "MicForegroundPlugin" "$MAIN_ACTIVITY"; then
    echo "→ Registering MicForegroundPlugin in MainActivity.kt"
    cat > "$MAIN_ACTIVITY" <<KOTLIN
package $APP_ID

import android.os.Bundle
import com.getcapacitor.BridgeActivity

class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        registerPlugin(MicForegroundPlugin::class.java)
        super.onCreate(savedInstanceState)
    }
}
KOTLIN
  fi
fi

# Set versionName / versionCode in build.gradle
GRADLE=android/app/build.gradle
if [[ -f "$GRADLE" ]]; then
  echo "→ Setting versionName=$APP_VERSION in $GRADLE"
  sed -i -E "s/versionName \"[^\"]*\"/versionName \"$APP_VERSION\"/" "$GRADLE"
fi

echo "→ Syncing web assets into android/"
npx cap sync android

# ------------------------------------------------------------------ gradle
cd android
chmod +x gradlew

if [[ $SIGN_RELEASE -eq 1 ]]; then
  echo "→ Building signed release APK"
  ./gradlew --no-daemon assembleRelease \
    -Pandroid.injected.signing.store.file="$KEYSTORE_PATH" \
    -Pandroid.injected.signing.store.password="$KEYSTORE_PASSWORD" \
    -Pandroid.injected.signing.key.alias="$KEY_ALIAS" \
    -Pandroid.injected.signing.key.password="$KEY_PASSWORD"
  APK_SRC=app/build/outputs/apk/release/app-release.apk
  SUFFIX=release
else
  echo "→ Building unsigned debug APK (set KEYSTORE_PATH for signed release)"
  ./gradlew --no-daemon assembleDebug
  APK_SRC=app/build/outputs/apk/debug/app-debug.apk
  SUFFIX=debug
fi

cd "$ROOT"
mkdir -p dist-android
SAFE_APP=$(echo "$APP_NAME" | tr ' ' '-' | tr '[:upper:]' '[:lower:]')
OUT="dist-android/${SAFE_APP}-${APP_VERSION}-${SUFFIX}.apk"
cp "android/$APK_SRC" "$OUT"

echo ""
echo "✓ APK built: $OUT"
echo "  Size: $(du -h "$OUT" | cut -f1)"
echo ""
echo "Install on device:"
echo "  adb install -r \"$OUT\""
