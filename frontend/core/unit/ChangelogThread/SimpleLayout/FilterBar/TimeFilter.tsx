import type { FC } from 'react'

import useSalon from './salon'

const TimeBar: FC = () => {
  const s = useSalon()

  return (
    <>
      <div className={s.item}>2024</div>
      <div className={s.item}>2023</div>
      <div className={s.item}>2022</div>
      <div className={s.item}>2021</div>
      <div className={s.item}>2020</div>
    </>
  )
}

export default TimeBar
