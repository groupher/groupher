import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
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
    const [search, setSearch] = useState('')
    mocks.articleProps(article)
    return (
      <div data-testid='coauthors' data-search={search}>
        {article.id}
        <button type='button' onClick={() => setSearch('state-from-current-page')}>
          change local panel state
        </button>
      </div>
    )
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

  it('resets local co-author panel state when the active Doc page changes', () => {
    const { rerender } = render(<TitleActions coverVisible={false} docId='doc-a' title='A' />)

    fireEvent.click(screen.getByRole('button', { name: 'change local panel state' }))
    expect(screen.getByTestId('coauthors')).toHaveAttribute(
      'data-search',
      'state-from-current-page',
    )

    rerender(<TitleActions coverVisible={false} docId='doc-b' title='B' />)

    expect(screen.getByTestId('coauthors')).toHaveAttribute('data-search', '')
  })
})
