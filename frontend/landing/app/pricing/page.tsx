'use client'

import HomeHeader from '~/unit/home-header'

import PriceWall from '~/unit/price-wall'
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
