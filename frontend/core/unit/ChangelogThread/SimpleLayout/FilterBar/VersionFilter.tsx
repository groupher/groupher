import type { FC } from 'react'

import useSalon from './salon'

const VersionBar: FC = () => {
  const s = useSalon()

  return (
    <>
      <div className={s.item}>v4.0</div>
      <div className={s.item}>v3.0</div>
      <div className={s.item}>v2.0</div>
      <div className={s.item}>v1.0</div>
    </>
  )
}

export default VersionBar
