import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'

import { browserGraphQLRequest } from '~/graphql/client'
import type { CmsReviewTargetInput } from '~/graphql/generated/graphql'
import useTrans from '~/hooks/useTrans'
import { invalidatePrefix } from '~/query/invalidation'

import History from './History'
import {
  approveArticleReview,
  approveCommentReview,
  approveDocReview,
  denyArticleReview,
  denyCommentReview,
  denyDocReview,
  pendingContentReviews,
  recheckArticleReview,
  recheckCommentReview,
  releaseArticleReview,
  releaseCommentReview,
  releaseDocReview,
} from './schema'

/** Shows CMS-owned review work and submits the resource decision once. */
export default function PendingQueue({ community }: { community?: string }) {
  const { t } = useTrans()
  const client = useQueryClient()
  const commandIds = useRef(new Map<string, string>())
  const [page, setPage] = useState(1)
  const scope = community
    ? { type: 'COMMUNITY' as const, community }
    : { type: 'PLATFORM' as const }
  const queryKey = ['cms-content-review', community || 'platform', page]
  const pending = useQuery({
    queryKey,
    queryFn: async () =>
      (
        await browserGraphQLRequest(pendingContentReviews, {
          scope,
          limit: 50,
          offset: (page - 1) * 50,
        })
      ).pendingContentReviews,
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
      if (type !== 'ARTICLE' && type !== 'COMMENT' && type !== 'DOC') {
        throw new Error('Unsupported review target.')
      }
      const key = `${type}:${target.articleId || target.commentId}:${target.branchId || ''}:${action}`
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

      if (type === 'DOC') {
        switch (action) {
          case 'approve':
            return browserGraphQLRequest(approveDocReview, { target, commandId })
          case 'deny':
            return browserGraphQLRequest(denyDocReview, { target, commandId })
          case 'release':
            return browserGraphQLRequest(releaseDocReview, { target, commandId })
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
        `${target.type}:${target.articleId || target.commentId}:${target.branchId || ''}:${variables.action}`,
      )
      await invalidatePrefix(client, queryKey)
    },
  })
  const recheck = useMutation({
    mutationFn: async ({ target, key }: { target: CmsReviewTargetInput; key: string }) => {
      const commandId = commandIds.current.get(key) || crypto.randomUUID()
      commandIds.current.set(key, commandId)
      if (target.type === 'ARTICLE') {
        return browserGraphQLRequest(recheckArticleReview, {
          target,
          scope,
          commandId,
        })
      }
      if (target.type === 'COMMENT') {
        return browserGraphQLRequest(recheckCommentReview, {
          target,
          scope,
          commandId,
        })
      }
      throw new Error('Unsupported review target.')
    },
    onSuccess: async (_result, { key }) => {
      commandIds.current.delete(key)
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
                  : type === 'DOC' && request.articleId && request.branchId
                    ? { type, articleId: request.articleId, branchId: request.branchId }
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
                  {request.state.toUpperCase() === 'FAILED' && (
                    <p role='alert' className='mt-1 text-sm text-red-600'>
                      {request.failureMessage || t('content_review.status.check_unavailable')}
                      {request.failureCode ? ` (${request.failureCode})` : ''}
                    </p>
                  )}
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
                    {type !== 'DOC' && (
                      <button
                        type='button'
                        className='border-divider rounded-md border px-3 py-2 text-sm disabled:opacity-50'
                        disabled={recheck.isPending}
                        onClick={() =>
                          recheck.mutate({
                            target,
                            key: `recheck:${scope.type}:${scope.community || 'platform'}:${type}:${target.articleId || target.commentId}`,
                          })
                        }
                      >
                        {t('cms_review.action.recheck')}
                      </button>
                    )}
                  </div>
                )}
                {target && <History target={target} />}
                {decide.isError && (
                  <p role='alert' className='text-sm text-red-600'>
                    {t('cms_review.action_error')}
                  </p>
                )}
                {recheck.isError && (
                  <p role='alert' className='text-sm text-red-600'>
                    {t('cms_review.action_error')}
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {pending.data && (page > 1 || pending.data.length === 50) && (
        <nav className='mt-4 flex justify-end gap-3 text-sm'>
          <button
            type='button'
            className='border-divider rounded-md border px-3 py-2 disabled:opacity-50'
            disabled={page === 1 || pending.isFetching}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            {t('alert_wall.previous_page')}
          </button>
          <button
            type='button'
            className='border-divider rounded-md border px-3 py-2 disabled:opacity-50'
            disabled={pending.data.length < 50 || pending.isFetching}
            onClick={() => setPage((current) => current + 1)}
          >
            {t('alert_wall.next_page')}
          </button>
        </nav>
      )}
    </section>
  )
}
