import { DialogBtn, DialogFrame, Field } from 'web';
import { Sparkles } from 'lucide-react';

// The admin Learning screen's modal chrome: icon + title/sub header, scroll body,
// right-aligned footer. Portalled — the card is rendered in single mode with a
// fixed viewport so the open panel sits inside it.

const input = {
  fontSize: 13,
  padding: '9px 12px',
  borderRadius: 'var(--r-md)',
  border: '0.5px solid var(--border-default)',
  background: 'var(--surface-raised)',
  color: 'var(--text-primary)',
  fontFamily: 'inherit',
  width: '100%',
  boxSizing: 'border-box' as const,
};

export function Open() {
  return (
    <DialogFrame
      open
      icon={<Sparkles size={18} />}
      title="Draft a learning path with AI"
      subtitle="Gemini writes the outline; you review before it goes live"
      onClose={() => {}}
      footer={
        <>
          <DialogBtn tone="ghost">Cancel</DialogBtn>
          <DialogBtn tone="solid" icon={<Sparkles size={14} />}>
            Generate
          </DialogBtn>
        </>
      }
    >
      <Field label="Topic">
        <input style={input} defaultValue="Operating systems for CSE 3rd year" />
      </Field>
      <Field label="Department">
        <select style={input} defaultValue="CSE">
          <option>CSE</option>
          <option>EEE</option>
        </select>
      </Field>
      <Field label="Custom instructions">
        <textarea style={{ ...input, minHeight: 72, resize: 'vertical' }} defaultValue="Keep examples grounded in the UIU syllabus." />
      </Field>
    </DialogFrame>
  );
}
