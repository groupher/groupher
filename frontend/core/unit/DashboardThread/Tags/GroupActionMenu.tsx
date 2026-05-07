import type { FC } from 'react'

import MENU from '~/const/menu'
import useTrans from '~/hooks/useTrans'
import MenuItem from '~/widgets/MenuItem'

import useSalon from '../salon/tags/action_menu'

const GroupActionMenu: FC = () => {
  const s = useSalon()
  const { t } = useTrans()

  return (
    <div className={s.wrapper}>
      <MenuItem icon={MENU.ARROW_TO_TOP} title={t('dsb.tags.group.menu.to_top')} />
      <MenuItem icon={MENU.ARROW_TO_BOTTOM} title={t('dsb.tags.group.menu.to_bottom')} />
      <MenuItem icon={MENU.DELETE} title={t('dsb.tags.group.menu.delete')} />
    </div>
  )
}

export default GroupActionMenu
