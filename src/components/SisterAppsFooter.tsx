// Backlinks to sibling apps under the app.scot domain. Surfaces the rest of
// the portfolio at the bottom of every page so visitors can hop between
// apps, and gives crawlers a tight cluster of internal/cross-domain links.

import React from 'react';
import { ExternalLink } from 'lucide-react';
import { sisterApps } from '../seo/sisterApps';

const SisterAppsFooter: React.FC = () => (
  <section
    className="border-t border-border/40 mt-6 pt-8 pb-12"
    aria-labelledby="sister-apps-heading"
  >
    <div className="text-center mb-6">
      <h2
        id="sister-apps-heading"
        className="text-lg sm:text-xl font-bold text-foreground"
      >
        More apps from{' '}
        <a
          href="https://app.scot"
          target="_blank"
          rel="noopener"
          className="text-primary hover:underline"
        >
          app.scot
        </a>
      </h2>
      <p className="text-xs sm:text-sm text-muted-foreground mt-1">
        Free, browser-based tools. Most run offline.
      </p>
    </div>

    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-w-5xl mx-auto">
      {sisterApps.map((app) => (
        <a
          key={app.url}
          href={app.url}
          target="_blank"
          rel="noopener"
          className="group bg-card/50 hover:bg-card border border-border/50 hover:border-border rounded-xl p-3 sm:p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="font-semibold text-sm sm:text-base text-card-foreground group-hover:text-primary transition-colors">
              {app.name}
            </span>
            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/60 group-hover:text-primary transition-colors" />
          </div>
          <p className="text-xs text-muted-foreground leading-snug">
            {app.blurb}
          </p>
        </a>
      ))}
    </div>
  </section>
);

export default SisterAppsFooter;
