import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'

import type { TDocWorkingCopy } from '../Article/spec'
import { useDocsEditorStore } from './hooks'
import Provider from './provider'

const wrapper = ({ children }: { children: ReactNode }) => <Provider>{children}</Provider>

const copy: TDocWorkingCopy = {
  id: 'copy-a',
  articleId: 'doc-a',
  scopeType: 'default',
  revision: 3,
  title: 'Document A',
  slug: 'document-a',
  bodyJson: '[{"type":"p","children":[{"text":"Body"}]}]',
}

describe('DocsEditorStoreProvider', () => {
  it('creates a fresh editing session when the editor is mounted again', async () => {
    const first = renderHook(() => useDocsEditorStore(), { wrapper })
    await act(async () => {
      first.result.current.applyLoaded({
        workingCopyId: copy.id,
        body: [{ type: 'p', children: [{ text: 'Body' }] }],
        bodyJson: copy.bodyJson,
        info: {
          id: copy.articleId,
          title: copy.title,
          subtitle: '',
          slug: copy.slug ?? '',
          insertedAt: null,
          updatedAt: null,
          author: null,
          wordCount: 1,
          characterCount: 4,
        },
        source: 'draft',
        version: copy.revision,
        slug: copy.slug ?? '',
        subtitle: '',
        title: copy.title,
      })
      first.result.current.editTitle('Local change')
      await Promise.resolve()
    })
    await waitFor(() => expect(first.result.current.draft.title).toBe('Local change'))
    first.unmount()

    const reopened = renderHook(() => useDocsEditorStore(), { wrapper })

    expect(reopened.result.current.draft.docId).toBe('')
    expect(reopened.result.current.draft.title).toBe('')
    expect(reopened.result.current.savedDraft.docId).toBe('')
  })
})
