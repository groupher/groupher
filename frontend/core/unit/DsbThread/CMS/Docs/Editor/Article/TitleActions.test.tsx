import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import TitleActions from './TitleActions'

const mocks = vi.hoisted(() => ({ articleProps: vi.fn() }))

vi.mock('~/hooks/useTrans', () => ({ default: () => ({ t: (key: string) => key }) }))
vi.mock('./salon/title_actions', () => ({
  default: () => ({
    coverAction: 'cover-action',
    icon: 'icon',
    importAction: 'import-action',
    label: 'label',
    wrapper: 'wrapper',
  }),
}))
vi.mock('../../../ArticleCoAuthors', () => ({
  default: ({ article }: { article: { id: string; title: string; innerId?: number } }) => {
    mocks.articleProps(article)
    return <div data-testid='coauthors'>{article.id}</div>
  },
}))

describe('Docs Article title actions', () => {
  it('opens co-author management for the active Article identity', () => {
    render(<TitleActions coverVisible={false} docId='doc-id' title='Current title' />)

    expect(screen.getByTestId('coauthors')).toHaveTextContent('doc-id')
    expect(mocks.articleProps).toHaveBeenCalledWith({
      id: 'doc-id',
      title: 'Current title',
    })
  })
})
