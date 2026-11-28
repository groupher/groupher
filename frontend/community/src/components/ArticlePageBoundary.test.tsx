import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { StrictMode, useContext } from 'react'
import { renderToString } from 'react-dom/server'
import { beforeEach, expect, it, vi } from 'vitest'

import { ArticleListSearchContext } from '~/hooks/useArticleListSearch'

const recovery = vi.hoisted(() => ({
  refresh: vi.fn(),
  reset: vi.fn(),
  navigate: vi.fn(),
  location: { pathname: '/home/post', searchStr: '', hash: '' },
}))
vi.mock('../query/articleSurface', () => ({
  refreshArticleBootstrap: recovery.refresh,
  resetArticleSurface: recovery.reset,
}))
vi.mock('@tanstack/react-router', () => ({
  useLocation: () => recovery.location,
  useNavigate: () => recovery.navigate,
}))
vi.mock('~/ui/Buttons/Button', () => ({
  default: ({
    ariaLabel,
    children,
    disabled,
    onClick,
  }: React.PropsWithChildren<{ ariaLabel: string; disabled: boolean; onClick: () => void }>) => (
    <button aria-label={ariaLabel} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  ),
}))

vi.mock('./PositionResetNotice', () => ({ default: () => <p>Position reset</p> }))

import ArticlePageBoundary from './ArticlePageBoundary'

beforeEach(() => {
  vi.resetAllMocks()
  recovery.location = { pathname: '/home/post', searchStr: '', hash: '' }
})

it('hydrates the failure shell, refreshing bootstrap before mounting any list child', async () => {
  const client = new QueryClient()
  let complete: () => void
  recovery.refresh.mockReturnValue(
    new Promise<void>((resolve) => {
      complete = resolve
    }),
  )
  const tree = (
    <QueryClientProvider client={client}>
      <div>Community shell</div>
      <ArticlePageBoundary community='home' surface='posts' recovery='bootstrap'>
        List mounted
      </ArticlePageBoundary>
    </QueryClientProvider>
  )
  expect(renderToString(tree)).toContain('列表加载失败')
  expect(recovery.refresh).not.toHaveBeenCalled()
  render(<StrictMode>{tree}</StrictMode>)
  expect(screen.getByText('Community shell')).toBeTruthy()
  expect(screen.queryByText('List mounted')).toBeNull()
  expect(recovery.refresh).toHaveBeenCalledTimes(1)
  await act(async () => complete())
  expect(screen.getByText('List mounted')).toBeTruthy()
  expect(recovery.reset).toHaveBeenCalledWith(client, 'home', 'posts')
})

it('keeps failed bootstrap recovery retryable without an automatic request loop', async () => {
  recovery.refresh.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(undefined)
  await act(async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <ArticlePageBoundary community='home' surface='changelogs' recovery='bootstrap'>
          List mounted
        </ArticlePageBoundary>
      </QueryClientProvider>,
    )
  })
  expect(screen.getByRole('button').hasAttribute('disabled')).toBe(false)
  expect(recovery.refresh).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByRole('button'))
  await screen.findByText('List mounted')
  expect(recovery.refresh).toHaveBeenCalledTimes(2)
})

it('does not auto retry or refresh bootstrap for non-revision failures', () => {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ArticlePageBoundary community='home' surface='posts' recovery='list'>
        List mounted
      </ArticlePageBoundary>
    </QueryClientProvider>,
  )
  expect(recovery.refresh).not.toHaveBeenCalled()
  expect(screen.queryByText('List mounted')).toBeNull()
  fireEvent.click(screen.getByRole('button'))
  expect(screen.getByText('List mounted')).toBeTruthy()
  expect(recovery.refresh).not.toHaveBeenCalled()
})

it('does not reset or navigate the abandoned surface when bootstrap resolves after unmount', async () => {
  let complete: () => void
  recovery.refresh.mockReturnValue(
    new Promise<void>((resolve) => {
      complete = resolve
    }),
  )
  const { unmount } = render(
    <QueryClientProvider client={new QueryClient()}>
      <ArticlePageBoundary community='home' surface='posts' recovery='bootstrap'>
        List
      </ArticlePageBoundary>
    </QueryClientProvider>,
  )
  unmount()
  await act(async () => complete())
  expect(recovery.reset).not.toHaveBeenCalled()
  expect(recovery.navigate).not.toHaveBeenCalled()
})

it('clears the invalid position and releases the recovered search after navigation', async () => {
  recovery.location = {
    pathname: '/home/post',
    searchStr: '?after=invalid&order=publish',
    hash: 'section',
  }
  function Probe() {
    const recovered = useContext(ArticleListSearchContext)
    return <span data-testid='recovered'>{recovered ?? 'current URL'}</span>
  }
  const makeTree = () => (
    <QueryClientProvider client={client}>
      <ArticlePageBoundary
        community='home'
        surface='posts'
        recovery={null}
        recoveredSearch='order=publish'
      >
        <Probe />
      </ArticlePageBoundary>
    </QueryClientProvider>
  )
  const client = new QueryClient()
  const view = render(makeTree())
  expect(recovery.navigate).toHaveBeenCalledWith({
    href: '/home/post?order=publish#section',
    replace: true,
  })
  expect(screen.getByTestId('recovered').textContent).toBe('order=publish')
  recovery.location = { pathname: '/home/post', searchStr: '?order=publish', hash: 'section' }
  view.rerender(makeTree())
  await act(async () => {})
  expect(screen.getByTestId('recovered').textContent).toBe('current URL')
  recovery.location = { pathname: '/home/post', searchStr: '?order=UPVOTES', hash: 'section' }
  view.rerender(makeTree())
  expect(screen.getByTestId('recovered').textContent).toBe('current URL')
  expect(recovery.navigate).toHaveBeenCalledTimes(1)
  expect(screen.getByText('Position reset')).toBeTruthy()
})

it('cleans a confirmed invalid position while showing the list error', () => {
  recovery.location = {
    pathname: '/home/post',
    searchStr: '?after=invalid&order=publish',
    hash: 'section',
  }
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ArticlePageBoundary
        community='home'
        surface='posts'
        recovery='list'
        recoveredSearch='order=publish'
      >
        List
      </ArticlePageBoundary>
    </QueryClientProvider>,
  )
  expect(recovery.navigate).toHaveBeenCalledWith({
    href: '/home/post?order=publish#section',
    replace: true,
  })
  expect(screen.queryByText('List')).toBeNull()
})
