'use client'

import { use } from 'react'

import { DocsEditorCommandContext } from './context'

/** Reads the commands and current SideTree controller for one Docs editor instance. */
export default function useDocsEditorCommands() {
  const commands = use(DocsEditorCommandContext)
  if (!commands)
    throw new Error('useDocsEditorCommands must be used within DocsEditorCommandProvider')
  return commands
}
