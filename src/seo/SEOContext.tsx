// Lightweight SEO context — lets pages (TallyPage) read the SEO config for
// the route they're rendered under, so the visible H1 / subtitle can match
// the search query for that route variant.
//
// This is intentionally NOT react-helmet — saves a dep, and we only need
// document.title + a handful of meta tags, which `useDocumentSEO` handles
// directly via the DOM.

import React, { createContext, useContext, useEffect } from 'react';
import { fallbackSEO, seoConfig, type SEOConfig } from './seoConfig';

const SEOContext = createContext<SEOConfig>(fallbackSEO);

export const useSEO = (): SEOConfig => useContext(SEOContext);

interface SEOProviderProps {
  path: string;
  children: React.ReactNode;
}

export const SEOProvider: React.FC<SEOProviderProps> = ({ path, children }) => {
  const cfg = seoConfig[path] ?? fallbackSEO;
  useDocumentSEO(cfg);
  return <SEOContext.Provider value={cfg}>{children}</SEOContext.Provider>;
};

// Sets <title>, key meta tags, canonical, and an Application JSON-LD blob
// based on the current SEOConfig. Cleans up so SPA navigation doesn't leave
// stale tags around.
function useDocumentSEO(cfg: SEOConfig) {
  useEffect(() => {
    document.title = cfg.title;

    setMeta('name', 'description', cfg.description);
    setMeta('name', 'keywords', cfg.keywords);
    setMeta('property', 'og:title', cfg.title);
    setMeta('property', 'og:description', cfg.description);
    setMeta('property', 'og:url', cfg.canonical);
    setMeta('property', 'og:type', 'website');
    setMeta('name', 'twitter:card', 'summary_large_image');
    setMeta('name', 'twitter:title', cfg.title);
    setMeta('name', 'twitter:description', cfg.description);

    setLinkRel('canonical', cfg.canonical);

    setJsonLd('seo-jsonld-webapp', {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: cfg.h1,
      alternateName: 'Voice Tally',
      url: cfg.canonical,
      description: cfg.description,
      applicationCategory: 'UtilityApplication',
      operatingSystem: 'Web, Android, iOS',
      browserRequirements: 'Requires JavaScript and a modern browser',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      featureList: [
        'Real-time voice recognition',
        'Multi-word simultaneous counting',
        'Offline on-device ASR (Vosk, Whisper, Moonshine)',
        'Undo/redo with full history',
        'Custom homophones per word',
        'Free, no signup',
      ],
    });
  }, [cfg]);
}

function setMeta(attr: 'name' | 'property', key: string, value: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', value);
}

function setLinkRel(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

function setJsonLd(id: string, data: unknown) {
  let el = document.getElementById(id) as HTMLScriptElement | null;
  if (!el) {
    el = document.createElement('script');
    el.id = id;
    el.type = 'application/ld+json';
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
}
