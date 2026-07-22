import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import Article from '.'
import { DOC_EDITOR_MODE } from '../constant'
import { SIDE_TREE_NODE_TYPE } from '../SideTree/constant'
import type { TSideTreeController, TSideTreeGroup } from '../SideTree/spec'

const mocks = vi.hoisted(() => ({
  useLogic: vi.fn((sideTree: TSideTreeController) => {
    const activeChild = sideTree.groups
      .flatMap((group) => group.children)
      .find((child) => child.id === sideTree.activeId)
    const activePage = activeChild?.type === SIDE_TREE_NODE_TYPE.PAGE ? activeChild : null

    return {
      activePage: activePage ?? null,
      bodyValue: [{ type: 'p', children: [{ text: activePage?.title ?? '' }] }],
      editable: !!activePage,
      editorDocId: activePage?.docId ?? '',
      error: null,
      loading: false,
      setBodyValue: vi.fn(),
      setSubtitle: vi.fn(),
      setTitle: vi.fn(),
      subtitle: '',
      title: activePage?.title ?? '',
    }
  }),
}))

vi.mock('~/hooks/useEvent', () => ({ default: vi.fn() }))
vi.mock('../store/hooks', () => ({ default: () => ({ mode: DOC_EDITOR_MODE.EDIT }) }))
vi.mock('../Import/useImport', () => ({
  default: () => ({
    close: vi.fn(),
    cursor: null,
    editor: null,
    handleInserted: vi.fn(),
    show: false,
    targetDocId: null,
  }),
}))
vi.mock('./Cover/useCover', () => ({ default: () => false }))
vi.mock('./hooks/useLogic', () => ({ default: mocks.useLogic }))
vi.mock('./Body', () => ({
  default: ({ editorKey }) => <div data-testid={`body-${editorKey}`} />,
}))
vi.mock('./Cover', () => ({ default: () => <div>cover</div> }))
vi.mock('./Footer', () => ({ default: () => <div>footer</div> }))
vi.mock('./Title', () => ({
  default: ({ docId }) => <div data-testid={`article-${docId}`} />,
}))
vi.mock('./Title/Subtitle', () => ({ default: () => <div>subtitle</div> }))
vi.mock('./TitleActions', () => ({ default: () => <div>title-actions</div> }))
vi.mock('./WorkspaceActions', () => ({ default: () => <div>workspace-actions</div> }))
vi.mock('./salon', () => ({ default: () => ({ wrapper: 'wrapper', error: 'error' }) }))
vi.mock('../Import/Drawer', () => ({ default: () => null }))

const groups: TSideTreeGroup[] = [
  {
    id: 'group',
    type: SIDE_TREE_NODE_TYPE.GROUP,
    title: 'Group',
    children: [
      { id: 'page-a', type: SIDE_TREE_NODE_TYPE.PAGE, docId: 'doc-a', title: 'A' },
      { id: 'page-b', type: SIDE_TREE_NODE_TYPE.PAGE, docId: 'doc-b', title: 'B' },
    ],
  },
]

const createController = (activeId: string | null): TSideTreeController =>
  ({ activeId, groups, addGroup: vi.fn(), patchChild: vi.fn() }) as unknown as TSideTreeController

describe('Docs Article', () => {
  it('renders only the currently active document editor', () => {
    const view = render(<Article sideTree={createController('page-a')} />)

    expect(screen.getByTestId('article-doc-a')).toBeInTheDocument()
    expect(screen.getByTestId('body-doc-a')).toBeInTheDocument()

    view.rerender(<Article sideTree={createController('page-b')} />)

    expect(screen.queryByTestId('article-doc-a')).not.toBeInTheDocument()
    expect(screen.getByTestId('article-doc-b')).toBeInTheDocument()
    expect(screen.getByTestId('body-doc-b')).toBeInTheDocument()
  })

  it('renders workspace actions when no document is active', () => {
    render(<Article sideTree={createController(null)} />)

    expect(screen.getByText('workspace-actions')).toBeInTheDocument()
    expect(screen.queryByTestId(/article-/)).not.toBeInTheDocument()
  })
})
