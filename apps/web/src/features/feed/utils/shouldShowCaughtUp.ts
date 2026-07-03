export interface CaughtUpGateParams {
  isLoading: boolean
  isFetchingNextPage: boolean
  hasNextPage: boolean | undefined
  postCount: number
}

/** Determines whether the "caught up" end-state should render at the bottom
    of the feed: only once the initial load and any next-page fetch have
    settled, there is nothing further to paginate, and at least one post
    is visible. */
export function shouldShowCaughtUp({
  isLoading,
  isFetchingNextPage,
  hasNextPage,
  postCount,
}: CaughtUpGateParams): boolean {
  return !isLoading && !isFetchingNextPage && !hasNextPage && postCount > 0
}
