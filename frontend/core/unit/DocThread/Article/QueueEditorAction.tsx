'use client'

import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'

import { browserGraphQLRequest } from '~/graphql/client'
import useTrans from '~/hooks/useTrans'
import useAccount from '~/stores/account/hooks'
import useCommunity from '~/stores/community/hooks'
import QueueEditorDrawer from '~/unit/DsbThread/CMS/Docs/ActionSnackbar/Publish/QueueEditorDrawer'

import { queueEditorPermissions, queueMemberEditor } from '../schema'
import useSalon from './Header/salon/action'

type TPermissionResponse = { articlePermissions?: { permissions: string[] } | null }
type TMemberResponse = { docsQueueMember?: { queueRevision: number } | null }

type TProps = { articleId: string }

export default function QueueEditorAction({ articleId }: TProps) {
  const s = useSalon()
  const { t } = useTrans()
  const { slug: community } = useCommunity()
  const { accountScope, user } = useAccount()
  const [show, setShow] = useState(false)

  const permissionsQuery = useQuery({
    queryKey: ['doc-queue-editor-permissions', accountScope, articleId],
    queryFn: () =>
      browserGraphQLRequest<TPermissionResponse>(queueEditorPermissions, { articleId }),
    enabled: !!user?.login && !!articleId && !!accountScope,
  })
  const permissions = permissionsQuery.data?.articlePermissions?.permissions ?? []
  const canEditQueueCopy =
    permissions.includes('ARTICLE_READ_DRAFT') && permissions.includes('ARTICLE_UPDATE')

  const memberQuery = useQuery({
    queryKey: ['doc-queue-member-editor', accountScope, community, articleId],
    queryFn: () =>
      browserGraphQLRequest<TMemberResponse>(queueMemberEditor, { community, articleId }),
    enabled: canEditQueueCopy && !!community,
  })
  const member = memberQuery.data?.docsQueueMember

  if (!canEditQueueCopy || !member) return null

  return (
    <>
      <button type='button' className={s.actionBtn} onClick={() => setShow(true)}>
        <span className={s.actionText}>{t('dsb.doc.queue.editor_open')}</span>
      </button>
      {show && (
        <QueueEditorDrawer
          articleId={articleId}
          onClose={() => setShow(false)}
          onSaved={() => void memberQuery.refetch()}
        />
      )}
    </>
  )
}
