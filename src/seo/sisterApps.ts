// Sister apps under the app.scot domain. Listed in the page footer and in
// the static <noscript> block so search engines see real outbound links to
// the rest of the portfolio (and, reciprocally, inbound backlinks when
// those apps link here).
//
// Source of truth — used by both the React component (SisterAppsFooter.tsx)
// and the build-time prerender (vite.config.ts seoPrerenderPlugin).

export interface SisterApp {
  name: string;
  url: string;
  blurb: string;
}

export const sisterApps: SisterApp[] = [
  {
    name: 'app.scot',
    url: 'https://app.scot',
    blurb: 'Portfolio hub — index of all app.scot projects.',
  },
  {
    name: 'Ajgar',
    url: 'https://ajgar.app.scot',
    blurb: 'Hindi-language Python learning platform — runs Python in the browser via Brython.',
  },
  {
    name: 'Battle',
    url: 'https://battle.app.scot',
    blurb: 'Tournament management for robot combat events. Offline-capable, cross-platform.',
  },
  {
    name: 'BodyFuel',
    url: 'https://bodyfuel.app.scot',
    blurb: 'Health tracking + cafe loyalty: nutrition, hydration, mobile payments, rewards.',
  },
  {
    name: 'Brotex',
    url: 'https://brotex.app.scot',
    blurb: 'Browser-based LaTeX environment with offline PWA support and ZIP uploads.',
  },
  {
    name: 'ChronoLocator',
    url: 'https://chronolocator.app.scot',
    blurb: 'Global time management: world clocks, timezone conversion, meeting planning.',
  },
  {
    name: 'Diffy',
    url: 'https://diffy.app.scot',
    blurb: 'Compare and visualize differences between text files and images in the browser.',
  },
  {
    name: 'Face Health',
    url: 'https://face-health.app.scot',
    blurb: 'Webcam face keypoints → facial fat, heart rate, and other health metrics.',
  },
  {
    name: 'Heart',
    url: 'https://heart.app.scot',
    blurb: 'Measures heart rate in real time using your device camera (photoplethysmography).',
  },
  {
    name: 'HTML2URL',
    url: 'https://html2url.app.scot',
    blurb: 'AI-assisted tool for converting HTML content into shortened links.',
  },
  {
    name: 'Interview',
    url: 'https://interview.app.scot',
    blurb: 'AI-assisted interview prep + WebAssembly playground for coding challenges.',
  },
  {
    name: 'MVP',
    url: 'https://mvp.app.scot',
    blurb: 'Interactive AI playground for experimenting with AI capabilities in React.',
  },
  {
    name: 'Name Alert',
    url: 'https://name-alert.app.scot',
    blurb: 'Monitors mentions of specified names across digital platforms.',
  },
  {
    name: 'S2',
    url: 'https://s2.app.scot',
    blurb: 'Visualize and manipulate S2 geospatial data — spherical geometry on the web.',
  },
  {
    name: 'Sound',
    url: 'https://sound.app.scot',
    blurb: 'In-browser audio analysis: dB meter, frequency spectrum, spectrogram, recorder.',
  },
  {
    name: 'SubLog',
    url: 'https://sublog.app.scot',
    blurb: 'Centralized subscription manager: track spending, get renewal reminders.',
  },
  {
    name: 'Tremor',
    url: 'https://tremor.app.scot',
    blurb: 'Capture, measure, and analyze tremors or vibrations for medical or engineering use.',
  },
  {
    name: 'Weather',
    url: 'https://weather.app.scot',
    blurb: 'Accurate real-time weather forecasts with a stunning visual UI.',
  },
];
