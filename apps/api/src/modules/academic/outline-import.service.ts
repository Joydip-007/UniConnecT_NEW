import { extractCourseOutline } from '../../services/ai.service'
import { assertAttachmentUrlsAreOwnUploads } from '../../services/upload.service'
import { badRequest } from '../../utils/errors'
import type { CourseOutlineDraftInput } from './schema'

/**
 * Fetches a client-supplied file URL (must point at our own upload bucket — checked via
 * `assertAttachmentUrlsAreOwnUploads`) and returns its text content. PDFs go through
 * `pdf-parse`, `.docx` through `mammoth`; anything else (roster CSVs, plain text) is read
 * as-is.
 */
async function extractTextFromUrl(url: string): Promise<string> {
  const res = await fetch(url)
  if (!res.ok) {
    throw badRequest('Could not fetch the uploaded file', 'ATTACHMENT_FETCH_FAILED')
  }
  const contentType = res.headers.get('content-type') ?? ''
  const lowerUrl = url.toLowerCase()

  if (contentType.includes('pdf') || lowerUrl.endsWith('.pdf')) {
    const buffer = Buffer.from(await res.arrayBuffer())
    const { PDFParse } = await import('pdf-parse')
    const parser = new PDFParse({ data: buffer })
    try {
      const parsed = await parser.getText()
      return parsed.text
    } finally {
      await parser.destroy()
    }
  }

  if (contentType.includes('officedocument.wordprocessingml') || lowerUrl.endsWith('.docx')) {
    const buffer = Buffer.from(await res.arrayBuffer())
    const mammoth = await import('mammoth')
    const { value } = await mammoth.extractRawText({ buffer })
    return value
  }

  return res.text()
}

/** Parses a roster CSV's `email` column into a de-duplicated, lower-cased list. */
function parseRosterEmails(csvText: string): string[] {
  const lines = csvText
    .trim()
    .split(/\r?\n/)
    .filter((line) => line.length > 0)
  if (lines.length === 0) return []

  const header = lines[0]!.split(',').map((h) => h.trim().toLowerCase())
  const emailIndex = header.indexOf('email')
  if (emailIndex === -1) return []

  const seen = new Set<string>()
  const emails: string[] = []
  for (const line of lines.slice(1)) {
    const columns = line.split(',')
    const raw = columns[emailIndex]?.trim().toLowerCase()
    if (raw && raw.includes('@') && !seen.has(raw)) {
      seen.add(raw)
      emails.push(raw)
    }
  }
  return emails
}

export interface CourseOutlineDraftResult {
  draft: CourseOutlineDraftInput
  rosterEmails: string[]
}

/**
 * Builds a reviewable course-outline draft from an uploaded outline file (+ optional
 * roster CSV): fetches both, extracts their text, asks Gemini (`extractCourseOutline`)
 * for structured JSON, and reshapes that into `CourseOutlineDraftInput` — filling
 * `bestNCounted`/`displayOrder` (not part of Gemini's raw output) and mapping each
 * topic's free-text `dateRange` onto the outline's `description` field.
 */
export async function buildCourseOutlineDraft(fileUrl: string, rosterUrl?: string): Promise<CourseOutlineDraftResult> {
  assertAttachmentUrlsAreOwnUploads([{ url: fileUrl }])
  if (rosterUrl) assertAttachmentUrlsAreOwnUploads([{ url: rosterUrl }])

  const text = await extractTextFromUrl(fileUrl)
  const extraction = await extractCourseOutline(text)

  const draft: CourseOutlineDraftInput = {
    courseCode: extraction.courseCode,
    courseTitle: extraction.courseTitle,
    section: extraction.section,
    gradingScale: 'uiu',
    assessments: extraction.assessments.map((a, index) => ({
      categoryName: a.categoryName,
      weightPercent: a.weightPercent,
      fullMarks: a.fullMarks,
      totalGiven: a.totalGiven,
      bestNCounted: a.totalGiven,
      displayOrder: index + 1,
    })),
    topics: extraction.topics.map((t) => ({
      weekNumber: t.weekNumber,
      title: t.title,
      description: t.dateRange,
    })),
    assignments: extraction.assignments,
  }

  const rosterEmails = rosterUrl ? parseRosterEmails(await extractTextFromUrl(rosterUrl)) : []

  return { draft, rosterEmails }
}
