import { ImageLightbox } from 'web';

const IMAGES = [
  'https://picsum.photos/seed/uc-lightbox-1/1200/800',
  'https://picsum.photos/seed/uc-lightbox-2/1200/800',
  'https://picsum.photos/seed/uc-lightbox-3/1200/800',
];

export function Default() {
  return <ImageLightbox images={IMAGES} onClose={() => {}} />;
}

export function SingleImage() {
  return <ImageLightbox images={[IMAGES[0]]} onClose={() => {}} />;
}
