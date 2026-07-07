import { useCallback, useState, type FC } from 'react'

import useTrans from '~/hooks/useTrans'

import useDocsEditor from '../../Editor/store/hooks'
import { SAVE_ACTION_LABEL_KEY } from '../constant'
import ActionGroup from './ActionGroup'
import { PUBLISH_MODE } from './constant'
import PublishDrawer from './Drawer'
import { getPublishPlanAction } from './helper'
import usePublishActions from './usePublishActions'
import usePublishChecklist from './usePublishChecklist'

const Publish: FC = () => {
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
  } = usePublishChecklist()
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
        publishLabel={publishLabel}
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
