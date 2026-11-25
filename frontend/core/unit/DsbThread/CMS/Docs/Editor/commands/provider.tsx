'use client'

import { type ReactNode, useCallback, useMemo, useRef } from 'react'

import type { TSideTreeController } from '../SideTree/spec'
import type { TDocsEditorCommandValue } from '../store/spec'
import { DocsEditorCommandContext } from './context'

type TProps = {
  children: ReactNode
  sideTree: TSideTreeController
}

export default function Provider({ children, sideTree }: TProps) {
  const saveHandlerRef = useRef<{ token: symbol; handler: () => Promise<void> } | null>(null)

  const addGroup = useCallback((): void => {
    sideTree.addGroup()
  }, [sideTree])

  const reloadSideTree = useCallback((): void => {
    sideTree.reload()
  }, [sideTree])

  const saveDocDraft = useCallback(async (): Promise<void> => {
    await saveHandlerRef.current?.handler()
  }, [])

  const registerSaveDocDraft = useCallback((handler: () => Promise<void>): (() => void) => {
    const token = Symbol('docs-editor-save')
    saveHandlerRef.current = { token, handler }

    return (): void => {
      if (saveHandlerRef.current?.token === token) saveHandlerRef.current = null
    }
  }, [])

  const value = useMemo<TDocsEditorCommandValue>(
    () => ({ sideTree, addGroup, reloadSideTree, saveDocDraft, registerSaveDocDraft }),
    [sideTree, addGroup, reloadSideTree, saveDocDraft, registerSaveDocDraft],
  )

  return (
    <DocsEditorCommandContext.Provider value={value}>{children}</DocsEditorCommandContext.Provider>
  )
}
