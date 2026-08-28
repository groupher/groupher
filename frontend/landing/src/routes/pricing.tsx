import { createFileRoute } from '@tanstack/react-router'

import HomeHeader from '~/unit/HomeHeader'
import PriceWall from '~/unit/PriceWall'

import useSalon from '../pricing/salon'

export const Route = createFileRoute('/pricing')({ component: PricingPage })

function PricingPage() {
  const s = useSalon()

  return (
    <div className={s.wrapper} data-testid='pricing-page'>
      <HomeHeader />
      <PriceWall />
    </div>
  )
}
