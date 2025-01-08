import { useState, lazy, Suspense } from 'react'

import ImageSVG from '~/icons/Image'
import LavaLampLoading from '~/widgets/Loading/LavaLampLoading'

import useSalon from './styles/article_cover'

export const CoverEditor = lazy(() => import('~/containers/editor/CoverEditor'))

export default () => {
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
