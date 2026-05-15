import React from 'react';

// Tiny fixed-position version label. Sits in the bottom-right corner,
// styled to fade into the background unless hovered. Build-time injected
// via vite.config.ts (`__APP_VERSION__` = pkg.version + git short SHA).
const VersionBadge: React.FC = () => (
  <div
    className="fixed bottom-2 right-2 z-50 px-2 py-0.5 rounded-md text-[10px] font-mono text-muted-foreground/50 hover:text-muted-foreground bg-background/40 backdrop-blur-sm border border-border/30 select-none pointer-events-auto"
    title={`Built ${__BUILD_TIME__}`}
  >
    v{__APP_VERSION__}
  </div>
);

export default VersionBadge;
