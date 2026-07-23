import { MediaGrid } from 'web';

const IMG_1 =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="100%" height="100%" fill="%235B5BD6"/></svg>'.replace(/%/g, '%25'),
  );

function swatch(color: string) {
  return (
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="100%" height="100%" fill="${color}"/></svg>`)
  );
}

export function SinglePhoto() {
  return (
    <div style={{ padding: 12, background: 'var(--surface-page)', width: 380 }}>
      <MediaGrid urls={[swatch('#5B5BD6')]} onOpen={() => {}} />
    </div>
  );
}

export function ThreePhotos() {
  return (
    <div style={{ padding: 12, background: 'var(--surface-page)', width: 380 }}>
      <MediaGrid urls={[swatch('#E8814A'), swatch('#3DBE8B'), swatch('#5B5BD6')]} onOpen={() => {}} />
    </div>
  );
}

export function SixPlusPhotos() {
  return (
    <div style={{ padding: 12, background: 'var(--surface-page)', width: 380 }}>
      <MediaGrid
        urls={[
          swatch('#5B5BD6'),
          swatch('#E8814A'),
          swatch('#3DBE8B'),
          swatch('#D64545'),
          swatch('#C99A3D'),
          swatch('#4A90D9'),
          swatch('#8A5BD6'),
          swatch('#5BD6B8'),
        ]}
        onOpen={() => {}}
      />
    </div>
  );
}
