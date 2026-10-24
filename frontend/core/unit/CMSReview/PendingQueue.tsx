import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef } from 'react'

import { browserGraphQLRequest } from '~/graphql/client'
import type { CmsReviewTargetInput } from '~/graphql/generated/graphql'
import useTrans from '~/hooks/useTrans'
import { invalidatePrefix } from '~/query/invalidation'

import {
  approveArticleReview,
  approveCommentReview,
  denyArticleReview,
  denyCommentReview,
  pendingContentReviews,
  releaseArticleReview,
  releaseCommentReview,
} from './schema'

/** Shows CMS-owned review work and submits the resource decision once. */
export default function PendingQueue({ community }: { community?: string }) {
  const { t } = useTrans()
  const client = useQueryClient()
  const commandIds = useRef(new Map<string, string>())
  const scope = community
    ? { type: 'COMMUNITY' as const, community }
    : { type: 'PLATFORM' as const }
  const queryKey = ['cms-content-review', community || 'platform']
  const pending = useQuery({
    queryKey,
    queryFn: async () =>
      (await browserGraphQLRequest(pendingContentReviews, { scope })).pendingContentReviews,
  })
  const decide = useMutation({
    mutationFn: async ({
      target,
      action,
    }: {
      target: CmsReviewTargetInput
      action: 'approve' | 'deny' | 'release'
    }) => {
      const type = target.type
      if (type !== 'ARTICLE' && type !== 'COMMENT') throw new Error('Unsupported review target.')
      const key = `${type}:${target.articleId || target.commentId}:${action}`
      const commandId = commandIds.current.get(key) || crypto.randomUUID()
      commandIds.current.set(key, commandId)
      if (type === 'ARTICLE') {
        switch (action) {
          case 'approve':
            return browserGraphQLRequest(approveArticleReview, { target, commandId })
          case 'deny':
            return browserGraphQLRequest(denyArticleReview, { target, commandId })
          case 'release':
            return browserGraphQLRequest(releaseArticleReview, { target, commandId })
        }
      }

      switch (action) {
        case 'approve':
          return browserGraphQLRequest(approveCommentReview, { target, commandId })
        case 'deny':
          return browserGraphQLRequest(denyCommentReview, { target, commandId })
        case 'release':
          return browserGraphQLRequest(releaseCommentReview, { target, commandId })
      }
    },
    onSuccess: async (_result, variables) => {
      const target = variables.target
      commandIds.current.delete(
        `${target.type}:${target.articleId || target.commentId}:${variables.action}`,
      )
      await invalidatePrefix(client, queryKey)
    },
  })

  return (
    <section className='mx-auto max-w-5xl px-5 py-8'>
      <h1 className='mb-5 text-xl font-semibold'>{t('cms_review.pending_title')}</h1>
      {pending.isPending ? (
        <p className='text-digest text-sm'>{t('alert_wall.loading')}</p>
      ) : pending.isError ? (
        <p role='alert' className='text-sm text-red-600'>
          {t('alert_wall.load_error')}
        </p>
      ) : pending.data.length === 0 ? (
        <p className='border-divider text-digest rounded-lg border p-5 text-sm'>
          {t('cms_review.empty')}
        </p>
      ) : (
        <ul className='divide-divider border-divider divide-y rounded-lg border'>
          {pending.data.map((request) => {
            const type = request.targetType
            const target: CmsReviewTargetInput | null =
              type === 'ARTICLE' && request.articleId
                ? { type, articleId: request.articleId, communityId: request.communityId }
                : type === 'COMMENT' && request.commentId
                  ? { type, commentId: request.commentId, communityId: request.communityId }
                  : null

            return (
              <li key={request.artimentReviewId} className='grid gap-3 p-4'>
                <div>
                  <p className='font-medium'>
                    {type.toLowerCase()} ·{' '}
                    {request.articleId || request.commentId || request.branchId}
                  </p>
                  <p className='text-digest mt-1 text-sm'>
                    {request.state.toLowerCase()} · {request.reviewMode || '—'}
                  </p>
                  {[
                    { source: 'system', opinion: request.systemOpinion },
                    { source: 'community', opinion: request.communityOpinion },
                  ].map(({ source, opinion }) =>
                    opinion?.summary ? (
                      <p key={source} className='text-digest mt-2 text-sm'>
                        {opinion.summary}
                      </p>
                    ) : null,
                  )}
                </div>
                {target && (
                  <div className='flex flex-wrap gap-2'>
                    {(['approve', 'deny', 'release'] as const).map((action) => (
                      <button
                        key={action}
                        type='button'
                        className='border-divider rounded-md border px-3 py-2 text-sm disabled:opacity-50'
                        disabled={decide.isPending}
                        onClick={() => decide.mutate({ target, action })}
                      >
                        {t(`cms_review.action.${action}`)}
                      </button>
                    ))}
                  </div>
                )}
                {decide.isError && (
                  <p role='alert' className='text-sm text-red-600'>
                    {t('cms_review.action_error')}
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
