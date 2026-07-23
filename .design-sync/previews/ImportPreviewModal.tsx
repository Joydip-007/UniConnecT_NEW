import { ImportPreviewModal, dsQueryClient } from 'web';


// Force framer-motion's useReducedMotion() to true so animated enter/exit
// transitions render already-settled — otherwise capture can land mid-animation
// (e.g. Modal.tsx's opacity:0 initial state) and screenshot a blank frame.
if (typeof window !== 'undefined') {
  const mql = {
    matches: true,
    media: '(prefers-reduced-motion: reduce)',
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  } as unknown as MediaQueryList;
  window.matchMedia = (() => mql) as typeof window.matchMedia;
}

// ImportPreviewModal fetches the news/event detail via useQuery — seed the
// shared query client cache with matching queryKey so it doesn't get stuck
// in isLoading (systemic gotcha #1).
dsQueryClient.setQueryData(['content-sync', 'preview', 'news', 'news-1'], {
  id: 'news-1',
  title: 'UIU signs MoU with Grameenphone for internship pipeline',
  body: 'United International University has signed a memorandum of understanding with Grameenphone to establish a structured internship pipeline for final-year CSE and BBA students, effective from the upcoming semester.',
  coverUrl: 'https://picsum.photos/seed/news-mou/800/400',
  category: 'Partnerships',
  createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
  attachments: [],
});

dsQueryClient.setQueryData(['content-sync', 'preview', 'event', 'event-1'], {
  id: 'event-1',
  title: 'Spring 2026 career fair',
  description: 'Meet recruiters from 40+ companies across tech, finance, and telecom on the UIU permanent campus.',
  location: 'UIU Campus, Madani Ave, Dhaka',
  isOnline: false,
  coverUrl: 'https://picsum.photos/seed/career-fair/800/400',
  startsAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
  createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  attachments: [],
});

export function NewsPreview() {
  return (
    <ImportPreviewModal
      target={{ kind: 'news', id: 'news-1' }}
      onClose={() => {}}
      onPublish={() => {}}
      publishing={false}
    />
  );
}

export function EventPreview() {
  return (
    <ImportPreviewModal
      target={{ kind: 'event', id: 'event-1' }}
      onClose={() => {}}
      onPublish={() => {}}
      publishing={true}
    />
  );
}
