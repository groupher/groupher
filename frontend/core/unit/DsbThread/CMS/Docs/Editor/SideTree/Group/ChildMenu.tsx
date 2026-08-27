import type { FC } from 'react'

import useTrans from '~/hooks/useTrans'
import ArchivedSVG from '~/icons/Archived'
import CopySVG from '~/icons/Copy'
import MoreSVG from '~/icons/menu/MoreL'
import EditSVG from '~/icons/PencilSimple'
import PinSVG from '~/icons/Pin'
import DeleteSVG from '~/icons/Trash'
import OverflowMarqueeText from '~/ui/OverflowMarqueeText'
import Tooltip from '~/ui/Tooltip'

import { SIDE_TREE_NODE_MENU_ACTION } from '../constant'
import useSalon from '../salon/group/child_menu'
import type { TSideTreeNodeMenuAction } from '../spec'

type TProps = {
  moveToDraftVisible?: boolean
  pinAction?: 'pin' | 'unpin'
  onSelect: (action: TSideTreeNodeMenuAction) => void
  onOpenChange?: (open: boolean) => void
}

const ChildMenu: FC<TProps> = ({
  moveToDraftVisible = false,
  pinAction,
  onSelect,
  onOpenChange,
}) => {
  const s = useSalon()
  const { t } = useTrans()

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
          {pinAction && (
            <button
              type='button'
              className={s.item}
              onClick={() =>
                onSelect(
                  pinAction === 'pin'
                    ? SIDE_TREE_NODE_MENU_ACTION.PIN_TO_COVER
                    : SIDE_TREE_NODE_MENU_ACTION.UNPIN_FROM_COVER,
                )
              }
            >
              <div className={s.iconBox}>
                <PinSVG className={s.itemIcon} />
              </div>
              <OverflowMarqueeText
                text={t(
                  pinAction === 'pin'
                    ? 'dsb.cms.docs.side_tree.menu.pin_to_cover'
                    : 'dsb.cms.docs.side_tree.menu.unpin_from_cover',
                )}
                className={s.itemTitle}
              />
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

export default ChildMenu
