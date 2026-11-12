import { describe, expect, it } from 'vitest'

import { SIDE_TREE_NODE_TYPE } from '../SideTree/constant'
import {
  composeDocDraftInfo,
  composeEditorDraftFromSession,
  composeEditorDraftMeta,
  composeWorkingCopySession,
  countEditorText,
} from './helper'

describe('Docs working copy editor session', () => {
  it('loads the saved body, Article identity and optimistic revision', () => {
    const session = composeWorkingCopySession(
      {
        id: 'copy-1',
        articleId: 'doc-1',
        scopeKind: 'default',
        revision: 4,
        title: 'Intro',
        slug: 'intro',
        bodyJson: '[{"type":"p","children":[{"text":"Hello"}]}]',
        threadFields: { subtitle: 'Guide' },
      },
      { id: 'page-1', type: SIDE_TREE_NODE_TYPE.PAGE, docId: 'doc-1' },
    )

    expect(session).toMatchObject({
      source: 'draft',
      version: 4,
      title: 'Intro',
      subtitle: 'Guide',
      info: { id: 'doc-1', workingCopyRevision: 4 },
      body: [{ type: 'p', children: [{ text: 'Hello' }] }],
    })

    const draft = composeEditorDraftFromSession(session)
    expect(
      composeDocDraftInfo({
        workingCopyId: session.workingCopyId,
        bodyStats: countEditorText(draft.bodyValue),
        draft,
        meta: composeEditorDraftMeta(session.info),
        publishState: null,
      }),
    ).toMatchObject({ id: 'doc-1', workingCopyRevision: 4 })
  })
})
