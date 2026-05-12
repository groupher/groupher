import type { FC } from 'react'

import MENU from '~/const/menu'
import useTrans from '~/hooks/useTrans'
import MenuItem from '~/widgets/MenuItem'

import useSalon from './salon/delete_menu'
import type { TDeleteMenuProps } from './spec'

const DeleteMenu: FC<TDeleteMenuProps> = ({ onDelete = console.log }) => {
  const s = useSalon()
  const { t } = useTrans()

  return (
    <div className={s.wrapper}>
      <MenuItem icon={MENU.DELETE} title={t('dsb.link_editor.delete')} onClick={onDelete} />
    </div>
  )
}

export default DeleteMenu
