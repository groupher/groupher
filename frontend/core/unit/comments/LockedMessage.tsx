import useTrans from '~/hooks/useTrans'
import LockSVG from '~/icons/Lock'

import useSalon from './salon/locked_message'

export default function LockedMessage() {
  const s = useSalon()
  const { t } = useTrans()

  return (
    <div className={s.wrapper}>
      <LockSVG className={s.lockIcon} />
      <div className={s.msg}>{t('comment.locked.message')}</div>
    </div>
  )
}
