# Animated Icons in the Web App

This guide explains how to add a Lottie `.json` icon to `apps/web`, trigger it only on user action, match it to the app color system, and replace an existing static icon.

## Current Setup

- Lottie JSON assets live in `apps/web/src/assets/lottie/`.
- The shared renderer is `apps/web/src/components/AnimatedIcon.tsx`.
- `lottie-react` is installed in `apps/web/package.json`.
- JSON imports are typed in `apps/web/src/vite-env.d.ts`.
- Lottie SVG colors are normalized in `apps/web/src/styles/index.css` so animated icons inherit `currentColor`.

`AnimatedIcon` lazy-loads `lottie-react`, so the heavier Lottie player is not added to the initial app bundle until an animated icon is rendered.

## Default Behavior

`AnimatedIcon` is paused by default:

- `autoplay`: `false`
- `loop`: `false`
- `size`: `16`
- `useCurrentColor`: `true`

For action icons such as download, upload, send, save, or delete, trigger the animation from the same click handler that performs the action. Do this by keeping a local counter and passing it as `playKey`.

```tsx
import { useState } from 'react'
import { AnimatedIcon } from '@/components/AnimatedIcon'
import downloadAnimation from '@/assets/lottie/icons8-download-from-the-cloud-50.json'

export function DownloadButton() {
  const [downloadAnimationKey, setDownloadAnimationKey] = useState(0)

  function handleDownload() {
    setDownloadAnimationKey((key) => key + 1)
    // Run the real download/export action here.
  }

  return (
    <button type="button" onClick={handleDownload}>
      <AnimatedIcon
        animationData={downloadAnimation}
        size={18}
        playKey={downloadAnimationKey}
      />
      Download
    </button>
  )
}
```

Do not use `autoplay` for normal action icons. Autoplay is only for intentionally ambient icons, loading states, or decorative animation.

## Color Matching

By default, `AnimatedIcon` recolors the Lottie SVG to `currentColor`. That means the parent element controls the icon color:

```tsx
<button style={{ color: 'var(--text-secondary)' }}>
  <AnimatedIcon animationData={downloadAnimation} size={18} playKey={downloadAnimationKey} />
  Export resume
</button>
```

Use the app's existing design tokens for icon color:

```text
var(--text-secondary)
var(--text-tertiary)
var(--uc-indigo-xl)
var(--uc-orange-l)
var(--uc-red)
```

This is theme-safe. The app sets different values for these tokens under `:root[data-theme='dark']` and `:root[data-theme='light']`, so an animated icon using `currentColor` automatically changes when the user switches theme. Do not create separate light-mode and dark-mode Lottie files for a normal one-color action icon.

Good theme-safe pattern:

```tsx
<div style={{ color: 'var(--text-tertiary)' }}>
  <AnimatedIcon animationData={downloadAnimation} size={18} playKey={downloadAnimationKey} />
</div>
```

Avoid hard-coded colors unless there is a strong product reason:

```tsx
<AnimatedIcon
  animationData={downloadAnimation}
  size={18}
  playKey={downloadAnimationKey}
  style={{ color: '#000000' }}
/>
```

If a Lottie asset is intentionally multi-color and should keep its original colors, opt out:

```tsx
<AnimatedIcon
  animationData={celebrationAnimation}
  size={32}
  useCurrentColor={false}
  autoplay
  loop
/>
```

## Add A New Animated Icon

1. Download or export the icon as a Lottie `.json` file.
2. Use a descriptive kebab-case filename.

   ```text
   upload-to-cloud.json
   send-message.json
   success-check.json
   ```

3. Place the file here:

   ```text
   apps/web/src/assets/lottie/
   ```

4. Import it in the component where the icon is needed:

   ```tsx
   import { AnimatedIcon } from '@/components/AnimatedIcon'
   import uploadAnimation from '@/assets/lottie/upload-to-cloud.json'
   ```

