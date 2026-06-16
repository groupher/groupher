import type { FC } from 'react'

import ArrowSVG from '~/icons/ArrowSimple'
import CheckSVG from '~/icons/Check'

import { SAVE_ACTION } from './constant'
import useSalon from './salon/save_zone'

const SaveZone: FC = () => {
  const s = useSalon()

  return (
    <>
      <button
        type='button'
        className={s.savedButton}
        aria-label={SAVE_ACTION.SAVED}
        title={SAVE_ACTION.SAVED}
      >
        <CheckSVG className={s.savedIcon} />
        <span className={s.text}>{SAVE_ACTION.SAVED}</span>
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
