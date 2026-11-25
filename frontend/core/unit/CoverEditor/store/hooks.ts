'use client'

import { useContext } from 'react'

import { CoverEditorContext } from './context'

/** Reads the store owned by the nearest CoverEditorProvider. */
export default function useCoverEditorStore() {
  const store = useContext(CoverEditorContext)
  if (!store) throw new Error('useCoverEditorStore must be used within CoverEditorProvider')

  return store
}
