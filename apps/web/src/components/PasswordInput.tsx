import { forwardRef, useState } from 'react'
import type { InputHTMLAttributes } from 'react'
import { Eye, EyeOff } from 'lucide-react'

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>

/**
 * Password field with a show/hide toggle. Spreads through all standard input
 * props (including `style`), so it drops in anywhere a raw
 * `<input type="password" />` was used.
 */
export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput({ style, ...props }, ref) {
    const [visible, setVisible] = useState(false)

    return (
      <div style={{ position: 'relative', display: 'flex', width: '100%' }}>
        <input
          {...props}
          ref={ref}
          type={visible ? 'text' : 'password'}
          style={{ ...style, paddingRight: 42 }}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          tabIndex={-1}
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            right: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 36,
            padding: 0,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-secondary)',
          }}
        >
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    )
  },
)
