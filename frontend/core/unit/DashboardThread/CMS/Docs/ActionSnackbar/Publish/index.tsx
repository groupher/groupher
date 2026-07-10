import { useCallback, useState, type FC } from 'react'

import useTrans from '~/hooks/useTrans'

import useDocsEditor from '../../Editor/store/hooks'
import { SAVE_ACTION_LABEL_KEY } from '../constant'
import ActionGroup from './ActionGroup'
import { PUBLISH_MODE } from './constant'
import PublishDrawer from './Drawer'
import { getPublishPlanAction } from './helper'
import usePublishActions from './usePublishActions'
import type { TPublishChecklistController } from './usePublishChecklist'

type TProps = {
  variant?: 'article' | 'tree'
  checklist: TPublishChecklistController
}

const Publish: FC<TProps> = ({ variant = 'article', checklist }) => {
  const { t } = useTrans()
  const { publishView } = useDocsEditor()
  const [drawerVisible, setDrawerVisible] = useState(false)
  const {
    hasSelectedChanges,
    publishPlan,
    publishChecklist,
    publishCountLabel,
    reloadPublishChecklist,
    selectedDocIds,
    selectedInput,
    selectedTreeIds,
    setSelectedDocIds,
    setSelectedTreeIds,
  } = checklist
  const selectedPublishDisabled =
    publishView.isPublishing || publishView.isSaving || !hasSelectedChanges

  const publishLabel = publishView.isPublishing
    ? t(SAVE_ACTION_LABEL_KEY.PUBLISHING)
    : t(SAVE_ACTION_LABEL_KEY.PUBLISH)
  const publishPlanAction = getPublishPlanAction(publishPlan)
  const selectedPublishLabel = publishView.isPublishing
    ? t(SAVE_ACTION_LABEL_KEY.PUBLISHING)
    : publishPlanAction === 'restore'
      ? t(SAVE_ACTION_LABEL_KEY.RESTORE)
      : publishPlanAction === 'apply'
        ? t(SAVE_ACTION_LABEL_KEY.APPLY_CHANGES)
        : t(SAVE_ACTION_LABEL_KEY.PUBLISH)

  const closeDrawer = useCallback(() => setDrawerVisible(false), [])

  const { publishDraft } = usePublishActions({
    reloadPublishChecklist,
    selectedInput,
    selectedPublishDisabled,
    onPublished: closeDrawer,
  })
  const openOptions = useCallback(() => {
    reloadPublishChecklist()
    setDrawerVisible(true)
  }, [reloadPublishChecklist])

  return (
    <>
      <ActionGroup
        variant={variant}
        publishLabel={publishLabel}
        reviewLabel={t(SAVE_ACTION_LABEL_KEY.REVIEW_CHANGES)}
        publishCountLabel={publishCountLabel}
        showActions={publishView.showActions}
        publishDisabled={publishView.publishDisabled}
        optionsDisabled={publishView.optionsDisabled}
        onPublishAll={() => publishDraft(PUBLISH_MODE.ALL)}
        onOpenOptions={openOptions}
      />

      {publishView.showActions && (
        <PublishDrawer
          show={drawerVisible}
          publishPlan={publishPlan}
          publishChecklist={publishChecklist}
          publishLabel={selectedPublishLabel}
          publishCountLabel={publishCountLabel}
          selectedDocIds={selectedDocIds}
          selectedTreeIds={selectedTreeIds}
          selectedPublishDisabled={selectedPublishDisabled}
          onClose={closeDrawer}
          onPublishSelected={() => publishDraft(PUBLISH_MODE.SELECTED)}
          onSelectedDocIdsChange={setSelectedDocIds}
          onSelectedTreeIdsChange={setSelectedTreeIds}
        />
      )}
    </>
  )
}

export default Publish
