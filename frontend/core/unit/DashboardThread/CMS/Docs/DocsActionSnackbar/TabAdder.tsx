import type { FC } from 'react'

import TabsAddSVG from '~/icons/TabsAdd'

import { TREE_ACTION } from './constant'
import useSalon from './salon/tab_adder'

const TabAdder: FC = () => {
  const s = useSalon()

  return (
    <button type='button' className={s.button} aria-label={TREE_ACTION.TAB} title={TREE_ACTION.TAB}>
      <TabsAddSVG className={s.icon} />
      <span className={s.text}>{TREE_ACTION.TAB}</span>
    </button>
  )
}

export default TabAdder
