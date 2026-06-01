import type { FC } from 'react'

import useTrans from '~/hooks/useTrans'
import InternalLinkSVG from '~/icons/Guide'
import LinkSVG from '~/icons/Link'
import PlusSVG from '~/icons/Plus'
import Tooltip from '~/widgets/Tooltip'

import { SIDE_TREE_CHILD_MENU_ACTION } from './constant'
import useSalon, { cnMerge } from './salon/add_child_menu'
import type { TSideTreeChildMenuAction } from './spec'

type TProps = {
  onSelect: (action: TSideTreeChildMenuAction) => void
  onOpenChange?: (open: boolean) => void
}

const AddChildMenu: FC<TProps> = ({ onSelect, onOpenChange }) => {
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
            onClick={() => onSelect(SIDE_TREE_CHILD_MENU_ACTION.PAGE)}
          >
            <div className={s.iconBox}>
              <InternalLinkSVG className={cnMerge(s.itemIcon, 'size-3.5')} />
            </div>
            <span className={s.itemTitle}>{t('dsb.cms.docs.side_tree.menu.new_page')}</span>
          </button>
          <button
            type='button'
            className={s.item}
            onClick={() => onSelect(SIDE_TREE_CHILD_MENU_ACTION.LINK)}
          >
            <div className={s.iconBox}>
              <LinkSVG className={cnMerge(s.itemIcon, 'size-5')} />
            </div>
            <span className={s.itemTitle}>{t('dsb.cms.docs.side_tree.menu.quick_link')}</span>
          </button>
        </div>
      }
    >
      <button type='button' className={s.trigger} aria-label='Add item'>
        <PlusSVG className={s.plusIcon} />
      </button>
    </Tooltip>
  )
}

export default AddChildMenu
