import { keys } from 'ramda'

import Sticky from '~/widgets/Sticky'
import { MENU } from '../constant'
import useSalon from '../salon/side_menu'
import Group from './Group'

export default function SideMenu() {
  const s = useSalon()
  const groupKeys = keys(MENU)

  return (
    <div className={s.wrapper}>
      <Sticky offsetTop={36}>
        {groupKeys.map((key) => (
          <Group key={key} group={MENU[key]} />
        ))}
      </Sticky>
    </div>
  )
}
