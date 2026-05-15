import React, { useState } from 'react';
import { Download, Check, Loader2 } from 'lucide-react';
import { useSpeechEngine } from '../hooks/engines/useSpeechEngine';

// Triggers prefetch of the active engine's model weights. Once downloaded,
// the service worker's runtime cache holds them so the app can run offline.
// Web Speech engine has no model — button is hidden in that case.
const EngineOfflineButton: React.FC = () => {
  const { prefetchModel, modelCached, modelLoadProgress, engineStatus } =
    useSpeechEngine();
  const [downloading, setDownloading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!prefetchModel) {
    return (
      <p className="text-xs text-muted-foreground">
        Web Speech uses the OS speech service — no model to download. To work
        fully offline, switch to Vosk, Whisper, or Moonshine and download its
        model below.
      </p>
    );
  }

  const handleClick = async () => {
    setErr(null);
    setDownloading(true);
    try {
      await prefetchModel();
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setDownloading(false);
    }
  };

  const progressPct =
    typeof modelLoadProgress === 'number'
      ? Math.round(modelLoadProgress * 100)
      : null;

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={downloading || modelCached}
        className="w-full px-4 py-2 rounded-lg font-medium flex items-center justify-center space-x-2 transition-colors bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {modelCached ? (
          <>
            <Check className="h-4 w-4" />
            <span>Model cached — works offline</span>
          </>
        ) : downloading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>
              Downloading model
              {progressPct !== null && progressPct < 100
                ? ` (${progressPct}%)`
                : '…'}
            </span>
          </>
        ) : (
          <>
            <Download className="h-4 w-4" />
            <span>Download model for offline use</span>
          </>
        )}
      </button>
      {engineStatus && engineStatus !== 'idle' && !modelCached && (
        <p className="text-xs text-muted-foreground">Status: {engineStatus}</p>
      )}
      {err && (
        <p className="text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-lg p-2">
          {err}
        </p>
      )}
    </div>
  );
};

export default EngineOfflineButton;
