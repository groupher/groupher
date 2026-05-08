import type { FC } from 'react'

import MENU from '~/const/menu'
import useTrans from '~/hooks/useTrans'
import MenuItem from '~/widgets/MenuItem'

import useSalon from '../salon/tags/action_menu'

type TProps = {
  move2Top?: () => void
  move2Bottom?: () => void
  onDelete?: () => void
}

const noop = (): void => undefined

const GroupActionMenu: FC<TProps> = ({
  move2Top = noop,
  move2Bottom = noop,
  onDelete = noop,
}) => {
  const s = useSalon()
  const { t } = useTrans()

  return (
    <div className={s.wrapper}>
      <MenuItem icon={MENU.ARROW_TO_TOP} title={t('dsb.tags.group.menu.to_top')} onClick={move2Top} />
      <MenuItem
        icon={MENU.ARROW_TO_BOTTOM}
        title={t('dsb.tags.group.menu.to_bottom')}
        onClick={move2Bottom}
      />
      <MenuItem icon={MENU.DELETE} title={t('dsb.tags.group.menu.delete')} onClick={onDelete} />
    </div>
  )
}

export default GroupActionMenu
