import type { FC } from 'react'

import MenuItem from '~/widgets/MenuItem'
import MENU from '~/const/menu'

import useSalon from '../salon/tags/action_menu'

type TProps = {
  isFirst?: boolean
  isLast?: boolean
  activeTagGroup: null | string

  move2Top?: () => void
  move2Bottom?: () => void
  onSetting?: () => void
}

const LinkMenu: FC<TProps> = ({
  isFirst = false,
  isLast = false,
  activeTagGroup,
  move2Top = console.log,
  move2Bottom = console.log,
  onSetting = console.log,
}) => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      {activeTagGroup && !isFirst && (
        <MenuItem icon={MENU.ARROW_TO_TOP} title="移至最前" onClick={() => move2Top()} />
      )}

      {activeTagGroup && !isLast && (
        <MenuItem icon={MENU.ARROW_TO_BOTTOM} title="移至最后" onClick={() => move2Bottom()} />
      )}

      <MenuItem icon={MENU.SETTING} title="高级设置" onClick={() => onSetting()} />
    </div>
  )
}

export default LinkMenu
