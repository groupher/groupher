import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor } from '@testing-library/react'

import ReferenceMap from './index'

const state = vi.hoisted(() => ({ request: vi.fn() }))

vi.mock('~/graphql/client', () => ({
  browserGraphQLRequest: state.request,
  REFERENCE_MAP_CONTENT_CHANGE: 'groupher:reference-map-content-change',
}))
vi.mock('~/hooks/useTrans', () => ({ default: () => ({ t: (key: string) => key }) }))

const node = (id: string) => ({
  id,
  type: 'POST',
  articleInnerId: id,
  commentInnerId: null,
  branchId: null,
  title: id,
  url: `/home/post/${id}`,
  syncState: 'READY',
})

const edge = (from: string, to: string) => ({
  id: `${from}-${to}`,
  from,
  to,
  occurrencesCount: 1,
})

const commentNode = (id: string) => ({
  ...node(id),
  id: `comment-${id}`,
  type: 'COMMENT',
  articleInnerId: '1',
  commentInnerId: id,
  title: `comment-${id}`,
  url: `/home/post/1#comment-${id}`,
})

it('includes paged references from the Article’s own Comments with their real direction', async () => {
  state.request.mockReset()
  state.request.mockImplementation(
    async (
      _document: unknown,
      variables: {
        frontiers?: { node: { type: string; articleInnerId: string; commentInnerId?: string } }[]
        after?: string | null
      },
    ) => {
      if (!variables.frontiers) {
        return {
          referenceMapArticleComments: variables.after
            ? {
                comments: [{ type: 'COMMENT', articleInnerId: '1', commentInnerId: '2' }],
                hasNextPage: false,
                endCursor: null,
              }
            : {
                comments: [{ type: 'COMMENT', articleInnerId: '1', commentInnerId: '1' }],
                hasNextPage: true,
                endCursor: '1',
              },
        }
      }
      const nodes = new Map<string, ReturnType<typeof node> | ReturnType<typeof commentNode>>()
      const edges: ReturnType<typeof edge>[] = []
      const neighborhoods = variables.frontiers.map(({ node: frontier }, requestIndex) => {
        const source =
          frontier.type === 'COMMENT'
            ? `comment-${frontier.commentInnerId}`
            : frontier.articleInnerId
        nodes.set(
          source,
          frontier.type === 'COMMENT'
            ? commentNode(frontier.commentInnerId!)
            : node(frontier.articleInnerId),
        )
        const entry =
          source === 'comment-1'
            ? edge(source, '1')
            : source === 'comment-2'
              ? edge(source, '2')
              : null
        if (entry) {
          edges.push(entry)
          nodes.set(entry.to, node(entry.to))
        }
        return {
          requestIndex,
          state: 'AVAILABLE',
          nodeId: source,
          edgeIds: entry ? [entry.id] : [],
          hasNextPage: false,
          endCursor: null,
        }
      })
      return {
        referenceMap: {
          nodes: [...nodes.values()],
          edges,
          neighborhoods,
          projectionPending: false,
        },
      }
    },
  )

  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <ReferenceMap community='home' focus={{ type: 'POST', articleInnerId: '1' }} />
    </QueryClientProvider>,
  )

  await waitFor(() => expect(screen.getByText('reference_map.complete')).toBeInTheDocument())
  expect(screen.getAllByRole('listitem')).toHaveLength(2)
  expect(
    screen.getByRole('link', { name: 'reference_map.linked_comment: comment-1' }),
  ).toBeInTheDocument()
  expect(
    screen.getByRole('link', { name: 'reference_map.linked_comment: comment-2' }),
  ).toBeInTheDocument()
  expect(state.request.mock.calls.filter((call) => !call[1].frontiers)).toHaveLength(2)
})

it('keeps an Article map pending for an unsynchronized Comment without drawing an orphan', async () => {
  state.request.mockReset()
  state.request.mockImplementation(
    async (
      _document: unknown,
      variables: {
        frontiers?: { node: { type: string; articleInnerId: string } }[]
      },
    ) => {
      if (!variables.frontiers)
        return {
          referenceMapArticleComments: {
            comments: [{ type: 'COMMENT', articleInnerId: '1', commentInnerId: '9' }],
            hasNextPage: false,
            endCursor: null,
          },
        }
      return {
        referenceMap: {
          nodes: [node('1'), { ...commentNode('9'), syncState: 'PENDING' }],
          edges: [],
          neighborhoods: variables.frontiers.map((_, requestIndex) => ({
            requestIndex,
            state: 'AVAILABLE',
            nodeId: requestIndex === 0 ? '1' : 'comment-9',
            edgeIds: [],
            hasNextPage: false,
            endCursor: null,
          })),
          projectionPending: true,
        },
      }
    },
  )

  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <ReferenceMap community='home' focus={{ type: 'POST', articleInnerId: '1' }} />
    </QueryClientProvider>,
  )

  await waitFor(() => expect(screen.getByText('reference_map.pending')).toBeInTheDocument())
  expect(screen.queryByRole('link', { name: /comment-9/ })).not.toBeInTheDocument()
  expect(screen.getAllByRole('link')).toHaveLength(1)
})

