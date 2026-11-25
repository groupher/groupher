'use client'

import type { ReactNode } from 'react'
import { useMemo } from 'react'

import { createCoverEditorStore } from '.'
import { CoverEditorContext } from './context'

type TProps = { children: ReactNode }

/** Scopes canvas state to a single mounted CoverEditor instance. */
export default function CoverEditorProvider({ children }: TProps) {
  const store = useMemo(() => createCoverEditorStore(), [])

  return <CoverEditorContext.Provider value={store}>{children}</CoverEditorContext.Provider>
}
