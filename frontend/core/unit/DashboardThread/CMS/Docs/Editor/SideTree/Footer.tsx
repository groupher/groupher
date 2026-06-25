import { type FC, useState } from 'react'

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
            saveText='Publish'
            saveIcon={SendSVG}
            onCancel={() => undefined}
            onConfirm={handlePublish}
          >
            <div className={s.publishLabel}>
              Changes
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
