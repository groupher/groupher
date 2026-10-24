import { useQuery } from '@tanstack/react-query'

import { browserGraphQLRequest } from '~/graphql/client'
import type { CmsReviewTargetInput } from '~/graphql/generated/graphql'
import useTrans from '~/hooks/useTrans'
import { viewerQueryKeys } from '~/query/key'
import useAccount from '~/stores/account/hooks'
import { contentReview } from '~/unit/CMSReview/schema'

type TProps = { target: CmsReviewTargetInput }

export default function ReviewNotice({ target }: TProps) {
  const { t } = useTrans()
  const { accountRef } = useAccount()
  const query = useQuery({
    queryKey: viewerQueryKeys.contentReview(accountRef || 'anonymous', target),
    queryFn: async () => {
      const response = await browserGraphQLRequest(contentReview, { target })
      return response.contentReview
    },
    staleTime: 10_000,
  })

  if (!query.data) return null

  const status = query.data.state.toUpperCase()
  if (status === 'COMPLETED' && query.data.reviewMode !== 'human_first') return null
  const message =
    status === 'QUEUED' || status === 'RUNNING'
      ? t('content_review.status.checking')
      : status === 'FAILED'
        ? t('content_review.status.check_unavailable')
        : t('content_review.status.waiting_human')

  return (
    <aside
      role='status'
      className='border-divider bg-notice-bg my-4 rounded-md border-l-4 px-4 py-3'
    >
      <p className='text-sm font-medium'>{message}</p>
      {[
        { source: 'system', opinion: query.data.systemOpinion },
        { source: 'community', opinion: query.data.communityOpinion },
      ].map(({ source, opinion }) =>
        opinion?.summary ? (
          <p key={source} className='text-digest mt-1 text-sm'>
            {opinion.summary}
          </p>
        ) : null,
      )}
    </aside>
  )
}
