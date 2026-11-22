import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import ArticleCoAuthors from './ArticleCoAuthors'

const mocks = vi.hoisted(() => ({
  accountLogin: 'owner',
  browserGraphQLRequest: vi.fn(),
  executeCommand: vi.fn(),
  invalidatePrefix: vi.fn(),
  toast: vi.fn(),
}))

vi.mock('~/graphql/client', () => ({ browserGraphQLRequest: mocks.browserGraphQLRequest }))
vi.mock('~/hooks/useTrans', () => ({ default: () => ({ t: (key: string) => key }) }))
vi.mock('~/query/invalidation', () => ({ invalidatePrefix: mocks.invalidatePrefix }))
vi.mock('~/query/mutation/optimistic/execute', () => ({ executeCommand: mocks.executeCommand }))
vi.mock('~/stores/account/hooks', () => ({
  default: () => ({ accountScope: 'test-account-scope', user: { login: mocks.accountLogin } }),
}))
vi.mock('~/ui/Buttons/Button', () => ({
  default: ({
    children,
    disabled,
    loading,
    onClick,
  }: {
    children: ReactNode
    disabled?: boolean
    loading?: boolean
    onClick?: () => void
  }) => (
    <button type='button' disabled={disabled || loading} onClick={onClick}>
      {children}
    </button>
  ),
}))
vi.mock('~/ui/Modal', () => ({
  default: ({ children, show }: { children: ReactNode; show: boolean }) =>
    show ? <div role='dialog'>{children}</div> : null,
}))
vi.mock('~/ui/Toaster', () => ({ toast: mocks.toast }))

const pageInfo = {
  __typename: 'OffsetPageInfo',
  hasNextPage: false,
  hasPreviousPage: false,
  page: 1,
  size: 25,
  totalCount: 1,
  totalPages: 1,
}

const inviteRequest = {
  id: 'request-invite-1',
  type: 'INVITE',
  status: 'PENDING',
  revision: 4,
  proposedPermissions: { ARTICLE_UPDATE: true },
  subjectUser: { login: 'subject', nickname: 'Subject User', avatar: null },
  createdBy: { login: 'owner', nickname: 'Owner', avatar: null },
}

const operationName = (document: unknown): string | undefined => {
  if (!document || typeof document !== 'object' || !('definitions' in document)) return undefined
  const definitions = (document as { definitions?: Array<{ name?: { value?: string } }> })
    .definitions
  return definitions?.find((definition) => definition.name)?.name?.value
}

const renderManager = async (client = new QueryClient()) => {
  render(
    <QueryClientProvider client={client}>
      <ArticleCoAuthors article={{ id: 'article-1', title: 'Article title', innerId: 17 }} />
    </QueryClientProvider>,
  )

  fireEvent.click(screen.getByRole('button', { name: 'dsb.cms.coauthors.action' }))
  return { client, dialog: await screen.findByRole('dialog') }
}

beforeEach(() => {
  mocks.accountLogin = 'owner'
  mocks.browserGraphQLRequest.mockReset()
  mocks.executeCommand.mockReset()
  mocks.invalidatePrefix.mockReset()
  mocks.toast.mockReset()

  mocks.browserGraphQLRequest.mockImplementation(async (document) => {
    switch (operationName(document)) {
      case 'DashboardArticleCoAuthorPermissions':
        return {
          articlePermissions: {
            articleId: 'article-1',
            isOwner: true,
            permissions: ['ARTICLE_AUTHOR_MANAGE'],
          },
        }
      case 'DashboardPagedArticleCoAuthors':
        return {
          pagedArticleCoAuthors: {
            entries: [
              {
                memberId: 'member-1',
                articleId: 'article-1',
                revision: 2,
                permissions: ['ARTICLE_UPDATE'],
                user: { login: 'member', nickname: 'Current Member', avatar: null },
              },
            ],
            pageInfo,
          },
        }
      case 'DashboardPagedArticleCoAuthorRequests':
        return { pagedArticleCoAuthorRequests: { entries: [inviteRequest], pageInfo } }
      case 'DashboardArticleCoAuthorCandidates':
        return {
          articleCoAuthorCandidates: [
            { login: 'candidate', nickname: 'Candidate User', avatar: null },
          ],
        }
      default:
        return {}
    }
  })

  mocks.executeCommand.mockImplementation(async ({ request, variables }) =>
    request({ ...variables, commandId: 'test-command-id' }),
  )
  mocks.invalidatePrefix.mockResolvedValue(undefined)
})

