'use client'

import HomeHeader from '~/widgets/HomeHeader'

// https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config
export const dynamic = 'force-static'

import PriceWall from '~/widgets/PriceWall'
import useSalon from './salon'

export default () => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <HomeHeader />
      <PriceWall />
    </div>
  )
}
