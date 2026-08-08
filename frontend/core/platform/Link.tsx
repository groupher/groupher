'use client'

import type { TPlatformLinkProps } from './context'
import { usePlatform } from './context'

export default function PlatformLink(props: TPlatformLinkProps) {
  const Link = usePlatform().components.Link

  return <Link {...props} />
}
