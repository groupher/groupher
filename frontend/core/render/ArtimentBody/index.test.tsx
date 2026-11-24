import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { TDocument } from '~/spec'

import ArtimentBody from './index'

vi.mock('./salon', () => ({
  default: () => ({ wrapper: '', body: '', html: '' }),
  cn: (...classes: unknown[]) => classes.filter(Boolean).join(' '),
}))

describe('Article body projection', () => {
  it('reserves the default article locator for article mode and preserves explicit overrides', () => {
    const doc = { html: '<p>Comment body</p>' } as TDocument
    const { rerender } = render(<ArtimentBody document={doc} mode='comment' />)
    expect(screen.queryByTestId('article-body')).toBeNull()
    expect(screen.getByText('Comment body')).toBeTruthy()

    rerender(<ArtimentBody document={doc} mode='comment' testid='custom-comment-body' />)
    expect(screen.getByTestId('custom-comment-body').textContent).toBe('Comment body')
    expect(screen.queryByTestId('article-body')).toBeNull()
  })

  it('renders the persisted rich body and usable links when canonical JSON is present', () => {
    render(
      <ArtimentBody
        document={
          {
            json: '[{"type":"p","children":[{"text":"Saved body"}]}]',
            html: '<p>Saved body <a href="/home/post">Read posts</a></p>',
          } as TDocument
        }
      />,
    )
    expect(screen.getByTestId('article-body').textContent).toContain('Saved body')
    expect(screen.getByRole('link', { name: 'Read posts' }).getAttribute('href')).toBe('/home/post')
  })
})
