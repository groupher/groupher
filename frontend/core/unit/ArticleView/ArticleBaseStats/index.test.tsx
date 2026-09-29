import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { TArticle } from '~/spec'

import ArticleBaseStats from '.'

vi.mock('~/dom', () => ({ scrollToComments: vi.fn() }))
vi.mock('~/icons/article/Viewed', () => ({ default: () => <span data-testid='view-icon' /> }))
vi.mock('~/icons/Comment', () => ({ default: () => <span data-testid='comment-icon' /> }))
vi.mock('./salon', () => ({
  default: () => ({
    commentBox: 'comment-box',
    commentCount: 'comment-count',
    commentIcon: 'comment-icon',
    count: 'pretty-num text-base',
    divider: 'divider',
    viewsIcon: 'views-icon',
    wrapper: 'wrapper',
  }),
}))

describe('ArticleBaseStats', () => {
  it('reserves the detail slot while the Summary is loading', () => {
    const article = {} as unknown as TArticle

    render(<ArticleBaseStats article={article} stats={null} />)

    const count = screen.getByLabelText('views')
    expect(count).toHaveClass('view-count-slot-detail')
    expect(count).toHaveClass('pretty-num')
    expect(count).toBeEmptyDOMElement()
  })
})
