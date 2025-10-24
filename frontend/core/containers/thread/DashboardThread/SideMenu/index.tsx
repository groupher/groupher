import { keys } from 'ramda'

import Sticky from '~/widgets/Sticky'
import { MENU } from '../constant'
import useSalon from '../salon/side_menu'
import type { TMenuGroup } from '../spec'
import Group from './Group'

export default () => {
  const s = useSalon()
  const groupKeys = keys(MENU)

  return (
    <div className={s.wrapper}>
      <Sticky offsetTop={36}>
        {groupKeys.map((key) => (
          <Group key={key} group={MENU[key] as TMenuGroup} />
        ))}
      </Sticky>
    </div>
  )
}
