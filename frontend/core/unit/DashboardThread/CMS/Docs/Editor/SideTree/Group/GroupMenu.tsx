import type { FC } from 'react'

import useTrans from '~/hooks/useTrans'
import PlusSVG from '~/icons/Add'
import ArchivedSVG from '~/icons/Archived'
import CalendarPlusSVG from '~/icons/CalendarPlus'
import CalendarSlashSVG from '~/icons/CalendarSlash'
import MoreSVG from '~/icons/menu/MoreL'
import PaperPlaneTiltSVG from '~/icons/PaperPlaneTilt'
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
  publishVisible?: boolean
  draftVisible?: boolean
  onSelect: (action: TSideTreeGroupMenuAction) => void
  onOpenChange?: (open: boolean) => void
}

const GroupMenu: FC<TProps> = ({
  inCover = false,
  open = false,
  publishVisible = false,
  draftVisible = false,
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
          {publishVisible && (
            <button
              type='button'
              className={s.item}
              onClick={() => onSelect(SIDE_TREE_GROUP_MENU_ACTION.PUBLISH_GROUP)}
            >
              <div className={s.iconBox}>
                <PaperPlaneTiltSVG className={s.itemIcon} />
              </div>
              <OverflowMarqueeText
                text={t('dsb.cms.docs.side_tree.menu.publish_group')}
                className={s.itemTitle}
              />
            </button>
          )}
          {draftVisible && (
            <button
              type='button'
              className={s.item}
              onClick={() => onSelect(SIDE_TREE_GROUP_MENU_ACTION.MOVE_GROUP_TO_DRAFT)}
            >
              <div className={s.iconBox}>
                <ArchivedSVG className={s.itemIcon} />
              </div>
              <OverflowMarqueeText
                text={t('dsb.cms.docs.side_tree.menu.move_group_to_draft')}
                className={s.itemTitle}
              />
            </button>
          )}
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
      <button type='button' className={s.trigger} aria-label='Group actions'>
        <MoreSVG className={s.moreIcon} />
      </button>
    </Tooltip>
  )
}

export default GroupMenu
