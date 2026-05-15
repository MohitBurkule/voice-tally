// Per-route SEO config. Each entry maps a URL path to title/H1/description.
// Multiple paths render the same TallyPage but expose different search terms
// to crawlers, so the app can rank for "voice counter", "word counter",
// "tally counter" etc. without duplicate-content penalties (each variant has
// a unique title + H1 + meta description + canonical).

export interface SEOConfig {
  /** Browser tab title + og:title + twitter:title */
  title: string;
  /** Visible <h1> on the page — should match the search query for that route */
  h1: string;
  /** Visible subtitle / lede under the h1 */
  subtitle: string;
  /** <meta name="description"> + og:description + twitter:description */
  description: string;
  /** <meta name="keywords"> — minor signal but harmless */
  keywords: string;
  /** Canonical absolute URL — must point at this exact route */
  canonical: string;
}

const SITE = 'https://voice-tally.app.scot';

// Primary keyword cluster. Order roughly by descending search volume / value
// — search engines weight earlier terms slightly more. Variants and
// near-duplicates included on purpose; the SEO landing routes below pick
// the highest-value single-keyword titles, this list seeds <meta keywords>
// and is mirrored in the description for each route.
const COMMON_KEYWORDS = [
  'voice counter',
  'voice activated counter',
  'voice counter online',
  'voice counter offline',
  'voice counter app',
  'counter voice',
  'counter with voice',
  'count by voice',
  'voice count',
  'voice tally',
  'tally app',
  'tally',
  'tally counter',
  'counter',
  'word counter',
  'speech counter',
  'hands-free counter',
  'speech recognition counter',
  'voice word tracker',
].join(', ');

