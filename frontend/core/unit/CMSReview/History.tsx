import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'

import { browserGraphQLRequest } from '~/graphql/client'
import type { CmsReviewTargetInput } from '~/graphql/generated/graphql'
import useTrans from '~/hooks/useTrans'

import { contentReviewHistory } from './schema'

type TProps = { target: CmsReviewTargetInput }

/** Keeps earlier check results visible beside the current moderator task. */
export default function History({ target }: TProps) {
  const { t } = useTrans()
  const [open, setOpen] = useState(false)
  const [page, setPage] = useState(1)
  const history = useQuery({
    queryKey: ['content-review-history', target, page],
    queryFn: async () =>
      (
        await browserGraphQLRequest(contentReviewHistory, {
          target,
          limit: 20,
          offset: (page - 1) * 20,
        })
      ).contentReviewHistory,
    enabled: open,
  })

  return (
    <div>
      <button
        type='button'
        className='text-sm underline'
        onClick={() => setOpen((value) => !value)}
      >
        {t('cms_review.history')}
      </button>
      {open && (
        <div className='mt-3'>
          {history.isPending ? (
            <p className='text-digest text-sm'>{t('alert_wall.loading')}</p>
          ) : history.isError ? (
            <p role='alert' className='text-sm text-red-600'>
              {t('cms_review.history_error')}
            </p>
          ) : (
            <>
              <ul className='divide-divider divide-y'>
                {history.data.map((review) => (
                  <li key={review.artimentReviewId} className='py-2 text-sm'>
                    <p>
                      {review.outdatedAt
                        ? t('cms_review.outdated')
                        : review.replacedAt
                          ? t('cms_review.earlier_check')
                          : t('cms_review.current')}{' '}
                      · {review.state.toLowerCase()}
                    </p>
                    {review.state.toUpperCase() === 'FAILED' && (
                      <p className='text-red-600'>
                        {review.failureMessage || t('content_review.status.check_unavailable')}
                        {review.failureCode ? ` (${review.failureCode})` : ''}
                      </p>
                    )}
                    {review.systemOpinion?.summary && <p>{review.systemOpinion.summary}</p>}
                    {review.communityOpinion?.summary && <p>{review.communityOpinion.summary}</p>}
                  </li>
                ))}
              </ul>
              <div className='mt-2 flex gap-3 text-sm'>
                {page > 1 && (
                  <button type='button' className='underline' onClick={() => setPage(page - 1)}>
                    {t('alert_wall.previous_page')}
                  </button>
                )}
                {history.data.length === 20 && (
                  <button type='button' className='underline' onClick={() => setPage(page + 1)}>
                    {t('alert_wall.next_page')}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
