import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'

const navigate = vi.hoisted(() => vi.fn())
vi.mock('@tanstack/react-router', () => ({
  Link: () => null,
  useLocation: () => ({ pathname: '/home/changelog', hash: 'section' }),
  useNavigate: () => navigate,
}))
vi.mock('~/hooks/useArticleListSearch', () => ({
  default: () => new URLSearchParams('order=publish'),
}))
vi.mock('~/hooks/useLayout', () => ({ default: () => ({ communityLayout: 'SIMPLE' }) }))
vi.mock('~/hooks/usePagedChangelogs', () => ({
  default: () => ({ pagedChangelogs: { entries: [] }, paginationApi: 'offset' }),
}))
vi.mock('~/hooks/usePagiConfig', () => ({ default: () => ({ config: { api: 'offset' } }) }))
vi.mock('~/hooks/useTrans', () => ({ default: () => ({ t: (value: string) => value }) }))
vi.mock('~/stores/community/hooks', () => ({ default: () => ({ slug: 'home' }) }))
vi.mock('~/stores/dsb/hooks', () => ({ default: () => ({}) }))
vi.mock('~/ui/Pagi', () => ({
  default: ({ onChange }: { onChange: (page: number) => void }) => (
    <button type='button' onClick={() => onChange(2)}>
      Next page
    </button>
  ),
}))
vi.mock('./ClassicLayout', () => ({ default: () => null }))
vi.mock('./SimpleLayout', () => ({ default: () => null }))

import ChangelogSurface from './Surface'

beforeEach(() => navigate.mockReset())

it('preserves the hash when changing changelog pages', () => {
  render(<ChangelogSurface />)
  fireEvent.click(screen.getByRole('button', { name: 'Next page' }))
  expect(navigate).toHaveBeenCalledWith({
    to: '/home/changelog?order=publish&page=2',
    hash: 'section',
  })
})