export const seoConfig: Record<string, SEOConfig> = {
  '/': {
    title: 'Voice Tally — Voice-Activated Word & Tally Counter',
    h1: 'Voice Tally Counter',
    subtitle:
      'Real-time, hands-free voice counter. Tally any word, phrase, or rep with on-device speech recognition.',
    description:
      'Free voice tally counter that counts spoken words, reps, or items in real time. Works offline on mobile and desktop with on-device speech recognition (Vosk, Whisper, Moonshine).',
    keywords: COMMON_KEYWORDS,
    canonical: `${SITE}/`,
  },
  '/voice-counter': {
    title: 'Voice Counter — Free Hands-Free Counter Online',
    h1: 'Voice Counter',
    subtitle:
      'Count anything by voice — reps, words, items, scores. Free, no app install, works offline.',
    description:
      'Free online voice counter. Speak to count reps, words, or items hands-free. Works in the browser on phone and desktop. No signup, no ads, offline-capable.',
    keywords: `voice counter, ${COMMON_KEYWORDS}`,
    canonical: `${SITE}/voice-counter`,
  },
  '/word-counter': {
    title: 'Voice Word Counter — Count Spoken Words in Real Time',
    h1: 'Voice Word Counter',
    subtitle:
      'Count every spoken occurrence of any target word. Useful for public speaking, language learning, and meeting analysis.',
    description:
      'Track how often you (or others) say a target word in real time. Free voice-activated word counter with custom target lists, homophones, and history.',
    keywords: `voice word counter, spoken word counter, ${COMMON_KEYWORDS}`,
    canonical: `${SITE}/word-counter`,
  },
  '/speech-counter': {
    title: 'Speech Counter — Real-Time Speech Recognition Tally',
    h1: 'Speech Counter',
    subtitle:
      'Real-time speech counter for public speaking, debate practice, and meeting analytics. On-device, private.',
    description:
      'Free speech counter that tallies target phrases as you speak. Uses on-device speech recognition — audio never leaves your device. Great for public-speaking coaches.',
    keywords: `speech counter, public speaking counter, ${COMMON_KEYWORDS}`,
    canonical: `${SITE}/speech-counter`,
  },
  '/tally-counter': {
    title: 'Voice Tally Counter — Multi-Item Counter by Voice',
    h1: 'Voice Tally Counter',
    subtitle:
      'Tally multiple items simultaneously, just by speaking. Perfect for inventory, scorekeeping, or counting reps.',
    description:
      'Hands-free tally counter that listens for any number of named items. Custom colors per item, undo/redo, exportable history. Free and offline-capable.',
    keywords: `tally counter, multi-item counter, ${COMMON_KEYWORDS}`,
    canonical: `${SITE}/tally-counter`,
  },
  '/rep-counter': {
    title: 'Voice Rep Counter — Hands-Free Workout Counter',
    h1: 'Voice Rep Counter',
    subtitle:
      'Count reps and sets hands-free. Just say "one, two, three…" or your custom cue word.',
    description:
      'Free voice rep counter for workouts. Tracks reps and sets by listening for spoken cues. Works offline, no microphone data leaves your device.',
    keywords: `voice rep counter, workout counter, voice counting reps, ${COMMON_KEYWORDS}`,
    canonical: `${SITE}/rep-counter`,
  },
  '/any-word-counter': {
    title: 'Any-Word Voice Counter — Count Any Spoken Word Live',
    h1: 'Any-Word Voice Counter',
    subtitle:
      'Add any word, phrase, or filler ("um", "like", "uh"). The counter ticks each time it hears it.',
    description:
      'Count any spoken word in real time. Add custom target words, configure homophones, and watch live counts as you speak. Free and runs entirely in the browser.',
    keywords: `any word voice counter, filler word counter, ${COMMON_KEYWORDS}`,
    canonical: `${SITE}/any-word-counter`,
  },
  '/voice-activated-counter': {
    title: 'Voice-Activated Counter — Free Online & Offline',
    h1: 'Voice-Activated Counter',
    subtitle:
      'A voice-activated counter for any counting task. Works online in the browser and offline as a PWA or Android app.',
    description:
      'Free voice-activated counter. Tally items, reps, or words just by speaking. Works both online and offline, no signup, runs entirely on your device.',
    keywords: `voice activated counter, counter with voice, counter voice, ${COMMON_KEYWORDS}`,
    canonical: `${SITE}/voice-activated-counter`,
  },
  '/voice-counter-online': {
    title: 'Voice Counter Online — Free Browser Counter, No Install',
    h1: 'Voice Counter Online',
    subtitle:
      'Use a voice counter online in any modern browser. No install, no signup. Counts by voice in real time.',
    description:
      'Free online voice counter. Opens in your browser, counts spoken words and reps live. No app install required. Works on phone and desktop.',
    keywords: `voice counter online, online voice counter, browser voice counter, ${COMMON_KEYWORDS}`,
    canonical: `${SITE}/voice-counter-online`,
  },
  '/voice-counter-offline': {
    title: 'Offline Voice Counter — Works Without Internet (PWA + Android)',
    h1: 'Offline Voice Counter',
    subtitle:
      'A voice counter that runs entirely on your device. Install as a PWA or Android app; works with no internet, no cloud, fully private.',
    description:
      'Offline voice counter that runs without an internet connection. On-device speech recognition (Vosk, Whisper, Moonshine) — audio never leaves your phone. Install as a PWA or Android APK.',
    keywords: `voice counter offline, offline voice counter, private voice counter, on-device counter, ${COMMON_KEYWORDS}`,
    canonical: `${SITE}/voice-counter-offline`,
  },
  '/voice-counter-app': {
    title: 'Voice Counter App — Free PWA & Android APK',
    h1: 'Voice Counter App',
    subtitle:
      'A voice counter app for Android and any modern browser. Free, installable as a PWA, exportable as an Android APK.',
    description:
      'Free voice counter app. Install on Android as a PWA or APK, or just open in your browser. Counts words, reps, and any spoken item live.',
    keywords: `voice counter app, voice count app, ${COMMON_KEYWORDS}`,
    canonical: `${SITE}/voice-counter-app`,
  },
  '/count-by-voice': {
    title: 'Count by Voice — Free Hands-Free Counting Tool',
    h1: 'Count by Voice',
    subtitle:
      'Count anything just by saying it. Add custom words, the counter listens and tallies in real time.',
    description:
      'Free tool to count by voice. Speak your target word, watch the count go up. Multi-word support, custom homophones, offline-capable.',
    keywords: `count by voice, voice count, voice counting, ${COMMON_KEYWORDS}`,
    canonical: `${SITE}/count-by-voice`,
  },
  '/tally-app': {
    title: 'Tally App — Free Voice-Powered Tally Counter',
    h1: 'Tally App',
    subtitle:
      'A free tally app that you control with your voice. Tally as many items at once as you want, all hands-free.',
    description:
      'Free tally app with voice input. Track multiple items at once, undo/redo, full history, color-coded counts. PWA-installable, offline-ready.',
    keywords: `tally app, tally, voice tally app, multi-tally, ${COMMON_KEYWORDS}`,
    canonical: `${SITE}/tally-app`,
  },
  '/counter': {
    title: 'Voice Counter — Free Tally Counter You Control by Speaking',
    h1: 'Voice Counter',
    subtitle:
      'A free counter you control by voice. Useful for any counting task, hands-free.',
    description:
      'Free counter with voice input. Tally anything by speaking. Lightweight, browser-based, offline-capable, no ads, no signup.',
    keywords: `counter, voice counter, tally counter, ${COMMON_KEYWORDS}`,
    canonical: `${SITE}/counter`,
  },
};

export const seoRoutes = Object.keys(seoConfig);

export const fallbackSEO: SEOConfig = seoConfig['/'];
