import LockSVG from '~/icons/Lock'
import useTrans from '~/hooks/useTrans'

import useSalon from './salon/locked_message'

export default () => {
  const s = useSalon()
  const { t } = useTrans()

  return (
    <div className={s.wrapper}>
      <LockSVG className={s.lockIcon} />
      <div className={s.msg}>{t('comment.locked.message')}</div>
    </div>
  )
}
