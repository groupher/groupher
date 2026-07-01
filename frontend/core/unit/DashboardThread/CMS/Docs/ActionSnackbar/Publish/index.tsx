import { useCallback, useState, type FC } from 'react'

import useTrans from '~/hooks/useTrans'

import useDocsEditor from '../../Editor/store/hooks'
import { SAVE_ACTION_LABEL_KEY } from '../constant'
import ActionGroup from './ActionGroup'
import { PUBLISH_MODE } from './constant'
import PublishDrawer from './Drawer'
import usePublishActions from './usePublishActions'
import usePublishScope from './usePublishScope'

const Publish: FC = () => {
  const { t } = useTrans()
  const { publishView } = useDocsEditor()
  const [drawerVisible, setDrawerVisible] = useState(false)
  const {
    hasSelectedChanges,
    publishScope,
    reloadPublishScope,
    selectedDocIds,
    selectedInput,
    selectedTreeIds,
    setSelectedDocIds,
    setSelectedTreeIds,
  } = usePublishScope()
  const selectedPublishDisabled =
    publishView.isPublishing || publishView.isSaving || !hasSelectedChanges

  const publishLabel = publishView.isPublishing
    ? t(SAVE_ACTION_LABEL_KEY.PUBLISHING)
    : t(SAVE_ACTION_LABEL_KEY.PUBLISH)

  const closeDrawer = useCallback(() => setDrawerVisible(false), [])

  const { publishDraft } = usePublishActions({
    reloadPublishScope,
    selectedInput,
    selectedPublishDisabled,
    onPublished: closeDrawer,
  })
  const openOptions = useCallback(() => {
    reloadPublishScope()
    setDrawerVisible(true)
  }, [reloadPublishScope])

  return (
    <>
      <ActionGroup
        publishLabel={publishLabel}
        publishCount={publishView.publishCount}
        showActions={publishView.showActions}
        publishDisabled={publishView.publishDisabled}
        optionsDisabled={publishView.optionsDisabled}
        onPublishAll={() => publishDraft(PUBLISH_MODE.ALL)}
        onOpenOptions={openOptions}
      />

      {publishView.showActions && (
        <PublishDrawer
          show={drawerVisible}
          publishScope={publishScope}
          publishLabel={publishLabel}
          publishCount={publishView.publishCount}
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
