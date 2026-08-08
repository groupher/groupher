import type { FC } from 'react'

import { assetSrc } from '~/helper'
import { Image as NextImage } from '~/platform'

import useSalon from './salon/preview_block'

type TProps = {
  url: string
}

const PreviewBlock: FC<TProps> = ({ url }) => {
  const s = useSalon()

  return (
    <div>
      <NextImage
        src={assetSrc(url)}
        className={s.previewImg}
        alt='preview img'
        width={64}
        height={64}
        unoptimized
      />
    </div>
  )
}

export default PreviewBlock
