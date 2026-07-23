import { AttachmentList } from 'web';

const wrap = { padding: 12, background: 'var(--surface-page)' };

export function FilesOnly() {
  return (
    <div style={wrap}>
      <AttachmentList
        attachments={[
          {
            id: 'att-1',
            fileName: 'career-fair-2026-schedule.pdf',
            fileUrl: 'https://picsum.photos/seed/pdf1/40',
            mimeType: 'application/pdf',
            sizeBytes: 482_300,
          },
          {
            id: 'att-2',
            fileName: 'sponsor-deck.pptx',
            fileUrl: 'https://picsum.photos/seed/pptx1/40',
            mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            sizeBytes: 2_150_000,
          },
        ]}
      />
    </div>
  );
}

export function ImagesOnly() {
  return (
    <div style={wrap}>
      <AttachmentList
        attachments={[
          {
            id: 'att-3',
            fileName: 'campus-photo-1.jpg',
            fileUrl: 'https://picsum.photos/seed/campus1/400/300',
            mimeType: 'image/jpeg',
            sizeBytes: 340_000,
          },
          {
            id: 'att-4',
            fileName: 'campus-photo-2.jpg',
            fileUrl: 'https://picsum.photos/seed/campus2/400/300',
            mimeType: 'image/jpeg',
            sizeBytes: 298_000,
          },
        ]}
      />
    </div>
  );
}

export function MixedMedia() {
  return (
    <div style={wrap}>
      <AttachmentList
        attachments={[
          {
            id: 'att-5',
            fileName: 'event-banner.png',
            fileUrl: 'https://picsum.photos/seed/banner/400/240',
            mimeType: 'image/png',
            sizeBytes: 512_000,
          },
          {
            id: 'att-6',
            fileName: 'registration-form.docx',
            fileUrl: 'https://picsum.photos/seed/docx/40',
            mimeType: 'application/msword',
            sizeBytes: 88_400,
          },
          {
            id: 'att-7',
            fileName: 'resource-archive.zip',
            fileUrl: 'https://picsum.photos/seed/zip/40',
            mimeType: 'application/zip',
            sizeBytes: 12_400_000,
          },
        ]}
      />
    </div>
  );
}
