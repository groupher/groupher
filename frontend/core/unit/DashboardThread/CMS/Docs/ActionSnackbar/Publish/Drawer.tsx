import type { FC } from 'react'

import TYPE from '~/const/type'
import useTrans from '~/hooks/useTrans'
import CloseLightSVG from '~/icons/CloseLight'
import SettingSVG from '~/icons/Setting'
import BaseDrawer from '~/widgets/Drawer'

import { SAVE_ACTION_LABEL_KEY } from '../constant'
import ChecklistSection from './ChecklistSection'
import PublishPlan from './PublishPlan'
import useSalon from './salon/drawer'
import type { TPublishPlan, TPublishChecklist } from './spec'

type TProps = {
  show: boolean
  publishPlan: TPublishPlan
  publishChecklist: TPublishChecklist | null
  publishLabel: string
  publishCountLabel: string | null
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
  publishPlan,
  publishChecklist,
  publishLabel,
  publishCountLabel,
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
            {(publishChecklist?.docChanges.length ?? 0) > 0 && (
              <ChecklistSection
                title={t(SAVE_ACTION_LABEL_KEY.PUBLISH_DOC_CHANGES)}
                items={publishChecklist?.docChanges ?? []}
                selectedIds={selectedDocIds}
                onSelectedIdsChange={onSelectedDocIdsChange}
              />
            )}
            {(publishChecklist?.treeChanges.length ?? 0) > 0 && (
              <ChecklistSection
                title={t(SAVE_ACTION_LABEL_KEY.PUBLISH_TREE_CHANGES)}
                items={publishChecklist?.treeChanges ?? []}
                selectedIds={selectedTreeIds}
                onSelectedIdsChange={onSelectedTreeIdsChange}
              />
            )}
          </div>
        </div>

        <div className={s.footer}>
          <PublishPlan plan={publishPlan} />
          <div className={s.footerActions}>
            <button
              type='button'
              className={s.publishButton}
              disabled={selectedPublishDisabled}
              onClick={onPublishSelected}
            >
              {publishLabel}
              {publishCountLabel && <span className={s.publishCount}>{publishCountLabel}</span>}
            </button>
          </div>
        </div>
      </div>
    </BaseDrawer>
  )
}

export default PublishDrawer
