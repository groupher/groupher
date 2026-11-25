import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'

import { ARTICLE_STAGE } from '~/const/article'

import type { TDocDraftSession } from '../Article/spec'
import CommandsProvider from '../commands/provider'
import { SIDE_TREE_NODE_TYPE } from '../SideTree/constant'
import type { TSideTreeController } from '../SideTree/spec'
import useDocsEditor from './hooks'
import { useDocsEditorStore } from './hooks'
import Provider from './provider'

const sideTree = {
  activeId: 'page-a',
  groups: [
    {
      id: 'group-a',
      type: SIDE_TREE_NODE_TYPE.GROUP,
      pages: [
        {
          id: 'page-a',
          type: SIDE_TREE_NODE_TYPE.PAGE,
          docId: 'doc-a',
          publishState: { status: ARTICLE_STAGE.PUBLIC, published: true },
        },
      ],
    },
  ],
  pins: [],
  treeState: null,
} as unknown as TSideTreeController

const wrapper = ({ children }: { children: ReactNode }) => (
  <Provider>
    <CommandsProvider sideTree={sideTree}>{children}</CommandsProvider>
  </Provider>
)

const session: TDocDraftSession = {
  workingCopyId: 'copy-a',
  publicSnapshotId: null,
  body: [{ type: 'p', children: [{ text: 'Draft body' }] }],
  bodyJson: '[{"type":"p","children":[{"text":"Draft body"}]}]',
  info: {
    id: 'doc-a',
    workingCopyId: 'copy-a',
    workingCopyRevision: 4,
    title: 'Draft title',
    subtitle: 'Subtitle',
    slug: 'draft-title',
    stage: ARTICLE_STAGE.DRAFT,
    insertedAt: null,
    updatedAt: null,
    author: null,
    publishState: { status: ARTICLE_STAGE.PUBLIC, published: true },
    wordCount: 2,
    characterCount: 9,
  },
  source: 'draft',
  version: 4,
  slug: 'draft-title',
  subtitle: 'Subtitle',
  title: 'Draft title',
}

describe('useDocsEditor derived read model', () => {
  it('derives Article and publish views from the session and current SideTree', async () => {
    const { result } = renderHook(
      () => ({ editor: useDocsEditor(), store: useDocsEditorStore() }),
      { wrapper },
    )

    await act(async () => {
      result.current.store.applyLoaded(session)
      await Promise.resolve()
    })
    await waitFor(() =>
      expect(result.current.editor.docDraftInfo).toMatchObject({
        id: 'doc-a',
        workingCopyId: 'copy-a',
        workingCopyRevision: 4,
        title: 'Draft title',
        wordCount: 2,
      }),
    )
    expect(result.current.editor.publishView).toMatchObject({
      activeDocId: 'doc-a',
      surfaceMode: 'article',
      isDirty: false,
    })

    await act(async () => {
      result.current.store.editTitle('Local title')
      await Promise.resolve()
    })
    await waitFor(() => expect(result.current.editor.docDraftInfo.title).toBe('Local title'))
    expect(result.current.editor.saveStatus).toBe('dirty')
    expect(result.current.editor.publishView.isDirty).toBe(true)
  })
})
