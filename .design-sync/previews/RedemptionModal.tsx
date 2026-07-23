import { RedemptionModal } from 'web';


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

const card = {
  id: 'gc1',
  vendor: 'Amazon',
  title: 'Amazon gift card',
  description: 'Redeemable on amazon.com for any product.',
  imageUrl: null,
  valueUsdCents: 1000,
  thresholdPoints: 1000,
};

export function Default() {
  return <RedemptionModal card={card} balance={1450} isSubmitting={false} onCancel={() => {}} onConfirm={() => {}} />;
}

export function Submitting() {
  return <RedemptionModal card={card} balance={1450} isSubmitting onCancel={() => {}} onConfirm={() => {}} />;
}
