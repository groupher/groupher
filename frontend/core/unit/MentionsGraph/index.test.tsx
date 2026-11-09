import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { print } from 'graphql'

import { GraphQLRequestError } from '~/graphql/client'
import type { MentionsGraphPageQuery } from '~/lib/graphql/generated/graphql'
import { mentionsGraphQueries } from '~/query/mentionsGraph'

import MentionsGraph from './index'

const state = vi.hoisted(() => ({ request: vi.fn() }))

vi.mock('~/graphql/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('~/graphql/client')>()),
  browserGraphQLRequest: state.request,
  MENTIONS_GRAPH_CONTENT_CHANGE: 'groupher:mentions-graph-content-change',
}))
vi.mock('~/hooks/useTrans', () => ({ default: () => ({ t: (key: string) => key, locale: 'en' }) }))

const focus = { type: 'POST' as const, articleInnerId: '1' }

function page() {
  const focusNode = {
    id: 'focus',
    type: 'POST',
    status: 'READABLE',
    title: 'Source',
    url: '/home/post/1',
    locator: focus,
    canOpen: true,
  }
  const targetNode = {
    ...focusNode,
    id: 'target',
    title: 'Target',
    url: '/home/post/2',
    locator: { type: 'POST', articleInnerId: '2', commentInnerId: null },
  }

  return {
    revision: '1',
    nodes: [focusNode, targetNode],
    edges: [{ id: 'edge', from: 'focus', to: 'target', occurrencesCount: 1 }],
    hasNextPage: false,
    endCursor: null as string | null,
  }
}

it('loads one first-page request only when the Mentions view mounts', async () => {
  state.request
    .mockReset()
    .mockImplementation(async (document) =>
      print(document).includes('query MentionsGraphRevision')
        ? { mentionsGraphRevision: '1' }
        : { mentionsGraph: page() },
    )
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })

  render(
    <QueryClientProvider client={client}>
      <MentionsGraph community='home' focus={focus} />
    </QueryClientProvider>,
  )

  await waitFor(() => expect(screen.getByText('mentions_graph.complete')).toBeInTheDocument())
  const relation = screen.getByRole('listitem')
  expect(within(relation).getByRole('link', { name: 'Source' })).toBeInTheDocument()
  expect(within(relation).getByRole('link', { name: 'Target' })).toBeInTheDocument()
  const pageRequest = state.request.mock.calls.find(
    ([document]) => !print(document).includes('query MentionsGraphRevision'),
  )
  expect(pageRequest).toBeDefined()
  expect(state.request).toHaveBeenCalledTimes(2)
  expect(pageRequest?.[1]).toEqual({
    community: 'home',
    focus,
    after: null,
    first: 20,
  })
})

it('keeps both direct relationship pages after loading more', async () => {
  state.request.mockReset().mockImplementation(async (document, variables) => {
    if (print(document).includes('query MentionsGraphRevision')) {
      return { mentionsGraphRevision: '1' }
    }
    const result = page()
    if (variables.after) {
      result.nodes[1].id = 'second-target'
      result.nodes[1].title = 'Second target'
      result.edges[0].id = 'second-edge'
      result.edges[0].to = 'second-target'
    } else {
      result.hasNextPage = true
      result.endCursor = 'next-page'
    }
    return { mentionsGraph: result }
  })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <MentionsGraph community='home' focus={focus} />
    </QueryClientProvider>,
  )

  fireEvent.click(await screen.findByRole('button', { name: 'mentions_graph.more' }))
  await screen.findByRole('link', { name: 'Second target' })
  expect(screen.getByRole('link', { name: 'Target' })).toBeInTheDocument()
  expect(screen.getAllByRole('listitem')).toHaveLength(2)
  expect(screen.queryByRole('button', { name: 'mentions_graph.more' })).not.toBeInTheDocument()
})

it('keeps a restricted node title and link alongside its status', async () => {
  state.request.mockReset().mockImplementation(async (document) => {
    if (print(document).includes('query MentionsGraphRevision'))
      return { mentionsGraphRevision: '1' }
    const result = page()
    result.nodes[1].status = 'UNAVAILABLE'
    return { mentionsGraph: result }
  })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })

  render(
    <QueryClientProvider client={client}>
      <MentionsGraph community='home' focus={focus} />
    </QueryClientProvider>,
  )

  const target = await screen.findByRole('link', {
    name: 'Target (mentions_graph.node.unavailable)',
  })
  expect(target).toHaveAttribute('href', '/home/post/2')
})

