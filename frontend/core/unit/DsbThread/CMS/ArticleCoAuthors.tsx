'use client'

import { GATE_PERMISSION } from '@groupher/contracts/gate'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useDeferredValue, useState } from 'react'

import { browserGraphQLRequest } from '~/graphql/client'
import useTrans from '~/hooks/useTrans'
import { invalidatePrefix } from '~/query/invalidation'
import { executeCommand } from '~/query/mutation/optimistic/execute'
import type { TArticle } from '~/spec'
import useAccount from '~/stores/account/hooks'
import Button from '~/ui/Buttons/Button'
import Modal from '~/ui/Modal'
import { toast } from '~/ui/Toaster'

import * as S from '../schema/coAuthors'

type TProps = {
  article: Pick<TArticle, 'id' | 'title'> & Partial<Pick<TArticle, 'innerId'>>
}
type TPermission = keyof typeof GATE_PERMISSION & string

const grantablePermissions = Object.entries(GATE_PERMISSION)
  .filter(([action, value]) => action.startsWith('article.') && value.grantable)
  .map(([action]) => action as TPermission)

const canonicalPermissionNames = new Map(
  Object.keys(GATE_PERMISSION).map((action) => [action.replaceAll('.', '_').toUpperCase(), action]),
)

const permissionMap = (permissions: readonly string[]): Record<string, boolean> => {
  return Object.fromEntries(
    permissions.map((permission) => [canonicalPermissionNames.get(permission) ?? permission, true]),
  )
}

const graphQLPermissions = (permissions: Record<string, boolean>): Record<string, boolean> =>
  Object.fromEntries(
    Object.entries(permissions)
      .filter(([, enabled]) => enabled)
      .map(([action, enabled]) => [action, enabled]),
  )

