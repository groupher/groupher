import { useQuery } from '@tanstack/react-query'

import { browserGraphQLRequest } from '~/graphql/client'
import type { CmsReviewTargetInput } from '~/graphql/generated/graphql'
import useTrans from '~/hooks/useTrans'
import { viewerQueryKeys } from '~/query/key'
import useAccount from '~/stores/account/hooks'
import { contentReviewNotice } from '~/unit/CMSReview/schema'

type TProps = { target: CmsReviewTargetInput }

export default function ReviewNotice({ target }: TProps) {
  const { t } = useTrans()
  const { accountScope } = useAccount()
  const query = useQuery({
    queryKey: viewerQueryKeys.contentReview(accountScope || 'anonymous', target),
    queryFn: async () => {
      const response = await browserGraphQLRequest(contentReviewNotice, { target })
      return response.contentReviewNotice
    },
    staleTime: 10_000,
  })

  if (!query.data) return null

  const message =
    query.data.status === 'checking'
      ? t('content_review.status.checking')
      : query.data.status === 'failed'
        ? t('content_review.status.check_unavailable')
        : query.data.status === 'restricted'
          ? t('content_review.status.restricted')
          : t('content_review.status.waiting_human')

  return (
    <aside
      role='status'
      className='border-divider bg-notice-bg my-4 rounded-md border-l-4 px-4 py-3'
    >
      <p className='text-sm font-medium'>{message}</p>
      {query.data.status === 'failed' && query.data.failureCode && (
        <p className='text-digest mt-1 text-sm'>{query.data.failureCode}</p>
      )}
    </aside>
  )
}
