import { type FC, useState } from 'react'

import useTrans from '~/hooks/useTrans'
import BoxAddSVG from '~/icons/BoxAdd'
import SendSVG from '~/icons/PaperPlaneTilt'
import QuestionSVG from '~/icons/Question'
import TrashSVG from '~/icons/Trash'

import SavingBar from '../../../../SavingBar'
import useSalon from './salon/footer'
import type { TDocTreeState } from './spec'

type TProps = {
  treeState: TDocTreeState | null
  onPublish: () => Promise<void>
}

const Footer: FC<TProps> = ({ treeState, onPublish }) => {
  const s = useSalon()
  const { t } = useTrans()
  const [publishing, setPublishing] = useState(false)
  const changed = treeState?.hasUnpublishedChanges === true
  const eventCount = treeState?.stagedEventCount ?? 0

  const handlePublish = (): void => {
    if (publishing) return

    setPublishing(true)
    onPublish().finally(() => setPublishing(false))
  }

  if (changed) {
    return (
      <footer className={s.wrapper}>
        <div className={s.divider} />
        <div className={s.content}>
          <SavingBar
            isTouched
            minimal
            width='w-full'
            loading={publishing}
            disabled={publishing}
            saveText={t('dsb.cms.docs.side_tree.publish.tree_publish')}
            saveIcon={SendSVG}
            onCancel={() => undefined}
            onConfirm={handlePublish}
          >
            <div className={s.publishLabel}>
              {t('dsb.cms.docs.side_tree.publish.changes')}
              {eventCount > 0 && <span className={s.eventCount}>{eventCount}</span>}
            </div>
          </SavingBar>
        </div>
      </footer>
    )
  }

  return (
    <footer className={s.wrapper}>
      <div className={s.divider} />
      <div className={s.content}>
        <button type='button' className={s.iconButton} aria-label='Trash'>
          <TrashSVG className={s.icon} />
          <span className={s.count}>0</span>
        </button>
        <div className={s.grow} />
        <button type='button' className={s.iconButton} aria-label='Assets'>
          <BoxAddSVG className={s.icon} />
          <span className={s.count}>0</span>
        </button>
        <button type='button' className={s.iconOnlyButton} aria-label='Help'>
          <QuestionSVG className={s.icon} />
        </button>
      </div>
    </footer>
  )
}

export default Footer
