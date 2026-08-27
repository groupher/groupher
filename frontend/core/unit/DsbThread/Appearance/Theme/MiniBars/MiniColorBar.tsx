import type { TColorBarProps } from './spec'

export default function MiniColorBar({ color, className }: TColorBarProps) {
  return <span className={className} style={{ backgroundColor: color }} />
}
