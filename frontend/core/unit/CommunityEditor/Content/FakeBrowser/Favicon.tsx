import { type FC, memo } from 'react'

import Img from '~/Img'

import useSalon from './salon/fake_browser/favicon'

type TProps = {
  title: string
  logo: string | null
}

const FaviconIcon: FC<TProps> = ({ title, logo }) => {
  const s = useSalon()

  if (logo) return <Img src={logo} className={s.logo} />
  if (title) return <div className={s.holder} />

  return null
}

export default memo(FaviconIcon)
