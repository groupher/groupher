import type { TInfraPlatform } from '@/lib/infra-links'

type TProps = {
  platform: TInfraPlatform
}

export function InfraPlatformMark({ platform }: TProps) {
  return (
    <svg
      className={`infra-platform-mark infra-platform-mark--${platform.id}`}
      viewBox={platform.icon.viewBox}
      role='img'
      aria-label={platform.name}
    >
      <path d={platform.icon.path} fill={platform.icon.color} />
    </svg>
  )
}
