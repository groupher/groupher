import { useQuery } from '@tanstack/react-query'

import useAccount from '~/stores/account/hooks'
import useCommunity from '~/stores/community/hooks'

import useAdmins from '../logic/useAdmins'

export default function Requests() {
  const { requests, decideRequest, cancelRequest } = useAdmins()
  const { slug } = useCommunity()
  const { accountScope } = useAccount()
  const query = useQuery({
    queryKey: ['community-admin-requests', slug, accountScope],
    queryFn: requests,
    enabled: !!slug && !!accountScope,
  })
  const entries = query.data ?? []

  return (
    <section className='my-6 space-y-3' aria-label='管理员请求'>
      <h3 className='text-base font-semibold'>管理员请求</h3>
      {query.isLoading ? <p role='status'>加载中...</p> : null}
      {entries.map((request: any) => (
        <article
          className='flex flex-wrap items-center gap-3 rounded-md border p-3'
          key={request.id}
        >
          <span>
            {request.type === 'invite' ? '邀请' : '申请'} ·{' '}
            {request.subjectUser?.nickname ?? request.subjectUser?.login}
          </span>
          <span className='text-sm opacity-70'>{request.status}</span>
          {request.status === 'pending' ? (
            <div className='ml-auto flex gap-2'>
              {request.type === 'apply' ? (
                <button
                  type='button'
                  onClick={() =>
                    void decideRequest(
                      request.id,
                      request.revision,
                      'accept',
                      request.proposedPermissions,
                    )
                  }
                >
                  批准申请
                </button>
              ) : null}
              <button
                type='button'
                onClick={() => void decideRequest(request.id, request.revision, 'reject')}
              >
                拒绝
              </button>
              <button
                type='button'
                onClick={() => void cancelRequest(request.id, request.revision)}
              >
                取消
              </button>
            </div>
          ) : null}
        </article>
      ))}
      {!query.isLoading && !entries.length ? <p className='text-sm opacity-70'>暂无请求</p> : null}
    </section>
  )
}