it('loads a directed cycle once and keeps both directions in the readable list', async () => {
  state.request.mockReset()
  state.request.mockImplementation(
    async (
      _document: unknown,
      variables: {
        frontiers?: { node: { articleInnerId: string } }[]
      },
    ) => {
      if (!variables.frontiers)
        return {
          referenceMapArticleComments: {
            comments: [],
            hasNextPage: false,
            endCursor: null,
          },
        }
      const id = variables.frontiers[0]?.node.articleInnerId
      const entries =
        id === '1' ? [edge('1', '2')] : id === '2' ? [edge('2', '3')] : [edge('3', '2')]
      const nodes =
        id === '1'
          ? [node('1'), node('2')]
          : id === '2'
            ? [node('2'), node('3')]
            : [node('3'), node('2')]
      return {
        referenceMap: {
          nodes,
          edges: entries,
          neighborhoods: [
            {
              requestIndex: 0,
              state: 'AVAILABLE',
              nodeId: id,
              edgeIds: entries.map((entry) => entry.id),
              hasNextPage: false,
              endCursor: null,
            },
          ],
          projectionPending: false,
        },
      }
    },
  )

  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <ReferenceMap community='home' focus={{ type: 'POST', articleInnerId: '1' }} />
    </QueryClientProvider>,
  )

  await waitFor(() => expect(screen.getByText('reference_map.complete')).toBeInTheDocument())
  expect(state.request).toHaveBeenCalledTimes(4)
  expect(screen.getAllByRole('listitem')).toHaveLength(3)
  expect(screen.getByRole('img', { name: 'reference_map.graph' })).toBeInTheDocument()

  act(() => window.dispatchEvent(new Event('groupher:reference-map-content-change')))
  await waitFor(() => expect(state.request).toHaveBeenCalledTimes(8))
  expect(screen.getAllByRole('listitem')).toHaveLength(3)

  state.request.mockRejectedValueOnce(new Error('network unavailable'))
  act(() => window.dispatchEvent(new Event('groupher:reference-map-content-change')))
  await waitFor(() => expect(screen.getByText('reference_map.failed')).toBeInTheDocument())
  expect(screen.getAllByRole('listitem')).toHaveLength(3)
})

it('reloads once for a changed revision and preserves the graph on a later unchanged check', async () => {
  state.request.mockReset()
  const revisions = ['revision-1', 'revision-2', 'revision-2']
  const interval = vi.spyOn(window, 'setInterval')
  state.request.mockImplementation(
    async (
      _document: unknown,
      variables: {
        frontiers?: unknown[]
        first?: number
      },
    ) => {
      if (!variables.frontiers && variables.first)
        return {
          referenceMapArticleComments: {
            comments: [],
            hasNextPage: false,
            endCursor: null,
          },
        }
      if (!variables.frontiers) return { referenceMapRevision: revisions.shift() }
      return {
        referenceMap: {
          nodes: [node('1')],
          edges: [],
          neighborhoods: [
            {
              requestIndex: 0,
              state: 'AVAILABLE',
              nodeId: '1',
              edgeIds: [],
              hasNextPage: false,
              endCursor: null,
            },
          ],
          projectionPending: false,
        },
      }
    },
  )

  try {
    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <ReferenceMap community='home' focus={{ type: 'POST', articleInnerId: '1' }} />
      </QueryClientProvider>,
    )
    await waitFor(() => expect(screen.getByText('reference_map.empty')).toBeInTheDocument())
    const verify = interval.mock.calls.find((call) => call[1] === 30_000)?.[0]
    expect(verify).toBeTypeOf('function')

    await act(async () => {
      await verify?.()
    })
    await act(async () => {
      await verify?.()
    })
    await waitFor(() =>
      expect(state.request.mock.calls.filter((call) => Boolean(call[1].frontiers))).toHaveLength(2),
    )
    await act(async () => {
      await verify?.()
    })
    expect(state.request.mock.calls.filter((call) => Boolean(call[1].frontiers))).toHaveLength(2)
    expect(screen.getByText('reference_map.empty')).toBeInTheDocument()
  } finally {
    interval.mockRestore()
  }
})
