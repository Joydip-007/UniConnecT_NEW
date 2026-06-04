// Entities that expose a shareable deep link. Each maps to a detail/permalink route
// in the web app (see SHARE_PATHS there). Sharing is internal: a link only resolves
// for a logged-in member of the same university.
export type ShareEntityType = 'post' | 'job' | 'event' | 'news' | 'group' | 'profile' | 'lost-found'

// A post's lifecycle state, derived from three nullable columns rather than stored.
export type PostLifecycleState = 'draft' | 'scheduled' | 'published' | 'archived'

export interface PostLifecycleFields {
  isPublished: boolean
  publishAt?: string | null
  archivedAt?: string | null
}

/** Derive the lifecycle state used for badges and filtering. */
export function getPostLifecycleState(post: PostLifecycleFields): PostLifecycleState {
  if (post.archivedAt) return 'archived'
  if (post.isPublished) return 'published'
  if (post.publishAt) return 'scheduled'
  return 'draft'
}
