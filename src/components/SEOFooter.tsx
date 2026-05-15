// Internal-links footer. Gives crawlers a tight cluster of links to each
// SEO landing variant so they're discoverable from any page (without a
// sitemap fetch). Also a small human-readable "also known as" section that
// reinforces the topical cluster for ranking.
//
// Visually low-key — small text, muted colors — so it doesn't compete with
// the app UI.

import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { seoConfig } from '../seo/seoConfig';

const SEOFooter: React.FC = () => {
  const { pathname } = useLocation();
  const entries = Object.entries(seoConfig).filter(([path]) => path !== pathname);

  return (
    <footer className="border-t border-border/40 mt-8 pt-6 pb-10 text-center text-xs text-muted-foreground/80 space-y-3">
      <p className="font-medium text-muted-foreground">
        Also known as: voice counter · voice activated counter · voice counter online · voice counter offline ·
        counter with voice · count by voice · voice count · voice counter app · tally app · tally counter · word counter
      </p>
      <nav className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
        {entries.map(([path, cfg]) => (
          <Link
            key={path}
            to={path}
            className="hover:text-primary hover:underline"
            title={cfg.title}
          >
            {cfg.h1}
          </Link>
        ))}
      </nav>
      <p className="opacity-60">
        Free, hands-free, runs offline. Built for public speaking, debate
        practice, workouts, inventory, and any counting task.
      </p>
    </footer>
  );
};

export default SEOFooter;
