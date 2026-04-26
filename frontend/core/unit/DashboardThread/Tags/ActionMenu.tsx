import type { FC } from 'react'

import MENU from '~/const/menu'
import useTrans from '~/hooks/useTrans'
import MenuItem from '~/widgets/MenuItem'

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
  const { t } = useTrans()

  return (
    <div className={s.wrapper}>
      {activeTagGroup && !isFirst && (
        <MenuItem
          icon={MENU.ARROW_TO_TOP}
          title={t('dsb.tags.menu.to_top')}
          onClick={() => move2Top()}
        />
      )}

      {activeTagGroup && !isLast && (
        <MenuItem
          icon={MENU.ARROW_TO_BOTTOM}
          title={t('dsb.tags.menu.to_bottom')}
          onClick={() => move2Bottom()}
        />
      )}

      <MenuItem
        icon={MENU.SETTING}
        title={t('dsb.tags.menu.advanced')}
        onClick={() => onSetting()}
      />
    </div>
  )
}

export default LinkMenu
