import type { FC } from 'react'

import MoreSVG from '~/icons/menu/MoreL'

import { DOC_ACTION } from './constant'
import useSalon from './salon/more'

const More: FC = () => {
  const s = useSalon()

  return (
    <button type='button' className={s.button} aria-label={DOC_ACTION.MORE} title={DOC_ACTION.MORE}>
      <MoreSVG className={s.icon} />
    </button>
  )
}

export default More
