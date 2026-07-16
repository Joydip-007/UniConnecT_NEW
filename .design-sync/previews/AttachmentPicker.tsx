import { AttachmentPicker } from 'web';

export function Empty() {
  return (
    <div style={{ padding: 24, maxWidth: 420 }}>
      <AttachmentPicker value={[]} onChange={() => {}} />
    </div>
  );
}

export function WithFiles() {
  return (
    <div style={{ padding: 24, maxWidth: 420 }}>
      <AttachmentPicker
        value={[
          { fileUrl: 'https://example.com/files/syllabus.pdf', fileName: 'syllabus.pdf', mimeType: 'application/pdf', sizeBytes: 245000 },
          { fileUrl: 'https://example.com/files/notes.docx', fileName: 'lecture-notes.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', sizeBytes: 98000 },
        ]}
        onChange={() => {}}
      />
    </div>
  );
}
