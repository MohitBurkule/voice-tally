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

# Patch AndroidManifest with RECORD_AUDIO permission (idempotent)
MANIFEST=android/app/src/main/AndroidManifest.xml
if [[ -f "$MANIFEST" ]] && ! grep -q "android.permission.RECORD_AUDIO" "$MANIFEST"; then
  echo "→ Injecting RECORD_AUDIO permission into AndroidManifest"
  # Insert <uses-permission .../> right after the <manifest ...> opening tag.
  awk '
    /<manifest [^>]*>/ && !done {
      print
      print "    <uses-permission android:name=\"android.permission.RECORD_AUDIO\" />"
      print "    <uses-permission android:name=\"android.permission.INTERNET\" />"
      done = 1
      next
    }
    { print }
  ' "$MANIFEST" > "$MANIFEST.tmp" && mv "$MANIFEST.tmp" "$MANIFEST"
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
