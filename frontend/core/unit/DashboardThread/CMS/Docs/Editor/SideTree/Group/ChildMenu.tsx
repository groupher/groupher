import type { FC } from 'react'

import useTrans from '~/hooks/useTrans'
import ArchivedSVG from '~/icons/Archived'
import CalendarPlusSVG from '~/icons/CalendarPlus'
import CalendarSlashSVG from '~/icons/CalendarSlash'
import CopySVG from '~/icons/Copy'
import MoreSVG from '~/icons/menu/MoreL'
import EditSVG from '~/icons/PencilSimple'
import DeleteSVG from '~/icons/Trash'
import OverflowMarqueeText from '~/widgets/OverflowMarqueeText'
import Tooltip from '~/widgets/Tooltip'

import { SIDE_TREE_NODE_MENU_ACTION } from '../constant'
import useSalon from '../salon/group/child_menu'
import type { TSideTreeNodeMenuAction } from '../spec'

type TProps = {
  moveToDraftVisible?: boolean
  coverToggleVisible?: boolean
  hiddenFromCover?: boolean
  onSelect: (action: TSideTreeNodeMenuAction) => void
  onOpenChange?: (open: boolean) => void
}

const ChildMenu: FC<TProps> = ({
  moveToDraftVisible = false,
  coverToggleVisible = false,
  hiddenFromCover = false,
  onSelect,
  onOpenChange,
}) => {
  const s = useSalon()
  const { t } = useTrans()
  const coverActionTitle = t(
    hiddenFromCover
      ? 'dsb.cms.docs.side_tree.menu.show_in_cover'
      : 'dsb.cms.docs.side_tree.menu.hide_from_cover',
  )
  const CoverActionIcon = hiddenFromCover ? CalendarPlusSVG : CalendarSlashSVG

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
            onClick={() => onSelect(SIDE_TREE_NODE_MENU_ACTION.RENAME)}
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
            onClick={() => onSelect(SIDE_TREE_NODE_MENU_ACTION.DUPLICATE)}
          >
            <div className={s.iconBox}>
              <CopySVG className={s.itemIcon} />
            </div>
            <OverflowMarqueeText
              text={t('dsb.cms.docs.side_tree.menu.duplicate')}
              className={s.itemTitle}
            />
          </button>
          {moveToDraftVisible && (
            <button
              type='button'
              className={s.item}
              onClick={() => onSelect(SIDE_TREE_NODE_MENU_ACTION.MOVE_TO_DRAFT)}
            >
              <div className={s.iconBox}>
                <ArchivedSVG className={s.itemIcon} />
              </div>
              <OverflowMarqueeText
                text={t('dsb.cms.docs.side_tree.menu.move_to_draft')}
                className={s.itemTitle}
              />
            </button>
          )}
          {coverToggleVisible && (
            <button
              type='button'
              className={s.item}
              onClick={() =>
                onSelect(
                  hiddenFromCover
                    ? SIDE_TREE_NODE_MENU_ACTION.SHOW_IN_COVER
                    : SIDE_TREE_NODE_MENU_ACTION.HIDE_FROM_COVER,
                )
              }
            >
              <div className={s.iconBox}>
                <CoverActionIcon className={s.itemIcon} />
              </div>
              <OverflowMarqueeText text={coverActionTitle} className={s.itemTitle} />
            </button>
          )}
          <button
            type='button'
            className={s.item}
            onClick={() => onSelect(SIDE_TREE_NODE_MENU_ACTION.DELETE)}
          >
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
      <button type='button' className={s.trigger} aria-label='More actions'>
        <MoreSVG className={s.moreIcon} />
      </button>
    </Tooltip>
  )
}

export default ChildMenu
