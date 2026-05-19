export function Skel({ w, h = 8 }: { w: number | string; h?: number }) {
  return (
    <div
      style={{
        height: h,
        borderRadius: 4,
        background: 'var(--border-strong)',
        width: w,
        flexShrink: 0,
      }}
    />
  )
}
