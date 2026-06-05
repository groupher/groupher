import type { FC } from 'react'

import CoverEditor from '~/unit/CoverEditor'

import useSalon from './salon/cover'

const Cover: FC = () => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <CoverEditor />
    </div>
  )
}

export default Cover
