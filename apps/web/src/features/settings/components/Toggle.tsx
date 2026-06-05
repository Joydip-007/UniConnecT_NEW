interface ToggleProps {
  checked: boolean
  onChange: (next: boolean) => void
  disabled?: boolean
  label: string
}

/** Accessible on/off switch following the design tokens (pill, 0.5px borders, no hardcoded hex). */
export function Toggle({ checked, onChange, disabled, label }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      style={{
        width: 40,
        height: 24,
        flexShrink: 0,
        borderRadius: 'var(--r-pill)',
        border: '0.5px solid var(--border-default)',
        background: checked ? 'var(--uc-indigo)' : 'var(--surface-raised)',
        position: 'relative',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'background 0.15s ease',
        padding: 0,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: 2,
          left: checked ? 18 : 2,
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: checked ? 'var(--on-accent)' : 'var(--text-tertiary)',
          transition: 'left 0.15s ease',
        }}
      />
    </button>
  )
}
