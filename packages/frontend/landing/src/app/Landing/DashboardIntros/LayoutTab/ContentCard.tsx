import { useState } from 'react'

import { COLOR_NAME } from '~/const/colors'

import Header from './Header'
import BannerTab from './BannerTab'

import BrandLayout from './BrandLayout'
import MainLayouts from './MainLayouts'

import useSalon from '../../salon/dashboard_intros/layout_tab/content_card'

export default () => {
  const s = useSalon()
  const [primaryColor, setPrimaryColor] = useState(COLOR_NAME.PURPLE)

  return (
    <div className={s.wrapper}>
      <Header primaryColor={primaryColor} onPrimaryChange={(color) => setPrimaryColor(color)} />

      <BannerTab primaryColor={primaryColor} />

      <BrandLayout primaryColor={primaryColor} />
      <MainLayouts primaryColor={primaryColor} />
    </div>
  )
}
