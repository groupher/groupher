import { type FC, memo } from 'react'

import type { TSpace } from '~/spec'
import { HOME_COMMUNITY } from '~/const/name'

import Img from '~/Img'

import useSalon from './salon'

type TProps = {
  size: number
} & TSpace

const HomeLogo: FC<TProps> = ({ size, ...spacing }) => {
  const s = useSalon({ size, ...spacing })

  return <Img src={HOME_COMMUNITY.logo} className={s.logo} />
}

export default memo(HomeLogo)
