import { useState, lazy, Suspense } from 'react'

import LavaLampLoading from '~/widgets/Loading/LavaLampLoading'

import { Wrapper, Adder, AddIcon, AddTitle, ImageIcon } from './styles/article_cover'

export const CoverEditor = lazy(() => import('~/containers/editor/CoverEditor'))

export default () => {
  const [hasCover, setHasCover] = useState(true)

  return (
    <Wrapper>
      {!hasCover && (
        <Adder onClick={() => setHasCover(true)}>
          <AddIcon />
          <AddTitle>添加封面图</AddTitle>
          <ImageIcon />
        </Adder>
      )}
      {hasCover && (
        <Suspense fallback={<LavaLampLoading />}>
          <CoverEditor onDelete={() => setHasCover(false)} />
        </Suspense>
      )}
    </Wrapper>
  )
}
