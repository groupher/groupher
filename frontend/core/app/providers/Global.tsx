'use client'

import type { FC, ReactNode } from 'react'

import GlobalLayout from '~/shell/GlobalLayout'
import AuthLoginModal from '~/ui/AuthLoginModal'

type TProps = {
  authLoginModal?: boolean
  mainBlock?: FC<{ children: ReactNode }>
  children?: ReactNode
}

export default function Global({ authLoginModal = true, children, mainBlock = undefined }: TProps) {
  return (
    <>
      <GlobalLayout mainBlock={mainBlock}>{children}</GlobalLayout>
      {authLoginModal && <AuthLoginModal />}
    </>
  )
}
