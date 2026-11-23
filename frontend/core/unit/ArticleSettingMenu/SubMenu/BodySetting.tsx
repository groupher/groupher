import type { TRichEditorValue } from '@groupher/rich-editor'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { type FC, useRef, useState } from 'react'

import { browserGraphQLRequest } from '~/graphql/client'
import useViewingArticle from '~/hooks/useViewingArticle'
import { saveArticleBodyWorkingCopy } from '~/lib/artimentPublisher'
import { ContentPublishError } from '~/lib/contentPublisher'
import { invalidatePrefix } from '~/query/invalidation'
import { createCommandHandle } from '~/query/mutation/optimistic/execute'
import useAccount from '~/stores/account/hooks'
import Button from '~/ui/Buttons/Button'
import { toast } from '~/ui/Toaster'
import RichEditor from '~/unit/RichEditor'

import S from '../schema'
import useSalon from './salon/body_setting'

type TProps = {
  onBack: () => void
}

const parseBodyValue = (json?: string | null): TRichEditorValue => {
  if (!json) return [{ type: 'p', children: [{ text: '' }] }]
  try {
    const value: unknown = JSON.parse(json)
    return Array.isArray(value)
      ? (value as TRichEditorValue)
      : [{ type: 'p', children: [{ text: '' }] }]
  } catch {
    return [{ type: 'p', children: [{ text: '' }] }]
  }
}

const BodySetting: FC<TProps> = ({ onBack }) => {
  const s = useSalon()
  const queryClient = useQueryClient()
  const { article, articlePath } = useViewingArticle()
  const { accountScope } = useAccount()
  const articleId = article.id ? String(article.id) : ''
  const community = articlePath?.community ?? ''
  const queryKey = ['article-working-copies', articleId, community]
  const workingCopiesQuery = useQuery({
    queryKey,
    queryFn: () => {
      if (!articleId || !community) throw new Error('Article identity is unavailable.')
      return browserGraphQLRequest(S.articleWorkingCopies, { articleId, community })
    },
    enabled: !!accountScope && !!articleId && !!community,
  })
  const workingCopy = workingCopiesQuery.data?.articleWorkingCopies?.find(
    (candidate) => candidate.scopeType === 'default',
  )
  const [editedValue, setEditedValue] = useState<TRichEditorValue | null>(null)
  const [editorKey, setEditorKey] = useState(0)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const commandRef = useRef<ReturnType<typeof createCommandHandle> | null>(null)

  const value = editedValue ?? (workingCopy ? parseBodyValue(workingCopy.bodyJson) : null)
  const hasChanges =
    editedValue !== null &&
    !!workingCopy &&
    JSON.stringify(editedValue) !== JSON.stringify(parseBodyValue(workingCopy.bodyJson))

  const save = async () => {
    if (!workingCopy || !value || !community || !articleId) {
      toast('默认编辑副本尚未加载', 'error')
      return
    }

    const command =
      commandRef.current ?? createCommandHandle({ operation: 'article.working_copy.save.body' })
    commandRef.current = command
    setSaving(true)
    setSaveError(null)
    try {
      await saveArticleBodyWorkingCopy({
        value,
        community,
        articleId,
        workingCopyId: workingCopy.id,
        revision: workingCopy.revision,
        commandId: command.commandId,
      })
      await workingCopiesQuery.refetch()
      setEditedValue(null)
      setEditorKey((current) => current + 1)
      await invalidatePrefix(queryClient, ['article-working-copies', articleId])
      commandRef.current = null
      toast('正文已保存到默认编辑副本；公开版本未变')
    } catch (error) {
      const message = error instanceof Error ? error.message : '正文保存失败'
      setSaveError(message)
      const hasRevisionConflict =
        error instanceof ContentPublishError &&
        (error.status === 409 || error.code.includes('revision_conflict'))
      if (hasRevisionConflict) {
        commandRef.current = null
        await workingCopiesQuery.refetch().catch(() => undefined)
      }
      toast(message, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={s.wrapper}>
      {workingCopiesQuery.isLoading ? <div className={s.note}>正在加载默认编辑副本…</div> : null}
      {!workingCopiesQuery.isLoading && !workingCopy ? (
        <div role='alert' className={s.note}>
          默认编辑副本不可用，无法编辑正文。
        </div>
      ) : null}
      {workingCopy && value ? (
        <div className={s.editor}>
          <RichEditor
            key={`${workingCopy.revision}:${editorKey}`}
            fluid
            defaultValue={value}
            onChange={(nextValue) => {
              setEditedValue(nextValue)
              commandRef.current = null
              setSaveError(null)
            }}
          />
        </div>
      ) : null}
      <div className={s.note}>
        仅保存到默认编辑副本；公开正文保持不变，需后续发布新 Snapshot 才会更新。
      </div>
      {saveError ? (
        <div role='alert' className={s.error}>
          {saveError}。本地正文仍保留，请核对后重试。
        </div>
      ) : null}
      <div className={s.footer}>
        <button type='button' className={s.back} onClick={onBack}>
          返回
        </button>
        <Button
          size='small'
          loading={saving || workingCopiesQuery.isFetching}
          disabled={!hasChanges || !workingCopy || workingCopiesQuery.isFetching}
          onClick={save}
          space={3}
        >
          保存正文
        </Button>
      </div>
    </div>
  )
}

export default BodySetting
