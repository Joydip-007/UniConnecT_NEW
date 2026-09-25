import type { ConsultationSlot } from '../types'

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const

export function slotWhen(slot: ConsultationSlot) {
  return `${WEEKDAYS[slot.weekday]}, ${slot.startTime} – ${slot.endTime}`
}

export function slotWhere(slot: ConsultationSlot) {
  return slot.walkIn ? `${slot.location}, walk in` : slot.location
}
