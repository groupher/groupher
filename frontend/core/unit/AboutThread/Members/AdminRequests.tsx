import { useQuery, useQueryClient } from '@tanstack/react-query'

import { browserGraphQLRequest } from '~/graphql/client'
import { invalidatePrefix } from '~/query/invalidation'
import { executeCommand } from '~/query/mutation/optimistic/execute'
import useAccount from '~/stores/account/hooks'
import useCommunity from '~/stores/community/hooks'
import S from '~/unit/DsbThread/schema/admins'

export default function AdminRequests() {
  const { slug } = useCommunity()
  const { accountScope } = useAccount()
  const client = useQueryClient()
  const key = ['community-admin-requests', slug, accountScope]
  const query = useQuery({
    queryKey: key,
    queryFn: async () =>
      (await browserGraphQLRequest(S.adminRequests, { community: slug }))
        .pagedCommunityAdminRequests.entries,
    enabled: !!slug && !!accountScope,
  })
  const membership = useQuery({
    queryKey: ['community-current-admin', slug, accountScope],
    queryFn: async () =>
      (await browserGraphQLRequest(S.currentAdmin, { community: slug })).currentCommunityAdmin,
    enabled: !!slug && !!accountScope,
  })

  const refresh = async () => invalidatePrefix(client, key)
  const apply = async () => {
    await executeCommand({
      request: (variables) => browserGraphQLRequest(S.createAdminRequest, variables),
      variables: { community: slug, type: 'apply', permissions: JSON.stringify({}) },
    })
    await refresh()
  }

  if (!accountScope) return null
  return (
    <section className='my-4 space-y-3' aria-label='我的管理员请求'>
      <h3 className='font-semibold'>我的管理员请求</h3>
      <button type='button' onClick={() => void apply()}>
        申请成为管理员
      </button>
      {membership.data && !membership.data.isLord ? (
        <button
          type='button'
          onClick={async () => {
            const revision = membership.data?.revision
            if (!revision) return
            await executeCommand({
              request: (variables) => browserGraphQLRequest(S.leaveCommunityAdmins, variables),
              variables: { community: slug, revision },
            })
            await invalidatePrefix(client, ['community-current-admin', slug, accountScope])
            await refresh()
          }}
        >
          退出管理员
        </button>
      ) : null}
      {(query.data ?? [])
        .filter((request: any) => request.status === 'pending')
        .map((request: any) => (
          <article className='flex items-center gap-3' key={request.id}>
            <span>
              {request.type === 'invite' ? '管理员邀请' : '管理员申请'} · {request.status}
            </span>
            {request.type === 'invite' ? (
              <>
                <button
                  type='button'
                  onClick={async () => {
                    await executeCommand({
                      request: (variables) =>
                        browserGraphQLRequest(S.decideAdminRequest, variables),
                      variables: {
                        requestId: request.id,
                        revision: request.revision,
                        decision: 'accept',
                        approvedPermissions: JSON.stringify(request.proposedPermissions),
                      },
                    })
                    await refresh()
                  }}
                >
                  接受
                </button>
                <button
                  type='button'
                  onClick={async () => {
                    await executeCommand({
                      request: (variables) =>
                        browserGraphQLRequest(S.decideAdminRequest, variables),
                      variables: {
                        requestId: request.id,
                        revision: request.revision,
                        decision: 'reject',
                      },
                    })
                    await refresh()
                  }}
                >
                  拒绝
                </button>
              </>
            ) : (
              <button
                type='button'
                onClick={async () => {
                  await executeCommand({
                    request: (variables) => browserGraphQLRequest(S.cancelAdminRequest, variables),
                    variables: { requestId: request.id, revision: request.revision },
                  })
                  await refresh()
                }}
              >
                撤回
              </button>
            )}
          </article>
        ))}
    </section>
  )
}
