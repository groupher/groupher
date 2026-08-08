import CopySVG from '~/icons/Copy'
import EditSVG from '~/icons/EditPen'
import MoreSVG from '~/icons/menu/MoreL'
import PlusSVG from '~/icons/Plus'
import DeleteSVG from '~/icons/Trash'
import Tooltip from '~/ui/Tooltip'

import useSalon from '../salon/group/action_menu'
import type { TMenuItem } from './menuItems'

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