it('links an unnumbered Article through its stable ID locator', async () => {
  const articleId = 'f415cb77-93e7-4169-81e1-f60e665e2d87'
  state.request.mockReset().mockImplementation(async (document) => {
    if (print(document).includes('query MentionsGraphRevision'))
      return { mentionsGraphRevision: '1' }
    const result = page() as unknown as MentionsGraphPageQuery['mentionsGraph']
    result.nodes[1].locator = {
      type: 'POST',
      articleId,
      articleInnerId: null,
      commentInnerId: null,
    }
    result.nodes[1].url = `/home/post/${articleId}`
    return { mentionsGraph: result }
  })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })

  render(
    <QueryClientProvider client={client}>
      <MentionsGraph community='home' focus={focus} />
    </QueryClientProvider>,
  )

  expect(await screen.findByRole('link', { name: 'Target' })).toHaveAttribute(
    'href',
    `/home/post/${articleId}`,
  )
  expect(state.request).toHaveBeenCalledTimes(2)
})

it('drops a rejected cursor and returns to one fresh first page', async () => {
  let firstPages = 0
  let cursorCalls = 0
  state.request.mockReset().mockImplementation(async (document, variables) => {
    if (print(document).includes('MentionsGraphRevision')) return { mentionsGraphRevision: '1' }
    if (variables.after) {
      cursorCalls++
      throw new GraphQLRequestError(Response.json({}), [
        { message: 'stale', extensions: { code: 4551 } },
      ])
    }
    firstPages++
    const result = page()
    result.hasNextPage = firstPages === 1
    result.endCursor = firstPages === 1 ? 'stale-cursor' : null
    return { mentionsGraph: result }
  })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const { unmount } = render(
    <QueryClientProvider client={client}>
      <MentionsGraph community='home' focus={focus} />
    </QueryClientProvider>,
  )
  try {
    const more = await screen.findByRole('button', { name: 'mentions_graph.more' })
    fireEvent.click(more)
    await waitFor(() => expect(firstPages).toBe(2))
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'mentions_graph.more' })).not.toBeInTheDocument(),
    )
    expect(cursorCalls).toBe(1)
    expect(screen.getByRole('link', { name: 'Target' })).toBeInTheDocument()
  } finally {
    unmount()
    client.clear()
  }
})

it('hides cached graph data after a non-recoverable page error and retries from the first page', async () => {
  let firstPages = 0
  let cursorCalls = 0
  state.request.mockReset().mockImplementation(async (document, variables) => {
    if (print(document).includes('MentionsGraphRevision')) return { mentionsGraphRevision: '1' }
    if (variables.after) {
      cursorCalls++
      throw new GraphQLRequestError(Response.json({}), [
        { message: 'denied', extensions: { code: 4549 } },
      ])
    }
    firstPages++
    const result = page()
    result.hasNextPage = firstPages === 1
    result.endCursor = firstPages === 1 ? 'old-cursor' : null
    return { mentionsGraph: result }
  })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const { unmount } = render(
    <QueryClientProvider client={client}>
      <MentionsGraph community='home' focus={focus} />
    </QueryClientProvider>,
  )
  try {
    fireEvent.click(await screen.findByRole('button', { name: 'mentions_graph.more' }))
    await screen.findByText('mentions_graph.failed')
    expect(screen.queryByRole('link', { name: 'Target' })).not.toBeInTheDocument()
    expect(cursorCalls).toBe(1)
    fireEvent.click(screen.getByRole('button', { name: 'mentions_graph.recheck' }))
    await waitFor(() => expect(firstPages).toBe(2))
    expect(screen.getByRole('link', { name: 'Target' })).toBeInTheDocument()
    expect(cursorCalls).toBe(1)
  } finally {
    unmount()
    client.clear()
  }
})

it('cancels the graph request when the Mentions view unmounts', async () => {
  state.request.mockReset().mockImplementation(() => new Promise(() => {}))
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const { unmount } = render(
    <QueryClientProvider client={client}>
      <MentionsGraph community='home' focus={focus} />
    </QueryClientProvider>,
  )

  try {
    await waitFor(() => expect(state.request).toHaveBeenCalled())
    await act(async () => unmount())
    expect(state.request.mock.calls[0][2]?.signal?.aborted).toBe(true)
  } finally {
    client.clear()
  }
})

