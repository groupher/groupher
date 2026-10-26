import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'

import { browserGraphQLRequest } from '~/graphql/client'
import type { ReviewBotSubjectType } from '~/graphql/generated/graphql'
import useTrans from '~/hooks/useTrans'
import { invalidatePrefix } from '~/query/invalidation'

import { reviewBotConfig, updateReviewBotConfig } from './schema'

const subjectTypes: ReviewBotSubjectType[] = ['ARTICLE', 'COMMENT']
const reviewModes = ['IMMEDIATE', 'AI_FIRST', 'HUMAN_FIRST'] as const

type ReviewMode = (typeof reviewModes)[number]
type TReviewBotDraft = {
  subjectType: ReviewBotSubjectType
  version: number
  reviewMode: ReviewMode
  reviewBanWords: string
  reviewPrompt: string
}

const reviewModeLabel = (mode: ReviewMode) => {
  switch (mode) {
    case 'IMMEDIATE':
      return 'review_bot.mode.immediate' as const
    case 'AI_FIRST':
      return 'review_bot.mode.ai_first' as const
    case 'HUMAN_FIRST':
      return 'review_bot.mode.human_first' as const
  }
}

/** Edits the selected community ReviewBot policy using its expected version. */
export default function ReviewBotSettings({ community }: { community: string }) {
  const { t } = useTrans()
  const client = useQueryClient()
  const [subjectType, setSubjectType] = useState<ReviewBotSubjectType>('ARTICLE')
  const [draft, setDraft] = useState<TReviewBotDraft | null>(null)
  const commandId = useRef<string | null>(null)
  const scope = { type: 'COMMUNITY' as const, community }
  const queryKey = ['review-bot-config', community, subjectType]
  const config = useQuery({
    queryKey,
    queryFn: async () =>
      (await browserGraphQLRequest(reviewBotConfig, { scope, subjectType })).reviewBotConfig,
  })

  const currentDraft =
    draft?.subjectType === subjectType && draft.version === config.data?.version
      ? draft
      : config.data
        ? {
            subjectType,
            version: config.data.version,
            reviewMode: config.data.reviewMode,
            reviewBanWords: config.data.reviewBanWords.join('\n'),
            reviewPrompt: config.data.reviewPrompt,
          }
        : null

  const save = useMutation({
    mutationFn: () => {
      if (!config.data || !currentDraft) throw new Error('ReviewBot configuration is not loaded.')
      return browserGraphQLRequest(updateReviewBotConfig, {
        commandId: (commandId.current ??= crypto.randomUUID()),
        input: {
          scope,
          subjectType,
          expectedVersion: config.data.version,
          reviewMode: currentDraft.reviewMode,
          reviewBanWords: currentDraft.reviewBanWords
            .split('\n')
            .map((word) => word.trim())
            .filter(Boolean),
          reviewPrompt: currentDraft.reviewPrompt,
        },
      })
    },
    onSuccess: async () => {
      commandId.current = null
      await invalidatePrefix(client, queryKey)
    },
  })

  return (
    <section className='mx-auto max-w-3xl px-5 py-8'>
      <h1 className='mb-5 text-xl font-semibold'>{t('review_bot.settings')}</h1>
      <label className='mb-4 grid gap-1 text-sm'>
        {t('review_bot.subject_type')}
        <select
          className='border-divider rounded-md border bg-transparent px-3 py-2'
          value={subjectType}
          onChange={(event) => setSubjectType(event.target.value as ReviewBotSubjectType)}
        >
          {subjectTypes.map((type) => (
            <option key={type} value={type}>
              {type.toLowerCase()}
            </option>
          ))}
        </select>
      </label>
      {config.isPending ? (
        <p className='text-digest text-sm'>{t('alert_wall.loading')}</p>
      ) : config.isError ? (
        <p role='alert' className='text-sm text-red-600'>
          {t('alert_wall.load_error')}
        </p>
      ) : (
        <form
          className='grid gap-4'
          onSubmit={(event) => {
            event.preventDefault()
            save.mutate()
          }}
        >
          <label className='grid gap-1 text-sm'>
            {t('review_bot.review_mode')}
            <select
              className='border-divider rounded-md border bg-transparent px-3 py-2'
              value={currentDraft?.reviewMode || config.data.reviewMode}
              onChange={(event) =>
                currentDraft &&
                setDraft({ ...currentDraft, reviewMode: event.target.value as ReviewMode })
              }
            >
              {reviewModes.map((mode) => (
                <option key={mode} value={mode}>
                  {t(reviewModeLabel(mode))}
                </option>
              ))}
            </select>
          </label>
          <label className='grid gap-1 text-sm'>
            {t('review_bot.review_ban_words')}
            <textarea
              className='border-divider min-h-24 rounded-md border bg-transparent p-3'
              value={currentDraft?.reviewBanWords || ''}
              onChange={(event) =>
                currentDraft && setDraft({ ...currentDraft, reviewBanWords: event.target.value })
              }
            />
          </label>
          <label className='grid gap-1 text-sm'>
            {t('review_bot.review_prompt')}
            <textarea
              className='border-divider min-h-32 rounded-md border bg-transparent p-3'
              value={currentDraft?.reviewPrompt || ''}
              onChange={(event) =>
                currentDraft && setDraft({ ...currentDraft, reviewPrompt: event.target.value })
              }
            />
          </label>
          {save.isError && (
            <p role='alert' className='text-sm text-red-600'>
              {t('review_bot.save_error')}
            </p>
          )}
          <button
            type='submit'
            className='bg-primary text-primary-foreground justify-self-start rounded-md px-4 py-2 text-sm disabled:opacity-50'
            disabled={save.isPending}
          >
            {save.isPending ? t('review_bot.saving') : t('review_bot.save')}
          </button>
        </form>
      )}
    </section>
  )
}
