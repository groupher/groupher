import { describe, expect, it } from 'vitest'

import { ARTICLE_STAGE } from '~/const/article'

import { SIDE_TREE_NODE_TYPE } from '../SideTree/constant'
import type { TSideTreePage } from '../SideTree/spec'
import { composeLoadedDraftSession, resolveDraftSource } from './helper'

const activePage: TSideTreePage = {
  id: 'page-1',
  type: SIDE_TREE_NODE_TYPE.PAGE,
  title: 'Intro',
  docId: 'doc-1',
  publishState: {
    status: ARTICLE_STAGE.PUBLIC,
    published: true,
  },
}

describe('docs editor article helper', () => {
  it('marks editor fallback content as public source', () => {
    const session = composeLoadedDraftSession(
      {
        id: 'article-1',
        docId: 'doc-1',
        title: 'Published intro',
        stage: ARTICLE_STAGE.PUBLIC,
      },
      activePage,
    )

    expect(session.source).toBe('public')
    expect(resolveDraftSource({ stage: ARTICLE_STAGE.PUBLIC })).toBe('public')
  })

  it('marks loaded draft content as draft source', () => {
    const session = composeLoadedDraftSession(
      {
        id: 'article-2',
        docId: 'doc-1',
        title: 'Draft intro',
        stage: ARTICLE_STAGE.DRAFT,
      },
      activePage,
    )

    expect(session.source).toBe('draft')
    expect(resolveDraftSource({ stage: ARTICLE_STAGE.DRAFT })).toBe('draft')
  })
})
