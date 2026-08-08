'use client'

import type { TPlatformImageProps } from './context'
import { usePlatform } from './context'

export default function PlatformImage(props: TPlatformImageProps) {
  const Image = usePlatform().components.Image

  return <Image {...props} />
}
