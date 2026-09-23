import { api } from '@/lib/axios'
import type { ThemePreference } from '@uniconnect/shared/types'
import type {
  ProfileExperience,
  ProfileEducation,
  ProfileFeatured,
  ProfileAnalytics,
  ProfileViewer,
} from '@uniconnect/shared'

export async function updateUserPreferences(input: { themePreference: ThemePreference }) {
  const { data } = await api.patch<{ data: { themePreference: ThemePreference } }>(
    '/users/me/preferences',
    input,
  )
  return data.data
}

// ── Profile sections ────────────────────────────────────────────────────────

export async function getUserExperience(userId: string) {
  const { data } = await api.get<{ data: ProfileExperience[] }>(`/users/${userId}/experience`)
  return data.data
}

export async function getUserEducation(userId: string) {
  const { data } = await api.get<{ data: ProfileEducation[] }>(`/users/${userId}/education`)
  return data.data
}

export async function getUserFeatured(userId: string) {
  const { data } = await api.get<{ data: ProfileFeatured[] }>(`/users/${userId}/featured`)
  return data.data
}

export async function getMyAnalytics() {
  const { data } = await api.get<{ data: ProfileAnalytics }>('/users/me/analytics')
  return data.data
}

export async function getMyViewers(page = 1) {
  const { data } = await api.get<{
    data: { items: ProfileViewer[]; total: number; page: number; hasMore: boolean }
  }>('/users/me/viewers', { params: { page } })
  return data.data
}

// ── CRUD: experience ────────────────────────────────────────────────────────

export async function createExperience(
  input: Omit<ProfileExperience, 'id' | 'userId' | 'createdAt' | 'updatedAt'>,
) {
  const { data } = await api.post<{ data: ProfileExperience }>('/users/me/experience', input)
  return data.data
}

export async function updateExperience(
  id: string,
  input: Partial<Omit<ProfileExperience, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>,
) {
  const { data } = await api.patch<{ data: ProfileExperience }>(
    `/users/me/experience/${id}`,
    input,
  )
  return data.data
}

export async function deleteExperience(id: string) {
  await api.delete(`/users/me/experience/${id}`)
}

// ── CRUD: education ─────────────────────────────────────────────────────────

export async function createEducation(
  input: Omit<ProfileEducation, 'id' | 'userId' | 'createdAt' | 'updatedAt'>,
) {
  const { data } = await api.post<{ data: ProfileEducation }>('/users/me/education', input)
  return data.data
}

export async function updateEducation(
  id: string,
  input: Partial<Omit<ProfileEducation, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>,
) {
  const { data } = await api.patch<{ data: ProfileEducation }>(
    `/users/me/education/${id}`,
    input,
  )
  return data.data
}

export async function deleteEducation(id: string) {
  await api.delete(`/users/me/education/${id}`)
}

// ── CRUD: featured ──────────────────────────────────────────────────────────

export async function createFeatured(
  input: Omit<ProfileFeatured, 'id' | 'userId' | 'createdAt'>,
) {
  const { data } = await api.post<{ data: ProfileFeatured }>('/users/me/featured', input)
  return data.data
}

export async function deleteFeatured(id: string) {
  await api.delete(`/users/me/featured/${id}`)
}
