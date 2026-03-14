import MENU from '~/const/menu'

import TransforSVG from '~/icons/Transfor'
import MenuItem from '~/widgets/MenuItem'

import useSalon from '../../salon/doc/block_layout/file_menu'

export default function FileMenu() {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <MenuItem icon={MENU.ARROW_UP} title="上移" />
      <MenuItem icon={MENU.ARROW_DOWN} title="下移" />

      <MenuItem icon={MENU.ARROW_TO_TOP} title="移至最前" />
      <MenuItem icon={MENU.ARROW_TO_BOTTOM} title="移至最后" />
      <div className={s.item}>
        <TransforSVG className={s.transforIcon} />
        <div className={s.title}>移动到</div>
      </div>
    </div>
  )
}
