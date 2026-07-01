import type { FC } from 'react'

import TYPE from '~/const/type'
import useTrans from '~/hooks/useTrans'
import CloseLightSVG from '~/icons/CloseLight'
import SettingSVG from '~/icons/Setting'
import BaseDrawer from '~/widgets/Drawer'

import { SAVE_ACTION_LABEL_KEY } from '../constant'
import useSalon from './salon/drawer'
import ScopeSection from './ScopeSection'
import type { TPublishScope } from './spec'

type TProps = {
  show: boolean
  publishScope: TPublishScope | null
  publishLabel: string
  publishCount: number
  selectedDocIds: string[]
  selectedTreeIds: string[]
  selectedPublishDisabled: boolean
  onClose: () => void
  onPublishSelected: () => void
  onSelectedDocIdsChange: (ids: string[]) => void
  onSelectedTreeIdsChange: (ids: string[]) => void
}

const PublishDrawer: FC<TProps> = ({
  show,
  publishScope,
  publishLabel,
  publishCount,
  selectedDocIds,
  selectedTreeIds,
  selectedPublishDisabled,
  onClose,
  onPublishSelected,
  onSelectedDocIdsChange,
  onSelectedTreeIdsChange,
}) => {
  const s = useSalon()
  const { t } = useTrans()

  return (
    <BaseDrawer show={show} onClose={onClose} type={TYPE.DRAWER.DOC_PUBLISH}>
      <div className={s.drawer}>
        <div className={s.header}>
          <div className={s.titleGroup}>
            <SettingSVG className={s.titleIcon} />
            <div className={s.title}>{t(SAVE_ACTION_LABEL_KEY.PUBLISH_OPTIONS)}</div>
          </div>
          <button
            type='button'
            className={s.closeButton}
            aria-label={t(SAVE_ACTION_LABEL_KEY.PUBLISH_OPTIONS_CLOSE)}
            onClick={onClose}
          >
            <CloseLightSVG className={s.closeIcon} />
          </button>
        </div>

        <div className={s.body}>
          <div className={s.menu}>
            {(publishScope?.docChanges.length ?? 0) > 0 && (
              <ScopeSection
                title={t(SAVE_ACTION_LABEL_KEY.PUBLISH_DOC_CHANGES)}
                items={publishScope?.docChanges ?? []}
                selectedIds={selectedDocIds}
                onSelectedIdsChange={onSelectedDocIdsChange}
              />
            )}
            {(publishScope?.treeChanges.length ?? 0) > 0 && (
              <ScopeSection
                title={t(SAVE_ACTION_LABEL_KEY.PUBLISH_TREE_CHANGES)}
                items={publishScope?.treeChanges ?? []}
                selectedIds={selectedTreeIds}
                onSelectedIdsChange={onSelectedTreeIdsChange}
              />
            )}
          </div>
        </div>

        <div className={s.footer}>
          <button
            type='button'
            className={s.publishButton}
            disabled={selectedPublishDisabled}
            onClick={onPublishSelected}
          >
            {publishLabel}
            {publishCount > 0 && <span className={s.publishCount}>{publishCount}</span>}
          </button>
        </div>
      </div>
    </BaseDrawer>
  )
}

export default PublishDrawer
