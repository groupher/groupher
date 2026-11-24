import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { TDocument } from '~/spec'

import ArtimentBody from './index'

vi.mock('./salon', () => ({
  default: () => ({ wrapper: '', body: '', html: '' }),
  cn: (...classes: unknown[]) => classes.filter(Boolean).join(' '),
}))

describe('Article body projection', () => {
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
