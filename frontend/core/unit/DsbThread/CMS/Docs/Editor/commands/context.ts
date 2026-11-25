'use client'

import { createContext } from 'react'

import type { TDocsEditorCommandValue } from '../store/spec'

export const DocsEditorCommandContext = createContext<TDocsEditorCommandValue | null>(null)
DocsEditorCommandContext.displayName = 'DocsEditorCommands'
