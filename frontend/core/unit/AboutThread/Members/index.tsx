import { useQuery } from '@tanstack/react-query'

import { browserGraphQLRequest } from '~/graphql/client'
import usePagiPosition from '~/hooks/usePagiPosition'
import Img from '~/Img'
import { mockUsers } from '~/mock'
import useCommunity from '~/stores/community/hooks'
import ImgFallback from '~/ui/ImgFallback'
import NoteTip from '~/ui/NoteTip'
import Pagi from '~/ui/Pagi'
import PaginationError from '~/ui/Pagi/PaginationError'
import S from '~/unit/DsbThread/schema/admins'

import AdminMember from './AdminMember'
import useSalon, { cn } from './salon'

const Members = () => {
  const { slug } = useCommunity()
  const position = usePagiPosition(slug)
  const query = useQuery({
    queryKey: ['community', slug, 'moderators', position.input],
    queryFn: async () =>
      (await browserGraphQLRequest(S.moderatorPage, { community: slug, pagi: position.input }))
        .pagedCommunityModerators,
    enabled: !!slug,
    meta: { hydration: 'public' },
  })
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className={s.block}>
        <div className={s.header}>
          <h3 className={s.title}>社区管理员</h3>
        </div>
        <div className={s.adminsRow}>
          {(query.data?.entries ?? []).map((moderator) => (
            <div key={moderator.user.login} className={s.admin}>
              <AdminMember user={moderator.user} />
            </div>
          ))}
        </div>
      </div>

      {query.error && (
        <PaginationError isRetrying={query.isFetching} onRetry={() => void query.refetch()} />
      )}
      <Pagi pageInfo={query.data?.pageInfo} onChange={position.setPage} />
      <div className={s.divider} />

      <div className={s.block}>
        <div className={s.header}>
          <h3 className={s.title}>
            参与互动
            <NoteTip left={1} placement='right' offset={[-6, 10]}>
              参与发布，投票，评论，以及 Emoji 反馈的用户
            </NoteTip>
          </h3>
        </div>
        <div className={cn(s.adminsRow, 'gap-3')}>
          {mockUsers(15).map((user) => (
            <Img
              className={s.joinerAavtar}
              key={user.login}
              src={user.avatar ?? ''}
              fallback={<ImgFallback user={user} />}
            />
          ))}
          {mockUsers(15).map((user) => (
            <Img
              className={s.joinerAavtar}
              key={user.login}
              src={user.avatar ?? ''}
              fallback={<ImgFallback user={user} />}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export default Members
