import { describe, expect, it } from 'vitest'

import type { TWorkspaceNode } from '../spec'
import { workspaceTabs } from './workspace'

describe('workspace navigation', () => {
  it('builds ordered groups and pages while keeping the default working copy identity', () => {
    const nodes: TWorkspaceNode[] = [
      {
        nodeId: 'page',
        parentNodeId: 'group',
        type: 'PAGE',
        title: 'Page',
        index: 1,
        hidden: false,
        published: false,
        docId: 'doc',
        workingCopyId: 'copy',
        workingCopyRevision: 3,
      },
      { nodeId: 'tab', type: 'TAB', title: 'Tab', index: 0, hidden: false },
      {
        nodeId: 'nested',
        parentNodeId: 'group',
        type: 'GROUP',
        title: 'Nested',
        index: 0,
        hidden: false,
        published: false,
      },
      {
        nodeId: 'group',
        parentNodeId: 'tab',
        type: 'GROUP',
        title: 'Group',
        index: 0,
        hidden: false,
        published: false,
      },
      {
        nodeId: 'pin',
        parentNodeId: 'tab',
        type: 'PIN',
        title: 'Link',
        href: '/link',
        index: 0,
        hidden: false,
        published: false,
      },
    ]

    const [tab] = workspaceTabs(nodes)
    expect(tab.pins[0]).toMatchObject({ id: 'pin', href: '/link' })
    expect(tab.groups[0].pages).toMatchObject([
      { id: 'nested', type: 'group', pages: [] },
      { id: 'page', type: 'page', docId: 'doc', workingCopyId: 'copy', workingCopyRevision: 3 },
    ])

    expect(tab.groups[0].pages[1]).toMatchObject({
      publishState: { published: false },
    })
  })
})
