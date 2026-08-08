'use client'

import type { TPlatformScriptProps } from './context'
import { usePlatform } from './context'

export default function PlatformScript(props: TPlatformScriptProps) {
  const Script = usePlatform().components.Script

  return <Script {...props} />
}
