import ArrowSimpleSVG from '~/icons/ArrowSimple'
import ShareNetworkSVG from '~/icons/ShareNetwork'
import Tooltip from '~/widgets/Tooltip'

import { SHARE_ACTIONS } from '../constant'
import MenuItem from '../MenuItem'
import useSalon, { cn } from '../salon/action'

export default function Share() {
  const s = useSalon()

  return (
    <Tooltip
      trigger='click'
      placement='bottom-end'
      noPadding
      hideOnClick
      content={
        <div className={cn(s.menuPanel, s.shareMenuPanel)}>
          {SHARE_ACTIONS.map(({ key, ...item }) => (
            <MenuItem key={key} {...item} />
          ))}
        </div>
      }
    >
      <button type='button' className={s.actionBtn}>
        <ShareNetworkSVG className={s.actionIcon} />
        <span className={s.actionText}>Share</span>
        <ArrowSimpleSVG className={s.actionArrow} />
      </button>
    </Tooltip>
  )
}
