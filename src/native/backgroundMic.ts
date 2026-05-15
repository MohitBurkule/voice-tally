// Bridge to the Android MicForegroundService (Capacitor plugin: MicForeground).
//
// In a browser the Capacitor object is absent, so these calls are no-ops and
// the app falls back to the Web Wake Lock API (see src/hooks/useWakeLock.ts)
// for screen-on-while-listening, which is the best the browser can do.
//
// Inside the APK the plugin starts a typed foreground service
// (FOREGROUND_SERVICE_TYPE_MICROPHONE) that keeps the mic alive across
// backgrounding + screen lock.

interface MicForegroundPlugin {
  start: () => Promise<void>;
  stop: () => Promise<void>;
}

function plugin(): MicForegroundPlugin | null {
  const w = window as unknown as {
    Capacitor?: { Plugins?: { MicForeground?: MicForegroundPlugin } };
  };
  return w.Capacitor?.Plugins?.MicForeground ?? null;
}

export function isNativeAndroid(): boolean {
  return plugin() !== null;
}

export async function startBackgroundMic(): Promise<void> {
  const p = plugin();
  if (!p) return;
  try {
    await p.start();
  } catch {
    // Service start can fail if the user revoked notification permission on
    // Android 13+; not fatal — listening still works in the foreground.
  }
}

export async function stopBackgroundMic(): Promise<void> {
  const p = plugin();
  if (!p) return;
  try {
    await p.stop();
  } catch {
    /* ignore */
  }
}