describe('ArticleCoAuthors', () => {
  it('invites a searched candidate and refreshes the co-author query family', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const { dialog } = await renderManager(queryClient)

    const search = await within(dialog).findByRole('textbox', {
      name: 'dsb.cms.coauthors.search_label',
    })
    fireEvent.change(search, { target: { value: 'Candidate' } })

    const invite = await within(dialog).findByRole('button', {
      name: 'dsb.cms.coauthors.invite_action',
    })
    fireEvent.click(invite)

    await waitFor(() => expect(mocks.executeCommand).toHaveBeenCalledTimes(1))
    const command = mocks.executeCommand.mock.calls[0][0]
    expect(command.variables).toEqual({
      articleId: 'article-1',
      subjectLogin: 'candidate',
      type: 'INVITE',
      permissions: '{"article.read_draft":true,"article.update":true}',
    })
    expect(command.request).toEqual(expect.any(Function))
    await waitFor(() => {
      expect(mocks.invalidatePrefix).toHaveBeenCalledWith(queryClient, [
        'article-co-authors',
        'test-account-scope',
        'article-1',
      ])
    })
    expect(mocks.browserGraphQLRequest).toHaveBeenCalledWith(
      expect.objectContaining({ definitions: expect.any(Array) }),
      expect.objectContaining({
        articleId: 'article-1',
        subjectLogin: 'candidate',
        type: 'INVITE',
        commandId: 'test-command-id',
      }),
    )
    expect(operationName(mocks.browserGraphQLRequest.mock.calls.at(-1)?.[0])).toBe(
      'DashboardCreateArticleCoAuthorRequest',
    )
  })

  it('lets the invited subject accept or decline their pending invitation', async () => {
    mocks.accountLogin = 'subject'
    mocks.browserGraphQLRequest.mockImplementation(async (document) => {
      switch (operationName(document)) {
        case 'DashboardArticleCoAuthorPermissions':
          return { articlePermissions: { articleId: 'article-1', isOwner: false, permissions: [] } }
        case 'DashboardPagedArticleCoAuthorRequests':
          return { pagedArticleCoAuthorRequests: { entries: [inviteRequest], pageInfo } }
        default:
          return {}
      }
    })

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const { dialog } = await renderManager(queryClient)
    expect(await within(dialog).findByText(/Subject User/)).toBeVisible()
    expect(
      await within(dialog).findByRole('button', { name: 'dsb.cms.coauthors.accept' }),
    ).toBeVisible()
    expect(within(dialog).getByRole('button', { name: 'dsb.cms.coauthors.reject' })).toBeVisible()
    expect(within(dialog).queryByRole('button', { name: 'dsb.cms.coauthors.cancel' })).toBeNull()

    fireEvent.click(within(dialog).getByRole('button', { name: 'dsb.cms.coauthors.accept' }))
    await waitFor(() => expect(mocks.executeCommand).toHaveBeenCalledTimes(1))
    expect(mocks.executeCommand.mock.calls[0][0].variables).toEqual({
      requestId: 'request-invite-1',
      revision: 4,
      decision: 'ACCEPT',
      approvedPermissions: undefined,
    })
    expect(mocks.invalidatePrefix).toHaveBeenCalledWith(queryClient, [
      'article-co-authors',
      'test-account-scope',
      'article-1',
    ])
  })

  it('does not fetch or render member and candidate data for a non-manager', async () => {
    mocks.accountLogin = 'stranger'
    mocks.browserGraphQLRequest.mockImplementation(async (document) => {
      switch (operationName(document)) {
        case 'DashboardArticleCoAuthorPermissions':
          return { articlePermissions: { articleId: 'article-1', isOwner: false, permissions: [] } }
        case 'DashboardPagedArticleCoAuthorRequests':
          return {
            pagedArticleCoAuthorRequests: { entries: [], pageInfo: { ...pageInfo, totalCount: 0 } },
          }
        default:
          return {}
      }
    })

    const { dialog } = await renderManager()

    expect(within(dialog).queryByText('dsb.cms.coauthors.invite')).toBeNull()
    expect(within(dialog).queryByText('dsb.cms.coauthors.members')).toBeNull()
    expect(within(dialog).queryByText('Current Member')).toBeNull()
    expect(within(dialog).queryByText('Candidate User')).toBeNull()
    expect(
      mocks.browserGraphQLRequest.mock.calls.map(([document]) => operationName(document)),
    ).not.toContain('DashboardPagedArticleCoAuthors')
    expect(
      mocks.browserGraphQLRequest.mock.calls.map(([document]) => operationName(document)),
    ).not.toContain('DashboardArticleCoAuthorCandidates')
  })
})
