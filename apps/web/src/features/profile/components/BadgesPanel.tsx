import { Award } from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'

interface Props {
  isOwnProfile: boolean
}

export function BadgesPanel({ isOwnProfile }: Props) {
  return (
    <EmptyState
      icon={Award}
      title={isOwnProfile ? 'No badges yet' : 'No badges yet'}
      description={
        isOwnProfile
          ? 'Earn badges by completing your profile, posting regularly, and connecting with peers.'
          : 'Badges will appear here as this person reaches milestones.'
      }
    />
  )
}
