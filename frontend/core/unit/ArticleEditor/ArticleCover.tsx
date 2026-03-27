import { lazy, Suspense, useState } from 'react'

import ImageSVG from '~/icons/Image'
import LavaLampLoading from '~/widgets/Loading/LavaLampLoading'

import useSalon from './salon/article_cover'

export const CoverEditor = lazy(() => import('~/unit/CoverEditor'))

export default function ArticleCover() {
  const s = useSalon()
  const [hasCover, setHasCover] = useState(false)

  return (
    <div className={s.wrapper}>
      {!hasCover && (
        <div className={s.adder} onClick={() => setHasCover(true)}>
          <ImageSVG className={s.imageIcon} />
          <div className={s.addTitle}>添加封面图</div>
        </div>
      )}
      {hasCover && (
        <Suspense fallback={<LavaLampLoading />}>
          <CoverEditor onDelete={() => setHasCover(false)} />
        </Suspense>
      )}
    </div>
  )
}
