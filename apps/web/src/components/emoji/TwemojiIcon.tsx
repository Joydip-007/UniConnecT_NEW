import { twemojiUrl } from './reactionConfig'

interface TwemojiIconProps {
  codepoint: string
  size?: number
  label?: string
}

export function TwemojiIcon({ codepoint, size = 20, label }: TwemojiIconProps) {
  return (
    <img
      src={twemojiUrl(codepoint)}
      alt={label ?? codepoint}
      width={size}
      height={size}
      draggable={false}
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }}
    />
  )
}
