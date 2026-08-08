import ArrowSimpleSVG from '~/icons/ArrowSimple'
import CopySVG from '~/icons/Copy'
import Tooltip from '~/ui/Tooltip'

import { COPY_ACTIONS } from '../constant'
import MenuItem from '../MenuItem'
import useSalon from '../salon/action'

export default function Copy() {
  const s = useSalon()

  return (
    <Tooltip
      trigger='click'
      placement='bottom-end'
      noPadding
      hideOnClick
      content={
        <div className={s.menuPanel}>
          {COPY_ACTIONS.map(({ key, ...item }) => (
            <MenuItem key={key} {...item} />
          ))}
        </div>
      }
    >
      <button type='button' className={s.actionBtn}>
        <CopySVG className={s.actionIcon} />
        <span className={s.actionText}>Copy</span>
        <ArrowSimpleSVG className={s.actionArrow} />
      </button>
    </Tooltip>
  )
}
