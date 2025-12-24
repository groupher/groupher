'use client'

import type { FC, ReactNode } from 'react'
import RealGlobalLayout from '~/widgets/GlobalLayout'

type TProps = {
  mainBlock?: FC<{ children: ReactNode }>
  children?: ReactNode
}

export default ({ children, mainBlock = undefined }: TProps) => {
  return <RealGlobalLayout mainBlock={mainBlock}>{children}</RealGlobalLayout>
}
