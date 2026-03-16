'use client'

import HomeHeader from '~/widgets/HomeHeader'

import PriceWall from '~/widgets/PriceWall'
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
