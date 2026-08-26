'use client'

import { useContext } from 'react'

import { AVATAR_LAYOUT } from '~/const/layout'
import type { TAvatarLayout } from '~/spec'
import { ShellStyleContext } from '~/stores/shellStyle/context'

type TRet = {
  avatarLayout: TAvatarLayout
  isSquare: boolean
}

/** Exposes avatar layout state and actions through the shared React hook boundary. */
export default function useAvatarLayout(): TRet {
  const value = useContext(ShellStyleContext)
  if (!value) throw new Error('useAvatarLayout must be used within ShellStyleProvider')

  const { avatarLayout } = value

  return {
    avatarLayout,
    isSquare: avatarLayout === AVATAR_LAYOUT.SQUARE,
  }
}
