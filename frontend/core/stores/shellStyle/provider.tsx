'use client'

import type { ReactNode } from 'react'

import { ShellStyleContext } from './context'
import type { TShellStyle } from './spec'

type TProps = TShellStyle & {
  children: ReactNode
}

export default function ShellStyleProvider({
  children,
  avatarLayout,
  brandLayout,
  changelogLayout,
  communityLayout,
  inlineTagLayout,
  kanbanBgColors,
  kanbanBoards,
  kanbanCardLayout,
  kanbanLayout,
  metric,
  nameAlias,
  navActiveLayout,
  overlayDark,
  postLayout,
  tagLayout,
}: TProps) {
  return (
    <ShellStyleContext.Provider
      value={{
        avatarLayout,
        brandLayout,
        changelogLayout,
        communityLayout,
        inlineTagLayout,
        kanbanBgColors,
        kanbanBoards,
        kanbanCardLayout,
        kanbanLayout,
        metric,
        nameAlias,
        navActiveLayout,
        overlayDark,
        postLayout,
        tagLayout,
      }}
    >
      {children}
    </ShellStyleContext.Provider>
  )
}
