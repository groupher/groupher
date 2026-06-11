import type { FC, ReactNode } from 'react'

import { ImageDraftContext } from './imageDraftContext'
import useCoverImagePreview from './useCoverImagePreview'

type TProps = {
  children: ReactNode
}

const ImageDraftProvider: FC<TProps> = ({ children }) => {
  const contextValue = useCoverImagePreview()

  return <ImageDraftContext.Provider value={contextValue}>{children}</ImageDraftContext.Provider>
}

export default ImageDraftProvider
