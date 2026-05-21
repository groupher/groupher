import type { FC } from 'react'

import MENU from '~/const/menu'
import useTrans from '~/hooks/useTrans'
import MenuItem from '~/widgets/MenuItem'

import useSalon from './salon/group_action_menu'

type TProps = {
  onDelete?: () => void
}

const noop = (): void => undefined

const GroupActionMenu: FC<TProps> = ({ onDelete = noop }) => {
  const s = useSalon()
  const { t } = useTrans()

  return (
    <div className={s.wrapper}>
      <MenuItem icon={MENU.DELETE} title={t('dsb.tags.group.menu.delete')} onClick={onDelete} />
    </div>
  )
}

export default GroupActionMenu
