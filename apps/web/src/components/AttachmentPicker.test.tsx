import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { AttachmentInput } from '@uniconnect/shared'
import { AttachmentPicker } from './AttachmentPicker'

const uploadMock = vi.fn()
vi.mock('@/hooks/usePresignedUpload', () => ({
  usePresignedUpload: () => ({ upload: uploadMock, uploading: false, error: null, reset: vi.fn() }),
}))

function fileInput(): HTMLInputElement {
  // The picker keeps the file input hidden behind a button.
  return document.querySelector('input[type="file"]') as HTMLInputElement
}

function makeFile(name: string, type: string, size = 1024): File {
  const file = new File(['x'], name, { type })
  Object.defineProperty(file, 'size', { value: size })
  return file
}

beforeEach(() => {
  uploadMock.mockReset()
})

describe('AttachmentPicker', () => {
  it('uploads an allowed file and emits it via onChange', async () => {
    uploadMock.mockResolvedValue('https://files.example.com/doc.pdf')
    const onChange = vi.fn()
    render(<AttachmentPicker value={[]} onChange={onChange} />)

    fireEvent.change(fileInput(), { target: { files: [makeFile('doc.pdf', 'application/pdf')] } })

    await waitFor(() => expect(onChange).toHaveBeenCalled())
    const emitted = onChange.mock.calls[0][0] as AttachmentInput[]
    expect(emitted[0]).toMatchObject({ fileName: 'doc.pdf', fileUrl: 'https://files.example.com/doc.pdf' })
  })

  it('rejects a disallowed file type without uploading', async () => {
    const onChange = vi.fn()
    render(<AttachmentPicker value={[]} onChange={onChange} />)

    fireEvent.change(fileInput(), { target: { files: [makeFile('malware.exe', 'application/octet-stream')] } })

    expect(await screen.findByText(/not an allowed file type/i)).toBeInTheDocument()
    expect(uploadMock).not.toHaveBeenCalled()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('rejects a file over the size limit', async () => {
    const onChange = vi.fn()
    render(<AttachmentPicker value={[]} onChange={onChange} />)

    fireEvent.change(fileInput(), {
      target: { files: [makeFile('huge.pdf', 'application/pdf', 30 * 1024 * 1024)] },
    })

    expect(await screen.findByText(/too large/i)).toBeInTheDocument()
    expect(uploadMock).not.toHaveBeenCalled()
  })

  it('shows existing attachments and removes them via onRemovedIdsChange', () => {
    const onRemovedIdsChange = vi.fn()
    render(
      <AttachmentPicker
        value={[]}
        onChange={vi.fn()}
        existing={[
          {
            id: 'att-1',
            entityType: 'news',
            entityId: 'n1',
            fileUrl: 'https://files.example.com/a.pdf',
            fileName: 'a.pdf',
            mimeType: 'application/pdf',
            sizeBytes: 10,
            downloadStatus: 'done',
          },
        ]}
        removedIds={[]}
        onRemovedIdsChange={onRemovedIdsChange}
      />,
    )

    expect(screen.getByText('a.pdf')).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Remove a.pdf'))
    expect(onRemovedIdsChange).toHaveBeenCalledWith(['att-1'])
  })
})
