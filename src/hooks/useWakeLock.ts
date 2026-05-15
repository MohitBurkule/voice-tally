// Holds a screen Wake Lock while `active` is true. Stops the device from
// sleeping/locking — which is the only reliable way to keep mobile
// browsers from suspending AudioContext + MediaStreamTrack while the user
// has the listening session running.
//
// Wake Lock is a soft guarantee: the OS can still revoke it on low battery
// or thermal events. If the page goes hidden (tab switch on phone) the lock
// is released by the browser; we re-acquire it when the page becomes
// visible again (handled by `visibilitychange`).
//
// Limitations the user should know about:
//   - This only keeps the *screen* on. It does NOT help if the user manually
//     locks the phone — getUserMedia is killed regardless on every mobile
//     browser.
//   - Truly background-capable audio capture requires a native foreground
//     service (Android APK route via Capacitor).

import { useEffect, useRef } from 'react';

interface WakeLockSentinel {
  released: boolean;
  release: () => Promise<void>;
  addEventListener: (type: 'release', listener: () => void) => void;
}

export function useWakeLock(active: boolean): void {
  const lockRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    const wl = (navigator as any).wakeLock;
    if (!wl?.request) return;

    let cancelled = false;

    const acquire = async () => {
      try {
        const sentinel: WakeLockSentinel = await wl.request('screen');
        if (cancelled) {
          sentinel.release().catch(() => {});
          return;
        }
        lockRef.current = sentinel;
        sentinel.addEventListener('release', () => {
          if (lockRef.current === sentinel) lockRef.current = null;
        });
      } catch {
        // Permissions / unsupported / battery-saver — silently no-op.
      }
    };

    const release = () => {
      const cur = lockRef.current;
      lockRef.current = null;
      if (cur && !cur.released) cur.release().catch(() => {});
    };

    if (active) {
      acquire();

      // Re-acquire when the tab becomes visible again. The browser
      // auto-releases the lock when the page is hidden.
      const onVisibility = () => {
        if (document.visibilityState === 'visible' && !lockRef.current) {
          acquire();
        }
      };
      document.addEventListener('visibilitychange', onVisibility);
      return () => {
        cancelled = true;
        document.removeEventListener('visibilitychange', onVisibility);
        release();
      };
    }

    return () => {
      cancelled = true;
      release();
    };
  }, [active]);
}
