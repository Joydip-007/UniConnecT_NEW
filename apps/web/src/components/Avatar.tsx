interface AvatarProps {
  initials: string;
  color: string;
  size?: number;
  online?: boolean;
}

export function Avatar({ initials, color, size = 40, online = false }: AvatarProps) {
  const dotSize = Math.round(size * 0.27);

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.34,
        fontWeight: 500,
        color: '#fff',
        flexShrink: 0,
        position: 'relative',
      }}
    >
      {initials}
      {online && (
        <div
          style={{
            position: 'absolute',
            bottom: 1,
            right: 1,
            width: dotSize,
            height: dotSize,
            borderRadius: '50%',
            background: 'var(--uc-mint)',
            border: '2px solid var(--surface-card)',
          }}
        />
      )}
    </div>
  );
}
