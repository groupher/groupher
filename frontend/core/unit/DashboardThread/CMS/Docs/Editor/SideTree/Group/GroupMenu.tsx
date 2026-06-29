import type { FC } from 'react'

import useTrans from '~/hooks/useTrans'
import PlusSVG from '~/icons/Add'
import CalendarPlusSVG from '~/icons/CalendarPlus'
import CalendarSlashSVG from '~/icons/CalendarSlash'
import MoreSVG from '~/icons/menu/MoreL'
import EditSVG from '~/icons/PencilSimple'
import DeleteSVG from '~/icons/Trash'
import OverflowMarqueeText from '~/widgets/OverflowMarqueeText'
import Tooltip from '~/widgets/Tooltip'

import { SIDE_TREE_GROUP_MENU_ACTION } from '../constant'
import useSalon from '../salon/group/group_menu'
import type { TSideTreeGroupMenuAction } from '../spec'

type TProps = {
  inCover?: boolean
  open?: boolean
  onSelect: (action: TSideTreeGroupMenuAction) => void
  onOpenChange?: (open: boolean) => void
}

const GroupMenu: FC<TProps> = ({
  inCover = false,
  open = false,
  onSelect,
  onOpenChange,
}) => {
  const s = useSalon({ active: open })
  const { t } = useTrans()
  const coverActionTitle = t(
    inCover
      ? 'dsb.cms.docs.side_tree.menu.remove_from_cover'
      : 'dsb.cms.docs.side_tree.menu.add_to_cover',
  )
  const CoverActionIcon = inCover ? CalendarSlashSVG : CalendarPlusSVG

  return (
    <Tooltip
      placement='bottom-end'
      trigger='click'
      offset={[14, 5]}
      noPadding
      hideOnClick
      portalToBody
      onShow={() => onOpenChange?.(true)}
      onHide={() => onOpenChange?.(false)}
      content={
        <div className={s.menu}>
          <button
            type='button'
            className={s.item}
            onClick={() => onSelect(SIDE_TREE_GROUP_MENU_ACTION.PAGE)}
          >
            <div className={s.iconBox}>
              <PlusSVG className={s.itemIcon} />
            </div>
            <OverflowMarqueeText
              text={t('dsb.cms.docs.side_tree.menu.new_page')}
              className={s.itemTitle}
            />
          </button>
          <button
            type='button'
            className={s.item}
            onClick={() => onSelect(SIDE_TREE_GROUP_MENU_ACTION.RENAME)}
          >
            <div className={s.iconBox}>
              <EditSVG className={s.itemIcon} />
            </div>
            <OverflowMarqueeText
              text={t('dsb.cms.docs.side_tree.menu.rename')}
              className={s.itemTitle}
            />
          </button>
          <button
            type='button'
            className={s.item}
            onClick={() =>
              onSelect(
                inCover
                  ? SIDE_TREE_GROUP_MENU_ACTION.REMOVE_FROM_COVER
                  : SIDE_TREE_GROUP_MENU_ACTION.ADD_TO_COVER,
              )
            }
          >
            <div className={s.iconBox}>
              <CoverActionIcon className={s.itemIcon} />
            </div>
            <OverflowMarqueeText text={coverActionTitle} className={s.itemTitle} />
          </button>
          <button
            type='button'
            className={s.itemDanger}
            onClick={() => onSelect(SIDE_TREE_GROUP_MENU_ACTION.DELETE)}
          >
            <div className={s.iconBox}>
              <DeleteSVG className={s.itemDangerIcon} />
            </div>
            <OverflowMarqueeText
              text={t('dsb.cms.docs.side_tree.menu.delete')}
              className={s.itemDangerTitle}
            />
          </button>
        </div>
      }
    >
      <button
        type='button'
        className={s.trigger}
        aria-label={t('dsb.cms.docs.side_tree.group_actions')}
      >
        <MoreSVG className={s.moreIcon} />
      </button>
    </Tooltip>
  )
}

export default GroupMenu
