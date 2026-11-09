import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import en from '~/lib/i18n/en/main'
import zh from '~/lib/i18n/zh/main'
import type { TComment } from '~/spec'
import LocaleProvider from '~/stores/locale/provider'

import FoldLayout from './FoldLayout'

const { expandComment } = vi.hoisted(() => ({ expandComment: vi.fn() }))
vi.mock('../../useLogic/useActions', () => ({ default: () => ({ expandComment }) }))
vi.mock('../salon/desktop_view/fold_layout', () => ({
  default: () => ({}),
  cn: (...values: string[]) => values.join(' '),
}))
vi.mock('~/Img', () => ({ default: () => null }))

const comment: TComment = {
  innerId: '7',
  body: { html: '<p>Folded root</p>' },
  isFolded: true,
  repliesCount: 0,
  hasReplyEntries: true,
}

describe('folded reply history', () => {
  it.each([
    { locale: 'en' as const, dictionary: en, history: 'View reply history' },
    { locale: 'zh' as const, dictionary: zh, history: '查看回复记录' },
  ])('exposes deleted history on the folded root in $locale', ({ locale, dictionary, history }) => {
    expandComment.mockClear()
    render(
      <LocaleProvider initData={{ locale, localeData: JSON.stringify(dictionary) }}>
        <FoldLayout data={comment} />
      </LocaleProvider>,
    )
    const control = screen.getByRole('button', { name: new RegExp(history) })
    expect(screen.getAllByRole('button')).toHaveLength(1)
    expect(control.querySelector('button')).toBeNull()
    fireEvent.click(control)
    expect(expandComment).toHaveBeenCalledExactlyOnceWith('7')
  })

  it('does not advertise history when the root has no reply entries', () => {
    render(
      <LocaleProvider initData={{ locale: 'en', localeData: JSON.stringify(en) }}>
        <FoldLayout data={{ ...comment, hasReplyEntries: false }} />
      </LocaleProvider>,
    )
    expect(screen.queryByText('View reply history')).not.toBeInTheDocument()
  })

  it('keeps the effective count for a folded root with active replies', () => {
    render(
      <LocaleProvider initData={{ locale: 'en', localeData: JSON.stringify(en) }}>
        <FoldLayout data={{ ...comment, repliesCount: 2 }} />
      </LocaleProvider>,
    )
    expect(screen.getByRole('button', { name: /2 replies/ })).toBeInTheDocument()
    expect(screen.queryByText('View reply history')).not.toBeInTheDocument()
  })
})
