import { isAxiosError } from 'axios'

/**
 * A 404/403 means the item is really gone or hidden from this viewer; anything else
 * (no response, a 5xx, a timeout) is a failed request that deserves a retry, not a
 * "not found" that sends them away.
 */
export function isMissingError(error: unknown): boolean {
  if (!isAxiosError(error)) return false
  const status = error.response?.status
  return status === 404 || status === 403
}