it('refreshes the graph when its active revision query observes a change', async () => {
  let revision = '1'
  state.request.mockReset().mockImplementation(async (document) => {
    if (print(document).includes('query MentionsGraphRevision')) {
      return { mentionsGraphRevision: revision }
    }

    return { mentionsGraph: { ...page(), revision } }
  })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const revisionKey = mentionsGraphQueries.revisionKey('home', focus)
  client.setQueryData(revisionKey, revision)

  render(
    <QueryClientProvider client={client}>
      <MentionsGraph community='home' focus={focus} />
    </QueryClientProvider>,
  )

  await waitFor(() => expect(screen.getByText('mentions_graph.complete')).toBeInTheDocument())
  const pageRequests = () =>
    state.request.mock.calls.filter(
      ([document]) => !print(document).includes('MentionsGraphRevision'),
    )
  expect(pageRequests()).toHaveLength(1)

  revision = '2'
  await act(async () => client.setQueryData(revisionKey, revision))

  await waitFor(() => expect(pageRequests()).toHaveLength(2))
  client.clear()
})

it('starts one fresh focus page when the Community changes', async () => {
  state.request
    .mockReset()
    .mockImplementation(async (document) =>
      print(document).includes('query MentionsGraphRevision')
        ? { mentionsGraphRevision: '1' }
        : { mentionsGraph: page() },
    )
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const { rerender, unmount } = render(
    <QueryClientProvider client={client}>
      <MentionsGraph community='home' focus={focus} />
    </QueryClientProvider>,
  )
  try {
    await screen.findByRole('link', { name: 'Target' })
    rerender(
      <QueryClientProvider client={client}>
        <MentionsGraph community='another' focus={focus} />
      </QueryClientProvider>,
    )
    await waitFor(() =>
      expect(state.request.mock.calls.some(([, input]) => input.community === 'another')).toBe(
        true,
      ),
    )
    const newPages = state.request.mock.calls.filter(
      ([document, input]) =>
        input.community === 'another' && !print(document).includes('MentionsGraphRevision'),
    )
    expect(newPages).toHaveLength(1)
    expect(newPages[0][1].after).toBeNull()
  } finally {
    unmount()
    client.clear()
  }
})

it('keeps a shared request alive until its final mounted observer leaves', async () => {
  state.request.mockReset().mockImplementation(() => new Promise(() => {}))
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const { rerender, unmount } = render(
    <QueryClientProvider client={client}>
      <MentionsGraph key='first' community='home' focus={focus} />
      <MentionsGraph key='second' community='home' focus={focus} />
    </QueryClientProvider>,
  )
  try {
    await waitFor(() => expect(state.request).toHaveBeenCalledTimes(2))
    const pageRequest = state.request.mock.calls.find(
      ([document]) => !print(document).includes('MentionsGraphRevision'),
    )
    const signal = pageRequest?.[2].signal
    rerender(
      <QueryClientProvider client={client}>
        <MentionsGraph key='second' community='home' focus={focus} />
      </QueryClientProvider>,
    )
    expect(signal.aborted).toBe(false)
    unmount()
    expect(signal.aborted).toBe(true)
  } finally {
    client.clear()
  }
})

it('clears previously readable graph fields before refetching a changed revision', async () => {
  let holdRefresh = false
  state.request.mockReset().mockImplementation(async (document) => {
    if (print(document).includes('MentionsGraphRevision')) return { mentionsGraphRevision: '1' }
    if (holdRefresh) return new Promise(() => {})
    return { mentionsGraph: page() }
  })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  client.setQueryData(mentionsGraphQueries.revisionKey('home', focus), '1')
  const { unmount } = render(
    <QueryClientProvider client={client}>
      <MentionsGraph community='home' focus={focus} />
    </QueryClientProvider>,
  )
  try {
    await screen.findByRole('link', { name: 'Target' })
    holdRefresh = true
    await act(async () => client.setQueryData(mentionsGraphQueries.revisionKey('home', focus), '2'))
    await waitFor(() =>
      expect(
        state.request.mock.calls.filter(
          ([document]) => !print(document).includes('MentionsGraphRevision'),
        ),
      ).toHaveLength(2),
    )
    expect(screen.queryByRole('link', { name: 'Target' })).not.toBeInTheDocument()
  } finally {
    unmount()
    client.clear()
  }
})
