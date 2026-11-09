import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import en from '~/lib/i18n/en/main'
import zh from '~/lib/i18n/zh/main'
import LocaleProvider from '~/stores/locale/provider'

import ReplySummary from './ReplySummary'

vi.mock('./salon/reply_summary', () => ({ default: () => ({}) }))
vi.mock('~/ui/Facepile', () => ({ default: () => null }))
vi.mock('~/ui/TimeAgo', () => ({ default: () => <time>12h</time> }))

describe('reply summary translations', () => {
  it.each([
    {
      locale: 'en' as const,
      dictionary: en,
      count: '3 replies',
      last: 'Last reply',
      action: 'Expand replies',
    },
    {
      locale: 'zh' as const,
      dictionary: zh,
      count: '3 条回复',
      last: '最后回复',
      action: '展开回复',
    },
  ])(
    'renders the $locale dictionary through the real locale store',
    ({ locale, dictionary, count, last, action }) => {
      render(
        <LocaleProvider initData={{ locale, localeData: JSON.stringify(dictionary) }}>
          <ReplySummary
            participants={[]}
            count={3}
            lastReplyAt='2026-11-05T00:00:00Z'
            expanded={false}
            onToggle={() => {}}
          />
        </LocaleProvider>,
      )
      expect(screen.getByText(count)).toBeInTheDocument()
      expect(screen.getByText(last, { exact: false })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: `${count} · ${action}` })).toHaveAttribute(
        'aria-expanded',
        'false',
      )
    },
  )
})
