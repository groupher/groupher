import type { FC } from 'react'

import useTrans from '~/hooks/useTrans'
import CopySVG from '~/icons/Copy'
import EditSVG from '~/icons/EditPen'
import MoreSVG from '~/icons/menu/MoreL'
import DeleteSVG from '~/icons/Trash'
import Tooltip from '~/widgets/Tooltip'

import { SIDE_TREE_NODE_MENU_ACTION } from './constant'
import useSalon from './salon/node_action_menu'
import type { TSideTreeNodeMenuAction } from './spec'

type TProps = {
  onSelect: (action: TSideTreeNodeMenuAction) => void
  onOpenChange?: (open: boolean) => void
}

const NodeActionMenu: FC<TProps> = ({ onSelect, onOpenChange }) => {
  const s = useSalon()
  const { t } = useTrans()

  return (
    <Tooltip
      placement='bottom-end'
      trigger='click'
      offset={[0, 6]}
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
            <span className={s.itemTitle}>{t('dsb.cms.docs.side_tree.menu.rename')}</span>
          </button>
          <button
            type='button'
            className={s.item}
            onClick={() => onSelect(SIDE_TREE_NODE_MENU_ACTION.DUPLICATE)}
          >
            <div className={s.iconBox}>
              <CopySVG className={s.itemIcon} />
            </div>
            <span className={s.itemTitle}>{t('dsb.cms.docs.side_tree.menu.duplicate')}</span>
          </button>
          <button
            type='button'
            className={s.item}
            onClick={() => onSelect(SIDE_TREE_NODE_MENU_ACTION.DELETE)}
          >
            <div className={s.iconBox}>
              <DeleteSVG className={s.itemIcon} />
            </div>
            <span className={s.itemTitle}>{t('dsb.cms.docs.side_tree.menu.delete')}</span>
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

export default NodeActionMenu
