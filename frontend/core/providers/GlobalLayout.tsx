'use client'

import type { FC, ReactNode } from 'react'
import GlobalLayoutWrapper from '~/widgets/GlobalLayout'

type TProps = {
  mainBlock?: FC<{ children: ReactNode }>
  children?: ReactNode
}

const GlobalLayout: FC<TProps> = ({ children, mainBlock = undefined }) => {
  return <GlobalLayoutWrapper mainBlock={mainBlock}>{children}</GlobalLayoutWrapper>
}

export default GlobalLayout
