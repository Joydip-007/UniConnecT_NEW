interface AnnouncementStatusInput {
  isPublished: boolean
  publishAt: string | null
}

export type AnnouncementStatus = 'published' | 'scheduled' | 'draft'

export function announcementStatus(item: AnnouncementStatusInput): AnnouncementStatus {
  if (item.isPublished) return 'published'
  if (item.publishAt && new Date(item.publishAt).getTime() > Date.now()) return 'scheduled'
  return 'draft'
}
