import { Field } from 'web';

// Label-over-control wrapper: a 12px --text-label span with a 6px gap, whatever
// control you give it. Paired here with the screen's own input/select styling.

const inputStyle = {
  fontSize: 14,
  color: 'var(--text-primary)',
  background: 'var(--surface-raised)',
  border: '0.5px solid var(--border-default)',
  borderRadius: 'var(--r-md)',
  padding: '10px 12px',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box' as const,
  fontFamily: 'inherit',
};

const frame = {
  display: 'flex',
  flexDirection: 'column' as const,
  gap: 16,
  padding: 16,
  width: 340,
  background: 'var(--surface-page)',
};

export function TextInput() {
  return (
    <div style={frame}>
      <Field label="Path title">
        <input style={inputStyle} defaultValue="Intro to data structures" readOnly />
      </Field>
    </div>
  );
}

export function SelectAndTextarea() {
  return (
    <div style={frame}>
      <Field label="Difficulty">
        <select style={inputStyle} defaultValue="intermediate">
          <option value="beginner">Beginner</option>
          <option value="intermediate">Intermediate</option>
          <option value="advanced">Advanced</option>
        </select>
      </Field>
      <Field label="Custom instructions">
        <textarea
          style={{ ...inputStyle, minHeight: 72, resize: 'vertical', lineHeight: 1.6 }}
          defaultValue="Keep examples grounded in the CSE 3421 syllabus at UIU."
          readOnly
        />
      </Field>
    </div>
  );
}

export function StackedForm() {
  return (
    <div style={frame}>
      <Field label="Subject">
        <input style={inputStyle} defaultValue="Operating systems" readOnly />
      </Field>
      <Field label="Questions per run">
        <input style={inputStyle} defaultValue="5" readOnly />
      </Field>
      <Field label="Run hour (UTC)">
        <input style={inputStyle} defaultValue="03:00" readOnly />
      </Field>
    </div>
  );
}