5. If the icon should animate on click, add local state:

   ```tsx
   const [uploadAnimationKey, setUploadAnimationKey] = useState(0)

   function handleUpload() {
     setUploadAnimationKey((key) => key + 1)
     // Run upload action.
   }
   ```

6. Render the icon with `playKey`:

   ```tsx
   <AnimatedIcon
     animationData={uploadAnimation}
     size={18}
     playKey={uploadAnimationKey}
   />
   ```

Use `size={16}` to `size={20}` for toolbar, button, and card action icons. Use larger sizes only for empty states, cards, or illustrations.

## Replace An Existing Static Icon

Find the current static icon import:

```tsx
import { Upload } from 'lucide-react'
```

Replace it with:

```tsx
import { useState } from 'react'
import { AnimatedIcon } from '@/components/AnimatedIcon'
import uploadAnimation from '@/assets/lottie/upload-to-cloud.json'
```

Then replace the click handler and JSX:

```tsx
const [uploadAnimationKey, setUploadAnimationKey] = useState(0)

function handleUpload() {
  setUploadAnimationKey((key) => key + 1)
  // Existing upload logic stays here.
}

<button type="button" onClick={handleUpload}>
  <AnimatedIcon
    animationData={uploadAnimation}
    size={18}
    playKey={uploadAnimationKey}
  />
  Upload
</button>
```

Remove the lucide import if it is no longer used. Keep other lucide icons in the same file unchanged.

## Accessibility

Most button icons in this app are decorative because the button already has text or an `aria-label`. In those cases, do not pass `ariaLabel`:

```tsx
<AnimatedIcon animationData={uploadAnimation} size={18} playKey={uploadAnimationKey} />
```

If the animated icon is the only accessible label for the control, label the parent control:

```tsx
<button type="button" aria-label="Upload file" onClick={handleUpload}>
  <AnimatedIcon animationData={uploadAnimation} size={18} playKey={uploadAnimationKey} />
</button>
```

Only pass `ariaLabel` to `AnimatedIcon` when the icon itself is meaningful outside a labeled control:

```tsx
<AnimatedIcon animationData={successAnimation} size={24} ariaLabel="Success" />
```

## Animation Options

`AnimatedIcon` supports these props:

```tsx
<AnimatedIcon
  animationData={successAnimation}
  size={24}
  playKey={successAnimationKey}
  loop={false}
  autoplay={false}
  useCurrentColor
/>
```

Prop notes:

- `playKey`: increment or change this value to replay the animation from frame 0.
- `autoplay`: starts immediately on render. Keep this off for action icons.
- `loop`: repeats while playing. Keep this off for one-shot action feedback.
- `useCurrentColor`: keeps the animation aligned with the app theme by inheriting parent `color`.

## Existing Download Icon Example

The cloud-download animation is currently used in:

- `apps/web/src/features/profile/components/ResumeExportButton.tsx`
- `apps/web/src/features/content-sync/components/AttachmentList.tsx`

Both import:

```tsx
import { AnimatedIcon } from '@/components/AnimatedIcon'
import downloadCloudAnimation from '@/assets/lottie/icons8-download-from-the-cloud-50.json'
```

Both use local state to trigger the animation only after a download/export click:

```tsx
const [downloadAnimationKey, setDownloadAnimationKey] = useState(0)

function handleDownload() {
  setDownloadAnimationKey((key) => key + 1)
  // Existing download/export logic stays here.
}

<AnimatedIcon
  animationData={downloadCloudAnimation}
  size={18}
  playKey={downloadAnimationKey}
/>
```

## Checklist

After adding or replacing an animated icon:

```bash
pnpm --filter web typecheck
pnpm --filter web build
graphify update .
```

Check the UI manually for:

- The icon is still until the action is clicked.
- The click triggers the animation every time.
- The icon color matches the surrounding button, link, or card action.
- The icon fits inside the button or card without shifting layout.
- Text still aligns with the icon.
- The icon is not the only accessible name unless the parent has `aria-label`.
- The old lucide import was removed if unused.
