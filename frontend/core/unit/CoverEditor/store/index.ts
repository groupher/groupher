import { clone, equals } from 'ramda'
import { proxy } from 'valtio'

import { createCoverBgThemeConfig } from '../background'
import { COVER_CANVAS_SIZE, COVER_IMAGE_WHICH } from '../constant'
import { EMPTY_COVER_IMAGES, getActiveImage } from '../coverImageModel'
import type { TStore } from '../spec'

export type TCoverEditorInitial = Partial<
  Pick<TStore, 'images' | 'activeImageWhich' | 'canvasWidth' | 'canvasHeight' | 'background'>
>

/** Creates an isolated Valtio store for one CoverEditor canvas instance. */
export const createCoverEditorStore = (initial: TCoverEditorInitial = {}): TStore => {
  const background = clone(initial.background ?? createCoverBgThemeConfig())
  const originalBackground = clone(background)
  let store: TStore

  store = proxy({
    images: clone(initial.images ?? EMPTY_COVER_IMAGES),
    activeImageWhich: initial.activeImageWhich ?? COVER_IMAGE_WHICH.PRIMARY,
    canvasWidth: initial.canvasWidth ?? COVER_CANVAS_SIZE.WIDTH,
    canvasHeight: initial.canvasHeight ?? COVER_CANVAS_SIZE.HEIGHT,
    background,
    originalBackground,
    get tuningSetting() {
      const { images, activeImageWhich, canvasWidth, canvasHeight } = store

      return {
        images,
        activeImageWhich,
        activeImage: getActiveImage(images, activeImageWhich),
        canvasWidth,
        canvasHeight,
        background: store.background,
        activeBackground: store.background.light,
        isBackgroundTouched: !equals(clone(store.originalBackground), clone(store.background)),
      }
    },
    commit: (patch: Partial<TStore>): void => {
      Object.assign(store, patch)
    },
  } as TStore)

  return store
}
