import { type FC, useCallback, useState } from 'react'

import useGraphQLClient from '~/hooks/useGraphQLClient'
import useTrans from '~/hooks/useTrans'
import ArrowSVG from '~/icons/ArrowSimple'
import CheckSVG from '~/icons/Check'
import RefreshCwSVG from '~/icons/RefreshCw'
import useCommunity from '~/stores/community/hooks'
import S from '~/unit/DashboardThread/schema'
import OverflowMarqueeText from '~/widgets/OverflowMarqueeText'
import { toast } from '~/widgets/Toaster'
import Tooltip from '~/widgets/Tooltip'

import useDocsEditor from '../Editor/store/hooks'
import { SAVE_ACTION_LABEL_KEY, SAVE_STATUS_LABEL } from './constant'
import useSalon from './salon/save_zone'

type TPublishMode = 'WITH_COVER_SYNC' | 'DOC_ONLY' | 'ALL_UNPUBLISHED'

const SaveZone: FC = () => {
  const s = useSalon()
  const { t } = useTrans()
  const { slug: community } = useCommunity()
  const { mutate } = useGraphQLClient()
  const { docDraftInfo, reloadDocDraft, reloadSideTree, saveStatus, saveError, saveDocDraft } =
    useDocsEditor()
  const [publishing, setPublishing] = useState(false)
  const [publishMode, setPublishMode] = useState<TPublishMode>('WITH_COVER_SYNC')
  const syncing = saveStatus === 'saving'
  const dirty = saveStatus === 'dirty'
  const error = saveStatus === 'error'
  const labelKey = SAVE_STATUS_LABEL[saveStatus] ?? SAVE_ACTION_LABEL_KEY.SAVED
  const savedLabel = t(SAVE_ACTION_LABEL_KEY.SAVED)
  const label = t(labelKey)
  const title = saveStatus === 'error' && saveError ? saveError : label
  const shouldScroll = label !== savedLabel
  const publishAllUnpublished = publishMode === 'ALL_UNPUBLISHED'
  const publishDisabled = publishing || syncing || (!publishAllUnpublished && !docDraftInfo.id)
  const publishMenuDisabled = publishing || syncing

  const publishDraft = useCallback(async () => {
    if (publishDisabled) return

    setPublishing(true)

    try {
      await saveDocDraft()
      if (publishAllUnpublished) {
        await mutate(S.publishAllUnpublishedDocDrafts, {
          community,
          mode: 'WITH_COVER_SYNC',
        })
        toast(t(SAVE_ACTION_LABEL_KEY.PUBLISHED_ALL_UNPUBLISHED))
      } else {
        await mutate(S.publishDocDraftRevision, {
          community,
          id: docDraftInfo.id,
          mode: publishMode,
        })
        toast(t(SAVE_ACTION_LABEL_KEY.PUBLISHED))
      }
      reloadDocDraft?.()
      reloadSideTree?.()
    } catch (err) {
      const message = err instanceof Error ? err.message : t(SAVE_ACTION_LABEL_KEY.PUBLISH_FAILED)
      toast(message, 'error')
    } finally {
      setPublishing(false)
    }
  }, [
    community,
    docDraftInfo.id,
    mutate,
    publishAllUnpublished,
    publishDisabled,
    publishMode,
    reloadDocDraft,
    reloadSideTree,
    saveDocDraft,
    t,
  ])

  const renderPublishMode = (mode: TPublishMode, title: string, desc: string) => (
    <button type='button' className={s.publishMenuItem} onClick={() => setPublishMode(mode)}>
      <span>{publishMode === mode && <CheckSVG className={s.publishMenuCheck} />}</span>
      <span>
        <span className={s.publishMenuTitle}>{title}</span>
        <span className={s.publishMenuDesc}>{desc}</span>
      </span>
    </button>
  )

  return (
    <>
      <button
        type='button'
        className={s.savedButton}
        aria-label={label}
        title={title}
        onClick={saveDocDraft}
      >
        <span className={s.iconSlot}>
          {syncing && <RefreshCwSVG className={s.syncIcon} />}
          {dirty && <span className={s.dirtyDot} />}
          {error && <span className={s.errorDot} />}
          {!syncing && !dirty && !error && <CheckSVG className={s.savedIcon} />}
        </span>
        <OverflowMarqueeText
          text={label}
          active={shouldScroll}
          mode='always'
          className={s.textViewport}
          itemClassName={s.textTrackItem}
        />
      </button>

      <div className={s.publishGroup} title={t(SAVE_ACTION_LABEL_KEY.PUBLISH_SCOPE)}>
        <button
          type='button'
          className={s.publishButton}
          aria-label={t(SAVE_ACTION_LABEL_KEY.PUBLISH_CURRENT)}
          disabled={publishDisabled}
          onClick={publishDraft}
        >
          {publishing ? t(SAVE_ACTION_LABEL_KEY.PUBLISHING) : t(SAVE_ACTION_LABEL_KEY.PUBLISH)}
        </button>
        <Tooltip
          placement='top-end'
          trigger='click'
          offset={[20, 12]}
          noPadding
          hideOnClick
          content={
            <div className={s.publishMenu}>
              {renderPublishMode(
                'WITH_COVER_SYNC',
                t(SAVE_ACTION_LABEL_KEY.PUBLISH_WITH_COVER_SYNC),
                t(SAVE_ACTION_LABEL_KEY.PUBLISH_WITH_COVER_SYNC_DESC),
              )}
              {renderPublishMode(
                'DOC_ONLY',
                t(SAVE_ACTION_LABEL_KEY.PUBLISH_DOC_ONLY),
                t(SAVE_ACTION_LABEL_KEY.PUBLISH_DOC_ONLY_DESC),
              )}
              {renderPublishMode(
                'ALL_UNPUBLISHED',
                t(SAVE_ACTION_LABEL_KEY.PUBLISH_ALL_UNPUBLISHED),
                t(SAVE_ACTION_LABEL_KEY.PUBLISH_ALL_UNPUBLISHED_DESC),
              )}
            </div>
          }
        >
          <button
            type='button'
            className={s.publishMenuButton}
            aria-label={t(SAVE_ACTION_LABEL_KEY.PUBLISH_OPTIONS)}
            title={t(SAVE_ACTION_LABEL_KEY.PUBLISH_OPTIONS)}
            disabled={publishMenuDisabled}
          >
            <ArrowSVG className={s.publishIcon} />
          </button>
        </Tooltip>
      </div>
    </>
  )
}

export default SaveZone
