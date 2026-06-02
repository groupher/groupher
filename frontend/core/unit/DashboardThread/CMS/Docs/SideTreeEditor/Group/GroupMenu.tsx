import type { FC } from 'react'

import useTrans from '~/hooks/useTrans'
import EditSVG from '~/icons/EditPen'
import InternalLinkSVG from '~/icons/Guide'
import LinkSVG from '~/icons/Link'
import MoreSVG from '~/icons/menu/MoreL'
import DeleteSVG from '~/icons/Trash'
import Tooltip from '~/widgets/Tooltip'

import { SIDE_TREE_GROUP_MENU_ACTION } from '../constant'
import useSalon, { cnMerge } from '../salon/group/group_menu'
import type { TSideTreeGroupMenuAction } from '../spec'

type TProps = {
  onSelect: (action: TSideTreeGroupMenuAction) => void
  onOpenChange?: (open: boolean) => void
}

const GroupMenu: FC<TProps> = ({ onSelect, onOpenChange }) => {
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
            onClick={() => onSelect(SIDE_TREE_GROUP_MENU_ACTION.PAGE)}
          >
            <div className={s.iconBox}>
              <InternalLinkSVG className={cnMerge(s.itemIcon, 'size-3.5')} />
            </div>
            <span className={s.itemTitle}>{t('dsb.cms.docs.side_tree.menu.new_page')}</span>
          </button>
          <button
            type='button'
            className={s.item}
            onClick={() => onSelect(SIDE_TREE_GROUP_MENU_ACTION.LINK)}
          >
            <div className={s.iconBox}>
              <LinkSVG className={cnMerge(s.itemIcon, 'size-5')} />
            </div>
            <span className={s.itemTitle}>{t('dsb.cms.docs.side_tree.menu.quick_link')}</span>
          </button>
          <button
            type='button'
            className={s.item}
            onClick={() => onSelect(SIDE_TREE_GROUP_MENU_ACTION.RENAME)}
          >
            <div className={s.iconBox}>
              <EditSVG className={cnMerge(s.itemIcon, 'size-3.5')} />
            </div>
            <span className={s.itemTitle}>{t('dsb.cms.docs.side_tree.menu.rename')}</span>
          </button>
          <button
            type='button'
            className={s.item}
            onClick={() => onSelect(SIDE_TREE_GROUP_MENU_ACTION.DELETE)}
          >
            <div className={s.iconBox}>
              <DeleteSVG className={s.itemIcon} />
            </div>
            <span className={s.itemTitle}>{t('dsb.cms.docs.side_tree.menu.delete')}</span>
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
