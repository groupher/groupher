'use client'

import SlidersHorizontalIcon from '~/icons/SlidersHorizontal'
import Tooltip from '~/ui/Tooltip'

import { ASSETS_HUB_LABEL } from '../constant'
import useSalon from './salon/filter_button'

export default function FilterButton() {
  const s = useSalon()

  return (
    <Tooltip content={ASSETS_HUB_LABEL.FILTER} placement='top'>
      <button type='button' className={s.wrapper} aria-label={ASSETS_HUB_LABEL.FILTER}>
        <SlidersHorizontalIcon className={s.icon} />
      </button>
    </Tooltip>
  )
}
