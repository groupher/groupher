import LockSVG from '~/icons/Lock'

import useSalon from './salon/locked_message'

export default () => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <LockSVG className={s.lockIcon} />
      <div className={s.msg}>讨论已关闭, 不再接受新回复</div>
    </div>
  )
}
