import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Bug, Download, Trash2, Volume2 } from 'lucide-react';
import { useTally } from '../context/TallyContext';
import type { DebugEvent } from '../hooks/useAdvancedSpeechRecognition';

interface DebugPanelProps {
  confidence: number;
  debugEvents: DebugEvent[];
  clearDebugEvents: () => void;
  sessionHasAudio: boolean;
  sessionRecordingSize: number;
  downloadSessionAudio: () => void;
  clearSessionAudio: () => void;
}

const kindStyles: Record<DebugEvent['kind'], { color: string; label: string }> = {
  'start':              { color: 'text-green-500',  label: 'START' },
  'result-final':       { color: 'text-blue-500',   label: 'FINAL' },
  'result-interim':     { color: 'text-cyan-500',   label: 'INTERIM' },
  'match':              { color: 'text-emerald-500',label: 'MATCH' },
  'reject-confidence':  { color: 'text-amber-500',  label: 'LOW-CONF' },
  'reject-no-match':    { color: 'text-muted-foreground', label: 'NO-MATCH' },
  'error':              { color: 'text-red-500',    label: 'ERROR' },
  'end':                { color: 'text-orange-500', label: 'END' },
  'restart':            { color: 'text-purple-500', label: 'RESTART' },
  'watchdog':           { color: 'text-pink-500',   label: 'WATCHDOG' },
};

const formatTime = (ts: number) => {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}.${d.getMilliseconds().toString().padStart(3, '0')}`;
};

const formatBytes = (n: number) => {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
};

const DebugPanel: React.FC<DebugPanelProps> = ({
  confidence,
  debugEvents,
  clearDebugEvents,
  sessionHasAudio,
  sessionRecordingSize,
  downloadSessionAudio,
  clearSessionAudio,
}) => {
  const [open, setOpen] = useState(false);
  const { state } = useTally();
  const threshold = state.settings.confidenceThreshold;
  const transcript = state.currentTranscript;

  const reversed = [...debugEvents].reverse();

  return (
    <motion.div
      className="bg-card border border-border rounded-2xl overflow-hidden shadow-lg"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center space-x-3">
          <Bug className="h-5 w-5 text-muted-foreground" />
          <span className="font-semibold text-card-foreground">Debug</span>
          <span className="text-xs text-muted-foreground">
            {state.isListening ? 'live' : 'idle'} · conf {confidence.toFixed(2)} / threshold {threshold.toFixed(2)} · {debugEvents.length} events
          </span>
        </div>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="h-5 w-5 text-muted-foreground" />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-6 pb-6 space-y-5 border-t border-border pt-5">
              {/* Live transcript */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-card-foreground">Live transcript</h4>
                  <span className="text-xs text-muted-foreground">{transcript.length} chars</span>
                </div>
                <div className="bg-muted/40 rounded-lg p-3 min-h-[60px] max-h-40 overflow-auto font-mono text-sm break-words">
                  {transcript || <span className="text-muted-foreground italic">(no transcript yet — start listening and speak)</span>}
                </div>
              </div>

              {/* Confidence + threshold */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/40 rounded-lg p-3">
                  <div className="text-xs text-muted-foreground mb-1">Latest confidence</div>
                  <div className="text-lg font-bold text-card-foreground">{confidence.toFixed(3)}</div>
                </div>
                <div className="bg-muted/40 rounded-lg p-3">
                  <div className="text-xs text-muted-foreground mb-1">Threshold (Settings)</div>
                  <div className="text-lg font-bold text-card-foreground">{threshold.toFixed(3)}</div>
                </div>
              </div>

              {threshold > 0 && (
                <div className="text-xs text-amber-600 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                  Tip: confidence threshold above 0 silently drops detections that browsers report below it. If words aren't counting, lower this to 0 in Settings.
                </div>
              )}

              {/* Target words */}
              <div>
                <h4 className="text-sm font-semibold text-card-foreground mb-2">Listening for</h4>
                <div className="flex flex-wrap gap-2">
                  {state.targetWords.length === 0 && (
                    <span className="text-xs text-muted-foreground italic">no target words configured</span>
                  )}
                  {state.targetWords.map(w => (
                    <span
                      key={w.id}
                      className="px-2 py-1 rounded-md bg-muted/60 text-xs font-mono"
                      title={[w.word, ...w.homophones].join(' | ')}
                    >
                      {w.word}
                      {w.homophones.length > 0 && (
                        <span className="text-muted-foreground"> +{w.homophones.length}</span>
                      )}
                    </span>
                  ))}
                </div>
              </div>

              {/* Session audio */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-card-foreground flex items-center space-x-2">
                    <Volume2 className="h-4 w-4" />
                    <span>Session recording</span>
                  </h4>
                  <span className="text-xs text-muted-foreground">
                    {sessionHasAudio ? formatBytes(sessionRecordingSize) : 'not recording yet'}
                  </span>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={downloadSessionAudio}
                    disabled={!sessionHasAudio}
                    className="flex-1 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
                  >
                    <Download className="h-4 w-4" />
                    <span>Download audio</span>
                  </button>
                  <button
                    onClick={clearSessionAudio}
                    disabled={!sessionHasAudio}
                    className="px-3 py-2 bg-muted text-muted-foreground rounded-lg text-sm font-medium hover:bg-muted/80 disabled:opacity-40 transition-colors"
                    title="Clear buffered audio"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Event log */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-card-foreground">Event log</h4>
                  <button
                    onClick={clearDebugEvents}
                    className="text-xs text-muted-foreground hover:text-card-foreground transition-colors"
                  >
                    Clear
                  </button>
                </div>
                <div className="bg-muted/40 rounded-lg max-h-72 overflow-auto font-mono text-xs">
                  {reversed.length === 0 ? (
                    <div className="p-3 text-muted-foreground italic">
                      No events yet. Click "Start Listening" and speak.
                    </div>
                  ) : (
                    <ul className="divide-y divide-border/50">
                      {reversed.map(ev => {
                        const s = kindStyles[ev.kind];
                        return (
                          <li key={ev.id} className="px-3 py-1.5 flex items-start space-x-3">
                            <span className="text-muted-foreground shrink-0">{formatTime(ev.at)}</span>
                            <span className={`${s.color} font-bold shrink-0 w-20`}>{s.label}</span>
                            <span className="text-card-foreground break-all flex-1">
                              {ev.detail}
                              {typeof ev.confidence === 'number' && (
                                <span className="text-muted-foreground ml-2">
                                  [{ev.confidence.toFixed(2)}]
                                </span>
                              )}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default DebugPanel;
