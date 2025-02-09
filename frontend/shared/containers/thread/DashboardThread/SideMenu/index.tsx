import { keys } from 'ramda'

import Sticky from '~/widgets/Sticky'

import type { TMenuGroup } from '../spec'
import { MENU } from '../constant'

import Group from './Group'
import useSalon from '../salon/side_menu'

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
