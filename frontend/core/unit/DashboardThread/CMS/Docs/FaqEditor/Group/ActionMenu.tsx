import CopySVG from '~/icons/Copy'
import EditSVG from '~/icons/EditPen'
import MoreSVG from '~/icons/menu/MoreL'
import PlusSVG from '~/icons/Plus'
import DeleteSVG from '~/icons/Trash'
import Tooltip from '~/widgets/Tooltip'

import { FAQ_EDITOR_COPY, FAQ_GROUP_MENU_ACTION, FAQ_ITEM_MENU_ACTION } from '../constant'
import useSalon from '../salon/group/action_menu'
import type { TFaqGroupMenuAction, TFaqItemMenuAction } from '../spec'

type TMenuItem<TAction extends string> = {
  action: TAction
  icon: 'add' | 'rename' | 'duplicate' | 'delete'
  title: string
}

type TProps<TAction extends string> = {
  items: readonly TMenuItem<TAction>[]
  ariaLabel: string
  onOpenChange?: (open: boolean) => void
  onSelect: (action: TAction) => void
}

const ICONS = {
  add: PlusSVG,
  rename: EditSVG,
  duplicate: CopySVG,
  delete: DeleteSVG,
}

export const GROUP_MENU_ITEMS: readonly TMenuItem<TFaqGroupMenuAction>[] = [
  {
    action: FAQ_GROUP_MENU_ACTION.ADD,
    icon: FAQ_GROUP_MENU_ACTION.ADD,
    title: FAQ_EDITOR_COPY.ADD_ITEM,
  },
  {
    action: FAQ_GROUP_MENU_ACTION.RENAME,
    icon: FAQ_GROUP_MENU_ACTION.RENAME,
    title: FAQ_EDITOR_COPY.RENAME,
  },
  {
    action: FAQ_GROUP_MENU_ACTION.DELETE,
    icon: FAQ_GROUP_MENU_ACTION.DELETE,
    title: FAQ_EDITOR_COPY.DELETE,
  },
]

export const ITEM_MENU_ITEMS: readonly TMenuItem<TFaqItemMenuAction>[] = [
  {
    action: FAQ_ITEM_MENU_ACTION.RENAME,
    icon: FAQ_ITEM_MENU_ACTION.RENAME,
    title: FAQ_EDITOR_COPY.RENAME,
  },
  {
    action: FAQ_ITEM_MENU_ACTION.DUPLICATE,
    icon: FAQ_ITEM_MENU_ACTION.DUPLICATE,
    title: FAQ_EDITOR_COPY.DUPLICATE,
  },
  {
    action: FAQ_ITEM_MENU_ACTION.DELETE,
    icon: FAQ_ITEM_MENU_ACTION.DELETE,
    title: FAQ_EDITOR_COPY.DELETE,
  },
]

export default function ActionMenu<TAction extends string>({
  items,
  ariaLabel,
  onOpenChange,
  onSelect,
}: TProps<TAction>) {
  const s = useSalon()

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
          {items.map((item) => {
            const Icon = ICONS[item.icon]

            return (
              <button
                key={item.action}
                type='button'
                className={s.item}
                onClick={() => onSelect(item.action)}
              >
                <div className={s.iconBox}>
                  <Icon className={s.icon} />
                </div>
                <span className={s.title}>{item.title}</span>
              </button>
            )
          })}
        </div>
      }
    >
      <button type='button' className={s.trigger} aria-label={ariaLabel}>
        <MoreSVG className={s.triggerIcon} />
      </button>
    </Tooltip>
  )
}
