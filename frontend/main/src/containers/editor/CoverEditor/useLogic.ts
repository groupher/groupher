import { pick, keys, clone, forEach, mergeDeepRight } from 'ramda'

import { proxy, useSnapshot } from 'valtio'

import type { TWallpaperGradientDir, TWallpaper, TWallpaperGradient } from '~/spec'
import { COVER_GRADIENT_WALLPAPER, GRADIENT_DIRECTION } from '~/const/wallpaper'

import type {
  TStore,
  TImagePos,
  TImageRadio,
  TImageSize,
  TLinearBorderPos,
  TSettingLevel,
  TToolboxSetting,
} from './spec'
import { IMAGE_POS, SETTING_LEVEL, IMAGE_SIZE, LINEAR_BORDER, IMAGE_RATIO } from './constant'

type TRet = {
  posOnChange: (imagePos: TImagePos) => void
  shadowOnChange: (shadowLevel: TSettingLevel) => void
  borderRadiusOnChange: (borderRadiusLevel: TSettingLevel) => void
  linearBorderPosOnChange: (linearBorderPos: TLinearBorderPos) => void
  wallpaperOnChange: (wallpaper: string) => void
  gradientDirOnChange: (direction: TWallpaperGradientDir) => void
  sizeOnChange: (size: TImageSize) => void
  ratioOnChange: (ratio: TImageRadio) => void
  rotateOnChange: (rotate: number) => void
  glassBorderOnChange: (hasGlassBorder: boolean) => void
  lightPosOnChange: (lightPos: TImagePos) => void
} & TStore

const store = proxy<TStore>({
  imagePos: IMAGE_POS.CENTER,
  lightPos: IMAGE_POS.NONE,
  shadowLevel: SETTING_LEVEL.L1,
  borderRadiusLevel: SETTING_LEVEL.L1,
  linearBorderPos: LINEAR_BORDER.NONE,
  size: IMAGE_SIZE.LARGE,
  ratio: IMAGE_RATIO.SCREEN,
  rotate: 0,
  hasGlassBorder: false,

  // for background
  wallpaper: '',
  hasPattern: false,
  hasBlur: true,
  direction: GRADIENT_DIRECTION.BOTTOM_RIGHT,

  get gradientWallpapers(): Record<string, TWallpaper> {
    const wallpapers = clone(COVER_GRADIENT_WALLPAPER)
    const paperKeys = keys(COVER_GRADIENT_WALLPAPER)

    forEach((key) => {
      const wallpaperObj = wallpapers[key] as TWallpaperGradient

      wallpaperObj.hasPattern = store.hasPattern
      wallpaperObj.hasBlur = store.hasBlur
      wallpaperObj.direction = store.direction as TWallpaperGradientDir
    }, paperKeys)

    return wallpapers
  },

  get toolboxSetting(): TToolboxSetting {
    const {
      imagePos,
      lightPos,
      shadowLevel,
      borderRadiusLevel,
      linearBorderPos,
      wallpaper,
      gradientWallpapers,
      direction,
      size,
      ratio,
      rotate,
      hasGlassBorder,
    } = store

    return {
      pos: imagePos as TImagePos,
      lightPos: lightPos as TImagePos,
      shadowLevel: shadowLevel as TSettingLevel,
      borderRadiusLevel: borderRadiusLevel as TSettingLevel,
      linearBorderPos: linearBorderPos as TLinearBorderPos,
      wallpapers: gradientWallpapers,
      wallpaper,
      direction: direction as TWallpaperGradientDir,
      size: size as TImageSize,
      ratio: ratio as TImageRadio,
      rotate,
      hasGlassBorder,
    }
  },

  commit: (patch: Partial<TStore>): void => {
    Object.assign(store, mergeDeepRight(store, patch))
  },
})

export default (): TRet => {
  const snap = useSnapshot(store)

  const posOnChange = (imagePos: TImagePos): void => snap.commit({ imagePos })
  const shadowOnChange = (shadowLevel: TSettingLevel): void => snap.commit({ shadowLevel })
  const borderRadiusOnChange = (borderRadiusLevel: TSettingLevel): void =>
    snap.commit({ borderRadiusLevel })
  const linearBorderPosOnChange = (linearBorderPos: TLinearBorderPos): void =>
    snap.commit({ linearBorderPos })
  const wallpaperOnChange = (wallpaper: string): void => snap.commit({ wallpaper })
  const gradientDirOnChange = (direction: TWallpaperGradientDir): void => snap.commit({ direction })
  const sizeOnChange = (size: TImageSize): void => snap.commit({ size })
  const ratioOnChange = (ratio: TImageRadio): void => snap.commit({ ratio })
  const rotateOnChange = (rotate: number): void => snap.commit({ rotate })

  const glassBorderOnChange = (hasGlassBorder: boolean) => snap.commit({ hasGlassBorder })

  const lightPosOnChange = (lightPos: TImagePos): void => {
    const curPos = store.lightPos

    if (curPos === lightPos && curPos !== IMAGE_POS.NONE) {
      snap.commit({ lightPos: IMAGE_POS.NONE })
      return
    }

    snap.commit({ lightPos })
  }

  return {
    ...pick(keys(snap), snap),
    posOnChange,
    shadowOnChange,
    borderRadiusOnChange,
    linearBorderPosOnChange,
    wallpaperOnChange,
    gradientDirOnChange,
    sizeOnChange,
    ratioOnChange,
    rotateOnChange,
    glassBorderOnChange,
    lightPosOnChange,
  }
}
