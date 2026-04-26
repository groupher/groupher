'use client'

import HomeHeader from '~/unit/HomeHeader'
import PriceWall from '~/unit/PriceWall'

import useSalon from './salon'

export default function Page() {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <HomeHeader />
      <PriceWall />
    </div>
  )
}
