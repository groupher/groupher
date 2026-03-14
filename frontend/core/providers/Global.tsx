'use client'

import type { FC, ReactNode } from 'react'
import GlobalLayout from '~/widgets/GlobalLayout'

type TProps = {
  mainBlock?: FC<{ children: ReactNode }>
  children?: ReactNode
}

export default function Global({ children, mainBlock = undefined }: TProps) {
  return <GlobalLayout mainBlock={mainBlock}>{children}</GlobalLayout>
}
