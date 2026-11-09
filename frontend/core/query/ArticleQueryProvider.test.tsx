import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import ArticleQueryProvider, { useArticleQueryContext } from './ArticleQueryProvider'

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>()
  return { ...actual, useQuery: () => ({ data: null }) }
})
vi.mock('~/hooks/useArticleState', () => ({ default: () => null }))

function Probe() {
  const context = useArticleQueryContext()
  if (!context) return null

  return (
    <>
      <output data-testid='footer-state'>
        {JSON.stringify({ tab: context.footerTab, focus: context.mentionsFocus })}
      </output>
      <button
        type='button'
        onClick={() =>
          context.showMentions({
            type: 'COMMENT',
            articleInnerId: context.innerId,
            commentInnerId: '9',
          })
        }
      >
        Open comment mentions
      </button>
    </>
  )
}

describe('ArticleQueryProvider footer state', () => {
  afterEach(() => vi.restoreAllMocks())

  it('resets tab and focus when the viewed article changes', () => {
    vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(0)

    const { rerender } = render(
      <ArticleQueryProvider community='first' innerId='1' thread='POST'>
        <Probe />
      </ArticleQueryProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Open comment mentions' }))
    expect(screen.getByTestId('footer-state').textContent).toContain('"tab":"mentions"')
    expect(screen.getByTestId('footer-state').textContent).toContain('"commentInnerId":"9"')

    rerender(
      <ArticleQueryProvider community='second' innerId='2' thread='BLOG'>
        <Probe />
      </ArticleQueryProvider>,
    )

    expect(screen.getByTestId('footer-state').textContent).toBe(
      '{"tab":"activities","focus":{"type":"BLOG","articleInnerId":"2"}}',
    )
  })
})
