'use client'

import type { ReactNode } from 'react'

import useDashboard from '~/stores/dashboard/hooks'

import ShellStyleProvider from './provider'

export default function DashboardShellStyleProvider({ children }: { children: ReactNode }) {
  const {
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
  } = useDashboard()

  return (
    <ShellStyleProvider
      avatarLayout={avatarLayout}
      brandLayout={brandLayout}
      changelogLayout={changelogLayout}
      communityLayout={communityLayout}
      inlineTagLayout={inlineTagLayout}
      kanbanBgColors={kanbanBgColors}
      kanbanBoards={kanbanBoards}
      kanbanCardLayout={kanbanCardLayout}
      kanbanLayout={kanbanLayout}
      metric={metric}
      nameAlias={nameAlias}
      navActiveLayout={navActiveLayout}
      overlayDark={overlayDark}
      postLayout={postLayout}
      tagLayout={tagLayout}
    >
      {children}
    </ShellStyleProvider>
  )
}
