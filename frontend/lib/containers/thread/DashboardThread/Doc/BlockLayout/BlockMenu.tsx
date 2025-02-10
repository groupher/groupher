import MenuItem from '~/widgets/MenuItem'
import MENU from '~/const/menu'

import useSalon from '../../salon/doc/block_layout/block_menu'

export default () => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <MenuItem icon={MENU.ARROW_LEFT} title="左移" />
      <MenuItem icon={MENU.ARROW_RIGHT} title="右移" />

      <MenuItem icon={MENU.ARROW_TO_TOP} title="移至最前" />
      <MenuItem icon={MENU.ARROW_TO_BOTTOM} title="移至最后" />
    </div>
  )
}
