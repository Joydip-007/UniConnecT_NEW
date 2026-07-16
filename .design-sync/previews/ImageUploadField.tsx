import { ImageUploadField } from 'web';

export function Empty() {
  return (
    <div style={{ padding: 24, maxWidth: 420 }}>
      <ImageUploadField
        value={null}
        onChange={() => {}}
        folder="covers"
        label="Cover photo"
      />
    </div>
  );
}

export function WithImage() {
  return (
    <div style={{ padding: 24, maxWidth: 420 }}>
      <ImageUploadField
        value="https://picsum.photos/seed/uc-cover/800/250"
        onChange={() => {}}
        folder="covers"
        label="Cover photo"
      />
    </div>
  );
}
