import type { FC } from 'react'

import ArrowSVG from '~/icons/ArrowSimple'
import CheckSVG from '~/icons/Check'
import RefreshCwSVG from '~/icons/RefreshCw'

import useDocsEditor from '../Editor/store/hooks'
import { SAVE_ACTION, SAVE_STATUS_LABEL } from './constant'
import useSalon from './salon/save_zone'

const SaveZone: FC = () => {
  const s = useSalon()
  const { saveStatus, saveError, saveDocDraft } = useDocsEditor()
  const syncing = saveStatus === 'saving'
  const dirty = saveStatus === 'dirty'
  const error = saveStatus === 'error'
  const label = SAVE_STATUS_LABEL[saveStatus] ?? SAVE_ACTION.SAVED
  const title = saveStatus === 'error' && saveError ? saveError : label
  const shouldScroll = label !== SAVE_ACTION.SAVED

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
        <span className={s.textViewport}>
          {shouldScroll ? (
            <span className={s.textTrack}>
              <span className={s.textTrackItem}>{label}</span>
              <span className={s.textTrackItem} aria-hidden='true'>
                {label}
              </span>
            </span>
          ) : (
            <span className={s.text}>{label}</span>
          )}
        </span>
      </button>

      <div className={s.publishGroup} title={SAVE_ACTION.PUBLISH_SCOPE}>
        <button type='button' className={s.publishButton} aria-label={SAVE_ACTION.PUBLISH_CURRENT}>
          {SAVE_ACTION.PUBLISH}
        </button>
        <button
          type='button'
          className={s.publishMenuButton}
          aria-label={SAVE_ACTION.PUBLISH_OPTIONS}
          title={SAVE_ACTION.PUBLISH_OPTIONS}
        >
          <ArrowSVG className={s.publishIcon} />
        </button>
      </div>
    </>
  )
}

export default SaveZone
