import { fireEvent, render, screen } from '@testing-library/react'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { makeStoreWrapper } from '~/hooks/__test__/makeStoreWrapper'

import LogoList from '.'
import type { TLogoListItem } from './spec'

const ITEMS = [
  {
    text: 'Mintlify',
    slogan: 'Modern documentation for developers.',
    href: 'https://example.com/mintlify',
    markdownHref: 'https://example.com/mintlify.md',
    logoSrc: '/icons/platform/mintlify.png',
  },
  {
    text: 'GitBook',
    slogan: 'AI-native documentation for teams.',
    href: 'https://example.com/gitbook',
    markdownHref: 'https://example.com/gitbook.md',
    logoSrc: '/icons/platform/gitbook.png',
  },
] satisfies readonly TLogoListItem[]

beforeAll(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
})

afterAll(() => vi.unstubAllGlobals())

describe('<LogoList />', () => {
  it('renders only linked logos without comma separators', () => {
    render(<LogoList items={ITEMS} suffix='…' top={2} />, {
      wrapper: makeStoreWrapper(),
    })

    expect(screen.getByRole('list')).toHaveClass('flex-nowrap', 'mt-2')
    expect(screen.getByRole('link', { name: 'Mintlify' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Mintlify' }).querySelector('img')).toMatchObject({
      src: expect.stringContaining('/icons/platform/mintlify.png'),
      width: 14,
      height: 14,
    })
    expect(screen.getByRole('link', { name: 'GitBook' })).toBeInTheDocument()
    expect(screen.getByText('…')).toBeInTheDocument()
    expect(screen.getByRole('list')).not.toHaveTextContent(',')
  })

  it('wraps only when the parent opts in', () => {
    render(<LogoList items={ITEMS} wrap />, {
      wrapper: makeStoreWrapper(),
    })

    expect(screen.getByRole('list')).toHaveClass('flex-wrap')
    expect(screen.queryByText('…')).not.toBeInTheDocument()
  })

  it('shows the brand and slogan in a tooltip on hover', async () => {
    render(<LogoList items={ITEMS} />, {
      wrapper: makeStoreWrapper(),
    })

    const link = screen.getByRole('link', { name: 'Mintlify' })
    fireEvent.mouseEnter(link.parentElement as HTMLElement)

    expect(await screen.findByText('Mintlify')).toBeVisible()
    expect(screen.getByText('Modern documentation for developers.')).toBeVisible()
    expect(screen.getByRole('tooltip').querySelector('img')).toMatchObject({
      width: 32,
      height: 32,
    })
    const docLink = screen.getByRole('link', { name: 'Read the doc' })
    expect(docLink).toHaveAttribute('href', 'https://example.com/mintlify.md')
    expect(screen.getByText('Read the doc')).toHaveClass('group-hover:underline')
    expect(docLink.querySelector('svg')).toHaveClass(
      'transition-transform',
      'group-hover:translate-x-0.5',
    )
  })
})
