import { clone, equals, pick } from 'ramda'
import { useMemo, useState } from 'react'

import { WALLPAPER_STATE_KEYS, WALLPAPER_TYPE } from '~/const/wallpaper'
import useFullWallpaper from '~/hooks/useFullWallpaper'
import useGraphQLClient from '~/hooks/useGraphQLClient'
import { toast } from '~/signal'
import type { TWallpaperData, TWallpaperGradientDir, TWallpaperType } from '~/spec'
import useCommunity from '~/stores/community/hooks'
import useWallpaperDomain from '~/stores/wallpaper/hooks'

import { TAB } from './constant'
import S from './schema'
import type { TTab } from './spec'

const getInitialTab = (type: TWallpaperType): TTab => {
  switch (type) {
    case WALLPAPER_TYPE.PATTERN: {
      return TAB.PICTURES
    }
    case WALLPAPER_TYPE.UPLOAD: {
      return TAB.UPLOAD
    }
    default: {
      return TAB.GRADIENT
    }
  }
}

type TRet = {
  tab: TTab
  loading: boolean
  // derived
  getWallpaper: () => TWallpaperData
  isTouched: boolean
  // actions
  initRollback: () => void
  rollbackWallpaper: () => void
  onSave: () => void

  changeTab: (tab: TTab) => void
  changeDirection: (direction: TWallpaperGradientDir) => void
  removeWallpaper: () => void
  changeGradientWallpaper: (source: string) => void
  changePatternWallpaper: (source: string) => void
  changeCustomGradientWallpaper: () => void
  changeWallpaperType: (type: TWallpaperType) => void
  confirmCustomColor: (customColorValue: string) => void
  togglePattern: (hasPattern: boolean) => void
  toggleBlur: (hasBlur: boolean) => void
  toggleShadow: (hasShadow: boolean) => void
  changeBrightness: (brightness: number) => void
  changeSaturation: (saturation: number) => void
}

export default function useLogic(): TRet {
  const wallpaper$ = useWallpaperDomain()
  const community$ = useCommunity()
  const { getWallpaper } = useFullWallpaper()

  const { mutate } = useGraphQLClient()
  const [tab, setTab] = useState<TTab>(() => getInitialTab(wallpaper$.type))
  const [loading, setLoading] = useState(false)

  const isTouched = useMemo((): boolean => {
    const original = pick(WALLPAPER_STATE_KEYS, wallpaper$.original)
    const current = pick(WALLPAPER_STATE_KEYS, wallpaper$)

    return !equals(clone(original), clone(current))
  }, [wallpaper$])

  const initRollback = (): void =>
    wallpaper$.commit({ original: pick(WALLPAPER_STATE_KEYS, wallpaper$) })

  const rollbackWallpaper = (): void => wallpaper$.commit({ ...wallpaper$.original })

  const onSave = (): void => {
    setLoading(true)
    const community = community$.slug
    const params = { community, ...pick(WALLPAPER_STATE_KEYS, wallpaper$) }

    mutate(S.updateDashboardWallpaper, params)
      .then(() => {
        toast('设置已保存')
        setLoading(false)
        initRollback()
      })
      .catch((err) => {
        console.error('## handle request error: ', err)
        setLoading(false)
      })
  }

  const changeTab = (tab: TTab): void => setTab(tab)
  const changeDirection = (direction: TWallpaperGradientDir): void =>
    wallpaper$.commit({ direction })
  const removeWallpaper = (): void => wallpaper$.commit({ source: '', type: WALLPAPER_TYPE.NONE })
  const changeGradientWallpaper = (source: string): void =>
    wallpaper$.commit({ source, type: WALLPAPER_TYPE.GRADIENT })
  const changePatternWallpaper = (source: string): void =>
    wallpaper$.commit({ source, type: WALLPAPER_TYPE.PATTERN })

  const changeCustomGradientWallpaper = (): void => {
    wallpaper$.commit({ source: '', type: WALLPAPER_TYPE.CUSTOM_GRADIENT })
  }

  const changeWallpaperType = (type: TWallpaperType): void => {
    wallpaper$.commit({ type })
  }

  const confirmCustomColor = (customColorValue: string): void => {
    wallpaper$.commit({ customColorValue, type: WALLPAPER_TYPE.CUSTOM_GRADIENT })
  }

  const togglePattern = (hasPattern: boolean): void => wallpaper$.commit({ hasPattern })
  const toggleBlur = (hasBlur: boolean): void => wallpaper$.commit({ hasBlur })
  const toggleShadow = (hasShadow: boolean): void => wallpaper$.commit({ hasShadow })
  const changeBrightness = (brightness: number): void => wallpaper$.commit({ brightness })
  const changeSaturation = (saturation: number): void => wallpaper$.commit({ saturation })

  return {
    tab,
    loading,
    // drive
    getWallpaper,
    isTouched,
    //actions
    initRollback,
    rollbackWallpaper,
    onSave,
    changeTab,
    changeDirection,
    removeWallpaper,
    changeGradientWallpaper,
    changePatternWallpaper,
    changeCustomGradientWallpaper,
    changeWallpaperType,
    confirmCustomColor,
    togglePattern,
    toggleBlur,
    toggleShadow,
    changeBrightness,
    changeSaturation,
  }
}
