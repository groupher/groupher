import type { FC } from 'react'

import { BRAND_LAYOUT } from '~/const/layout'
import { assetSrc } from '~/helper'
import useLayout from '~/hooks/useLayout'
import Img from '~/Img'
import type { TSpace } from '~/spec'
import useCommunity from '~/stores/community/hooks'
import ImgFallback from '~/widgets/ImgFallback'

import useSalon from './salon'

type TProps = {
  className?: string
  landingBrand?: boolean
} & TSpace

const CommunityBrand: FC<TProps> = ({ className = '', landingBrand = false, ...spacing }) => {
  const s = useSalon({ className, ...spacing })

  const { logo, title } = useCommunity()
  const { brandLayout } = useLayout()

  const landingLogo = '/groupher.png'
  const landingTitle = 'Groupher'

  if (landingBrand) {
    return (
      <div className={s.wrapper}>
        <Img src={landingLogo} className={s.logo} noLazy fallback={<ImgFallback title={title} />} />

        <h1 className={s.title}>{landingTitle}</h1>
      </div>
    )
  }

  return (
    <div className={s.wrapper}>
      {brandLayout !== BRAND_LAYOUT.TEXT && (
        <Img
          src={assetSrc(logo)}
          className={s.logo}
          noLazy
          fallback={<ImgFallback title={title} />}
        />
      )}
      {brandLayout !== BRAND_LAYOUT.LOGO && <h1 className={s.title}>{title}</h1>}
    </div>
  )
}

export default CommunityBrand
