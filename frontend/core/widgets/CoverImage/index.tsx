/*
 *
 * CoverImage
 *
 */

import { type FC, memo } from 'react'

import Img from '~/Img'

import useSalon from './salon'

type TProps = {
  testid?: string
}

const CoverImage: FC<TProps> = ({ testid = 'cover-image' }) => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className={s.imageWrapper}>
        <Img className={s.image} src='/help-cover-demo.png' noLazy />
      </div>
    </div>
  )
}

export default memo(CoverImage)
