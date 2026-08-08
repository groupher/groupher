import type { CSSProperties, FC } from 'react'

import { Image as NextImage } from '~/platform'
import { getDevLogoFilePath, getDevLogoSrc } from '~/utils/icons'

import type { TDevLogo } from '../constant/dev_logo'
import useSalon from './salon/logo_content'

type TProps = {
  item: TDevLogo
  active: boolean
  activeBg?: string
}

const LogoContent: FC<TProps> = ({ item, active, activeBg }) => {
  const s = useSalon()
  const style: CSSProperties | undefined =
    active && activeBg ? { backgroundColor: activeBg } : undefined

  return (
    <span className={s.wrapper} style={style}>
      <NextImage
        src={getDevLogoSrc(getDevLogoFilePath(item))}
        width={24}
        height={24}
        alt=''
        unoptimized
        draggable={false}
        className={s.image}
      />
    </span>
  )
}

export default LogoContent
