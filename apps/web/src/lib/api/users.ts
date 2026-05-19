import { api } from '@/lib/axios'
import type { ThemePreference } from '@uniconnect/shared/types'

export async function updateUserPreferences(input: { themePreference: ThemePreference }) {
  const { data } = await api.patch<{ data: { themePreference: ThemePreference } }>(
    '/users/me/preferences',
    input,
  )
  return data.data
}
