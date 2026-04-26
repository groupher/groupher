import { useState } from 'react'

import { COLOR } from '~/const/colors'
import type { TColorName } from '~/spec'

import useSalon from '../../salon/dashboard_intros/layout_tab/content_card'
import BannerTab from './BannerTab'
import BrandLayout from './BrandLayout'
import Header from './Header'
import MainLayouts from './MainLayouts'

export default function ContentCard() {
  const s = useSalon()
  const [primaryColor, setPrimaryColor] = useState<TColorName>(COLOR.PURPLE)

  return (
    <div className={s.wrapper}>
      <Header primaryColor={primaryColor} onPrimaryChange={(color) => setPrimaryColor(color)} />

      <BannerTab primaryColor={primaryColor} />

      <BrandLayout primaryColor={primaryColor} />
      <MainLayouts primaryColor={primaryColor} />
    </div>
  )
}
