import { type FC, useCallback, useEffect, useMemo, useState } from 'react'

import useGraphQLClient from '~/hooks/useGraphQLClient'
import useQuery from '~/hooks/useQuery'
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
import { DOC_PUBLISH_PLAN_RELOAD_EVENT, SAVE_ACTION_LABEL_KEY, SAVE_STATUS_LABEL } from './constant'
import useSalon from './salon/save_zone'

type TPublishPlanItem = {
  id: string
  title: string
  action: string
  selectedByDefault: boolean
}

type TPublishPlan = {
  totalCount: number
  docChanges: TPublishPlanItem[]
  treeChanges: TPublishPlanItem[]
}

/**
 * Toggle one publish-plan item id while keeping the checked ids as opaque API ids.
 *
 * @example
 * toggleId(['doc:1'], 'doc:2') // ['doc:1', 'doc:2']
 */
const toggleId = (ids: readonly string[], id: string): string[] => {
  if (ids.includes(id)) return ids.filter((item) => item !== id)

  return [...ids, id]
}

const SaveZone: FC = () => {
  const s = useSalon()
  const { t } = useTrans()
  const { slug: community } = useCommunity()
  const { mutate } = useGraphQLClient()
  const { data: publishPlanData, reload: reloadPublishPlan } = useQuery<{
    docPublishPlan?: TPublishPlan | null
  }>(S.docPublishPlan, { community })
  const { docDraftInfo, reloadDocDraft, reloadSideTree, saveStatus, saveError, saveDocDraft } =
    useDocsEditor()
  const [publishing, setPublishing] = useState(false)
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([])
  const [selectedTreeIds, setSelectedTreeIds] = useState<string[]>([])
  const syncing = saveStatus === 'saving'
  const dirty = saveStatus === 'dirty'
  const error = saveStatus === 'error'
  const labelKey = SAVE_STATUS_LABEL[saveStatus] ?? SAVE_ACTION_LABEL_KEY.SAVED
  const savedLabel = t(SAVE_ACTION_LABEL_KEY.SAVED)
  const label = t(labelKey)
  const title = saveStatus === 'error' && saveError ? saveError : label
  const shouldScroll = label !== savedLabel
  const publishPlan = publishPlanData?.docPublishPlan ?? null
  const totalChanges = publishPlan?.totalCount ?? 0
  const hasSelectedChanges = selectedDocIds.length + selectedTreeIds.length > 0
  const publishDisabled =
    publishing || syncing || (!dirty && !hasSelectedChanges) || (dirty && !docDraftInfo.id)
  const publishMenuDisabled = publishing || syncing
  const publishLabel = publishing
    ? t(SAVE_ACTION_LABEL_KEY.PUBLISHING)
    : totalChanges > 0
      ? `${t(SAVE_ACTION_LABEL_KEY.PUBLISH)} (${totalChanges})`
      : t(SAVE_ACTION_LABEL_KEY.PUBLISH)

  useEffect(() => {
    if (!publishPlan) return

    setSelectedDocIds(
      publishPlan.docChanges.filter((item) => item.selectedByDefault).map((item) => item.id),
    )
    setSelectedTreeIds(
      publishPlan.treeChanges.filter((item) => item.selectedByDefault).map((item) => item.id),
    )
  }, [publishPlan])

  useEffect(() => {
    const reload = (): void => reloadPublishPlan()

    window.addEventListener(DOC_PUBLISH_PLAN_RELOAD_EVENT, reload)
    return () => window.removeEventListener(DOC_PUBLISH_PLAN_RELOAD_EVENT, reload)
  }, [reloadPublishPlan])

  const selectedInput = useMemo(() => {
    if (dirty) return undefined

    return {
      docChangeIds: selectedDocIds,
      treeChangeIds: selectedTreeIds,
    }
  }, [dirty, selectedDocIds, selectedTreeIds])

  const publishDraft = useCallback(async () => {
    if (publishDisabled) return

    setPublishing(true)

    try {
      await saveDocDraft()
      await mutate(S.publishDocChanges, {
        community,
        input: selectedInput,
        mode: 'WITH_COVER_SYNC',
      })
      toast(t(SAVE_ACTION_LABEL_KEY.PUBLISHED))
      reloadDocDraft?.()
      reloadSideTree?.()
      reloadPublishPlan()
    } catch (err) {
      const message = err instanceof Error ? err.message : t(SAVE_ACTION_LABEL_KEY.PUBLISH_FAILED)
      toast(message, 'error')
    } finally {
      setPublishing(false)
    }
  }, [
    community,
    mutate,
    publishDisabled,
    reloadDocDraft,
    reloadPublishPlan,
    reloadSideTree,
    saveDocDraft,
    selectedInput,
    t,
  ])

  const renderPlanSection = (
    title: string,
    items: TPublishPlanItem[],
    selectedIds: string[],
    setSelectedIds: (ids: string[]) => void,
  ) => {
    return (
      <section className={s.publishMenuSection}>
        <div className={s.publishMenuHeading}>
          <span>{title}</span>
          <span className={s.publishMenuCount}>{items.length}</span>
        </div>
        {items.length === 0 ? (
          <div className={s.publishMenuEmpty}>{t(SAVE_ACTION_LABEL_KEY.PUBLISH_NO_CHANGES)}</div>
        ) : (
          items.map((item) => {
            const checked = selectedIds.includes(item.id)

            return (
              <label key={item.id} className={s.publishMenuItem}>
                <input
                  type='checkbox'
                  className={s.publishMenuCheckbox}
                  checked={checked}
                  onChange={() => setSelectedIds(toggleId(selectedIds, item.id))}
                />
                <span className={s.publishMenuText}>
                  <span className={s.publishMenuTitle}>{item.title}</span>
                  <span className={s.publishMenuDesc}>{item.action}</span>
                </span>
              </label>
            )
          })
        )}
      </section>
    )
  }

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
          {publishLabel}
        </button>
        <Tooltip
          placement='top-end'
          trigger='click'
          offset={[20, 12]}
          noPadding
          hideOnClick={false}
          onShow={reloadPublishPlan}
          content={
            <div className={s.publishMenu}>
              {renderPlanSection(
                t(SAVE_ACTION_LABEL_KEY.PUBLISH_DOC_CHANGES),
                publishPlan?.docChanges ?? [],
                selectedDocIds,
                setSelectedDocIds,
              )}
              {renderPlanSection(
                t(SAVE_ACTION_LABEL_KEY.PUBLISH_TREE_CHANGES),
                publishPlan?.treeChanges ?? [],
                selectedTreeIds,
                setSelectedTreeIds,
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