export default function ArticleCoAuthors({ article }: TProps) {
  const { t } = useTrans()
  const queryClient = useQueryClient()
  const { accountScope, user } = useAccount()
  const [show, setShow] = useState(false)
  const [search, setSearch] = useState('')
  const [memberPage, setMemberPage] = useState(1)
  const [requestPage, setRequestPage] = useState(1)
  const [permissions, setPermissions] = useState<Record<string, boolean>>({
    'article.read_draft': true,
    'article.update': true,
  })
  const [pendingKey, setPendingKey] = useState<string | null>(null)
  const articleId = article.id ?? ''
  const deferredSearch = useDeferredValue(search.trim())
  const queryPrefix = ['article-co-authors', accountScope, articleId]

  const permissionQuery = useQuery({
    queryKey: [...queryPrefix, 'permissions'],
    queryFn: () => browserGraphQLRequest(S.articleCoAuthorPermissions, { articleId }),
    enabled: show && !!articleId && !!accountScope,
  })
  const canManage = (permissionQuery.data?.articlePermissions.permissions ?? []).some(
    (permission) => canonicalPermissionNames.get(String(permission)) === 'article.author.manage',
  )
  const membersQuery = useQuery({
    queryKey: [...queryPrefix, 'members', memberPage],
    queryFn: () =>
      browserGraphQLRequest(S.articleCoAuthorMembers, {
        articleId,
        pagi: { offset: { page: memberPage, size: 25 } },
      }),
    enabled: show && canManage,
  })
  const requestsQuery = useQuery({
    queryKey: [...queryPrefix, 'requests', requestPage],
    queryFn: () =>
      browserGraphQLRequest(S.articleCoAuthorRequests, {
        articleId,
        pagi: { offset: { page: requestPage, size: 25 } },
      }),
    enabled: show && !!articleId && !!accountScope,
  })
  const candidatesQuery = useQuery({
    queryKey: [...queryPrefix, 'candidates', deferredSearch],
    queryFn: () =>
      browserGraphQLRequest(S.articleCoAuthorCandidates, { articleId, name: deferredSearch }),
    enabled: show && canManage && deferredSearch.length > 0,
  })

  const refresh = async () => invalidatePrefix(queryClient, queryPrefix)
  const run = async (key: string, action: () => Promise<unknown>): Promise<boolean> => {
    setPendingKey(key)
    let succeeded = false
    try {
      await action()
      succeeded = true
      await refresh()
    } catch (error) {
      toast(
        error instanceof Error ? error.message : t('dsb.cms.coauthors.operation_error'),
        'error',
      )
    } finally {
      setPendingKey(null)
    }

    return succeeded
  }

  const invite = async (subjectLogin: string) => {
    const succeeded = await run(`invite:${subjectLogin}`, () =>
      executeCommand({
        request: (variables) => browserGraphQLRequest(S.createArticleCoAuthorRequest, variables),
        variables: {
          articleId,
          subjectLogin,
          type: 'INVITE',
          permissions: JSON.stringify(graphQLPermissions(permissions)),
        },
      }),
    )
    if (succeeded) setSearch('')
  }

  const decide = (
    requestId: string,
    revision: number,
    decision: 'ACCEPT' | 'REJECT',
    approvedPermissions?: Record<string, boolean>,
  ) =>
    run(`request:${requestId}`, () =>
      executeCommand({
        request: (variables) => browserGraphQLRequest(S.decideArticleCoAuthorRequest, variables),
        variables: {
          requestId,
          revision,
          decision,
          approvedPermissions:
            approvedPermissions === undefined
              ? undefined
              : JSON.stringify(graphQLPermissions(approvedPermissions)),
        },
      }),
    )

  const cancel = (requestId: string, revision: number) =>
    run(`request:${requestId}`, () =>
      executeCommand({
        request: (variables) => browserGraphQLRequest(S.cancelArticleCoAuthorRequest, variables),
        variables: { requestId, revision },
      }),
    )

  const remove = (memberId: string, revision: number) =>
    run(`member:${memberId}`, () =>
      executeCommand({
        request: (variables) => browserGraphQLRequest(S.removeArticleCoAuthor, variables),
        variables: { articleId, memberId, revision },
      }),
    )

  const changeMemberPermissions = (
    memberId: string,
    revision: number,
    next: Record<string, boolean>,
  ) =>
    run(`member:${memberId}`, () =>
      executeCommand({
        request: (variables) =>
          browserGraphQLRequest(S.updateArticleCoAuthorPermissions, variables),
        variables: {
          articleId,
          memberId,
          revision,
          permissions: JSON.stringify(graphQLPermissions(next)),
        },
      }),
    )

  const requests = requestsQuery.data?.pagedArticleCoAuthorRequests.entries ?? []
  const members = membersQuery.data?.pagedArticleCoAuthors.entries ?? []
  const memberPageInfo = membersQuery.data?.pagedArticleCoAuthors.pageInfo
  const requestPageInfo = requestsQuery.data?.pagedArticleCoAuthorRequests.pageInfo

  const permissionLabel = (action: string): string => {
    switch (action) {
      case 'article.history.read':
        return t('dsb.cms.coauthors.permission.history_read')
      case 'article.history.restore':
        return t('dsb.cms.coauthors.permission.history_restore')
      case 'article.publish':
        return t('dsb.cms.coauthors.permission.publish')
      case 'article.read_draft':
        return t('dsb.cms.coauthors.permission.read_draft')
      case 'article.update':
        return t('dsb.cms.coauthors.permission.update')
      default:
        return action
    }
  }

  const requestStatusLabel = (status: string): string => {
    switch (status) {
      case 'PENDING':
        return t('dsb.cms.coauthors.status.pending')
      case 'DECIDED':
        return t('dsb.cms.coauthors.status.decided')
      case 'CANCELLED':
        return t('dsb.cms.coauthors.status.cancelled')
      case 'EXPIRED':
        return t('dsb.cms.coauthors.status.expired')
      default:
        return status
    }
  }

  return (
    <>
      <Button
        size='small'
        soft
        ariaLabel={`${t('dsb.cms.coauthors.action')} · ${article.title}`}
        disabled={!articleId}
        onClick={() => setShow(true)}
      >
        {t('dsb.cms.coauthors.action')}
      </Button>
      <Modal show={show} width='680px' onClose={() => setShow(false)} showCloseBtn>
        <div className='space-y-5 p-6'>
          <header>
            {article.innerId ? <p className='text-digest text-xs'>#{article.innerId}</p> : null}
            <h2 className='mt-1 text-xl font-semibold'>{t('dsb.cms.coauthors.title')}</h2>
            <p className='text-digest mt-1 truncate text-sm'>{article.title}</p>
          </header>

          {permissionQuery.isFetching ? (
            <p role='status'>{t('dsb.cms.coauthors.loading_permissions')}</p>
          ) : null}
          {permissionQuery.isError ? (
            <p role='alert'>{t('dsb.cms.coauthors.permission_error')}</p>
          ) : null}

          {canManage ? (
            <section className='space-y-3'>
              <h3 className='font-medium'>{t('dsb.cms.coauthors.invite')}</h3>
              <input
                className='border-divider w-full rounded-md border px-3 py-2 text-sm'
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t('dsb.cms.coauthors.search')}
                aria-label={t('dsb.cms.coauthors.search_label')}
              />
              <div className='flex flex-wrap gap-x-4 gap-y-2 text-sm'>
                {grantablePermissions.map((action) => (
                  <label className='flex items-center gap-2' key={action}>
                    <input
                      type='checkbox'
                      checked={Boolean(permissions[action])}
                      onChange={(event) =>
                        setPermissions((current) => ({
                          ...current,
                          [action]: event.target.checked,
                        }))
                      }
                    />
                    {permissionLabel(action)}
                  </label>
                ))}
              </div>
              <div className='divide-divider border-divider max-h-48 divide-y overflow-y-auto rounded-md border'>
                {(candidatesQuery.data?.articleCoAuthorCandidates ?? []).map((candidate) => (
                  <div className='flex items-center gap-3 p-3' key={candidate.login}>
                    <span className='min-w-0 grow truncate text-sm'>
                      {candidate.nickname ?? candidate.login}
                      <span className='text-digest ml-2'>@{candidate.login}</span>
                    </span>
                    <Button
                      size='small'
                      loading={pendingKey === `invite:${candidate.login}`}
                      disabled={
                        pendingKey !== null || Object.values(permissions).every((value) => !value)
                      }
                      onClick={() => void invite(candidate.login)}
                    >
                      {t('dsb.cms.coauthors.invite_action')}
                    </Button>
                  </div>
                ))}
                {deferredSearch &&
                !candidatesQuery.isFetching &&
                !(candidatesQuery.data?.articleCoAuthorCandidates.length ?? 0) ? (
                  <p className='text-digest p-3 text-sm'>{t('dsb.cms.coauthors.no_candidates')}</p>
                ) : null}
              </div>
            </section>
          ) : null}

          {canManage ? (
            <section className='space-y-3'>
              <h3 className='font-medium'>{t('dsb.cms.coauthors.members')}</h3>
              {membersQuery.isFetching ? (
                <p role='status'>{t('dsb.cms.coauthors.loading_members')}</p>
              ) : null}
              {members.map((member) => {
                const selected = permissionMap(member.permissions)
                return (
                  <div
                    className='border-divider space-y-2 rounded-md border p-3'
                    key={member.memberId}
                  >
                    <div className='flex items-center gap-3'>
                      <span className='min-w-0 grow truncate text-sm'>
                        {member.user.nickname ?? member.user.login} @{member.user.login}
                      </span>
                      <Button
                        size='small'
                        ghost
                        disabled={pendingKey !== null}
                        loading={pendingKey === `member:${member.memberId}`}
                        onClick={() => void remove(member.memberId, member.revision)}
                      >
                        {t('dsb.cms.coauthors.remove')}
                      </Button>
                    </div>
                    <div className='flex flex-wrap gap-x-4 gap-y-2 text-xs'>
                      {grantablePermissions.map((action) => (
                        <label className='flex items-center gap-2' key={action}>
                          <input
                            type='checkbox'
                            checked={Boolean(selected[action])}
                            disabled={pendingKey !== null}
                            onChange={(event) =>
                              void changeMemberPermissions(member.memberId, member.revision, {
                                ...selected,
                                [action]: event.target.checked,
                              })
                            }
                          />
                          {permissionLabel(action)}
                        </label>
                      ))}
                    </div>
                  </div>
                )
              })}
              {!membersQuery.isFetching && members.length === 0 ? (
                <p className='text-digest text-sm'>{t('dsb.cms.coauthors.no_members')}</p>
              ) : null}
              <div className='flex items-center justify-end gap-2'>
                <Button
                  size='small'
                  ghost
                  disabled={!memberPageInfo?.hasPreviousPage || membersQuery.isFetching}
                  onClick={() => setMemberPage((page) => Math.max(1, page - 1))}
                >
                  {t('dsb.cms.coauthors.previous')}
                </Button>
                <Button
                  size='small'
                  ghost
                  disabled={!memberPageInfo?.hasNextPage || membersQuery.isFetching}
                  onClick={() => setMemberPage((page) => page + 1)}
                >
                  {t('dsb.cms.coauthors.next')}
                </Button>
              </div>
            </section>
          ) : null}

          <section className='space-y-3'>
            <h3 className='font-medium'>{t('dsb.cms.coauthors.requests')}</h3>
            {requestsQuery.isFetching ? (
              <p role='status'>{t('dsb.cms.coauthors.loading_requests')}</p>
            ) : null}
            {requests.map((request) => {
              const isSubject = request.subjectUser?.login === user?.login
              const isPending = request.status === 'PENDING'
              const canDecide =
                isPending &&
                ((request.type === 'INVITE' && isSubject) ||
                  (request.type === 'APPLY' && canManage))
              const canCancel =
                isPending &&
                ((request.type === 'INVITE' && canManage) ||
                  (request.type === 'APPLY' && isSubject))

              return (
                <div
                  className='border-divider flex flex-wrap items-center gap-3 rounded-md border p-3'
                  key={request.id}
                >
                  <span className='min-w-0 grow text-sm'>
                    {request.type === 'INVITE'
                      ? t('dsb.cms.coauthors.invitation')
                      : t('dsb.cms.coauthors.application')}{' '}
                    · {request.subjectUser?.nickname ?? request.subjectUser?.login}
                  </span>
                  <span className='text-digest text-xs'>{requestStatusLabel(request.status)}</span>
                  {canDecide ? (
                    <>
                      <Button
                        size='small'
                        disabled={pendingKey !== null}
                        onClick={() =>
                          void decide(
                            request.id,
                            request.revision,
                            'ACCEPT',
                            request.type === 'APPLY'
                              ? permissionMap(
                                  Object.keys(request.proposedPermissions ?? {}).filter(
                                    (key) => request.proposedPermissions?.[key] === true,
                                  ),
                                )
                              : undefined,
                          )
                        }
                      >
                        {t('dsb.cms.coauthors.accept')}
                      </Button>
                      <Button
                        size='small'
                        ghost
                        disabled={pendingKey !== null}
                        onClick={() => void decide(request.id, request.revision, 'REJECT')}
                      >
                        {t('dsb.cms.coauthors.reject')}
                      </Button>
                    </>
                  ) : null}
                  {canCancel ? (
                    <Button
                      size='small'
                      ghost
                      disabled={pendingKey !== null}
                      onClick={() => void cancel(request.id, request.revision)}
                    >
                      {t('dsb.cms.coauthors.cancel')}
                    </Button>
                  ) : null}
                </div>
              )
            })}
            {!requestsQuery.isFetching && requests.length === 0 ? (
              <p className='text-digest text-sm'>{t('dsb.cms.coauthors.no_requests')}</p>
            ) : null}
            <div className='flex items-center justify-end gap-2'>
              <Button
                size='small'
                ghost
                disabled={!requestPageInfo?.hasPreviousPage || requestsQuery.isFetching}
                onClick={() => setRequestPage((page) => Math.max(1, page - 1))}
              >
                {t('dsb.cms.coauthors.previous')}
              </Button>
              <Button
                size='small'
                ghost
                disabled={!requestPageInfo?.hasNextPage || requestsQuery.isFetching}
                onClick={() => setRequestPage((page) => page + 1)}
              >
                {t('dsb.cms.coauthors.next')}
              </Button>
            </div>
          </section>
        </div>
      </Modal>
    </>
  )
}
