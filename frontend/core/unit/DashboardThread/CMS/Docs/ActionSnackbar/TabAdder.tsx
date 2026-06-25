import type { FC } from 'react'

import useTrans from '~/hooks/useTrans'
import TabsAddSVG from '~/icons/TabsAdd'
import { toast } from '~/widgets/Toaster'

import { TREE_ACTION_LABEL_KEY } from './constant'
import useSalon from './salon/tab_adder'

const TabAdder: FC = () => {
  const s = useSalon()
  const { t } = useTrans()
  const label = t(TREE_ACTION_LABEL_KEY.TAB)

  return (
    <button
      type='button'
      className={s.button}
      aria-label={label}
      title={label}
      onClick={() => toast(t(TREE_ACTION_LABEL_KEY.TAB_ADDED))}
    >
      <TabsAddSVG className={s.icon} />
      <span className={s.text}>{label}</span>
    </button>
  )
}

export default TabAdder
