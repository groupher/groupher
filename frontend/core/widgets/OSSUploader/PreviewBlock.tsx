import type { FC } from 'react'

import { assetSrc } from '~/helper'

import useSalon from './salon/preview_block'

type TProps = {
  url: string
}

const PreviewBlock: FC<TProps> = ({ url }) => {
  const s = useSalon()

  return (
    <div>
      <img src={assetSrc(url)} className={s.previewImg} alt='preview img' />
    </div>
  )
}

export default PreviewBlock
