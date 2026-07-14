import type { FC } from 'react'

import useTrans from '~/hooks/useTrans'
import MoreSVG from '~/icons/menu/MoreL'
import EditSVG from '~/icons/PencilSimple'
import DeleteSVG from '~/icons/Trash'
import OverflowMarqueeText from '~/widgets/OverflowMarqueeText'
import Tooltip from '~/widgets/Tooltip'

import useSalon from '../salon/pin_menu'

type TProps = {
  onDelete: () => void
  onEdit: () => void
  onOpenChange?: (open: boolean) => void
}

const PinMenu: FC<TProps> = ({ onDelete, onEdit, onOpenChange }) => {
  const s = useSalon()
  const { t } = useTrans()

  return (
    <Tooltip
      placement='bottom-end'
      trigger='click'
      offset={[10, 4]}
      noPadding
      hideOnClick
      portalToBody
      onShow={() => onOpenChange?.(true)}
      onHide={() => onOpenChange?.(false)}
      content={
        <div className={s.menu}>
          <button type='button' className={s.item} onClick={onEdit}>
            <div className={s.iconBox}>
              <EditSVG className={s.itemIcon} />
            </div>
            <OverflowMarqueeText
              text={t('dsb.cms.docs.side_tree.menu.edit')}
              className={s.itemTitle}
            />
          </button>
          <button type='button' className={s.item} onClick={onDelete}>
            <div className={s.iconBox}>
              <DeleteSVG className={s.itemIcon} />
            </div>
            <OverflowMarqueeText
              text={t('dsb.cms.docs.side_tree.menu.delete')}
              className={s.itemTitle}
            />
          </button>
        </div>
      }
    >
      <button
        type='button'
        className={s.trigger}
        aria-label={t('dsb.cms.docs.side_tree.more_actions')}
      >
        <MoreSVG className={s.moreIcon} />
      </button>
    </Tooltip>
  )
}

export default PinMenu
