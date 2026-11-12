'use client'

import type { FC } from 'react'

import EditorContent from './EditorContent'
import DocsEditorStoreProvider from './store/provider'

const Editor: FC = () => (
  <DocsEditorStoreProvider>
    <EditorContent />
  </DocsEditorStoreProvider>
)

export default Editor
