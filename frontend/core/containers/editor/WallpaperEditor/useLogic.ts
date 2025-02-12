import { useState, useCallback } from 'react'
import { pick, clone, equals } from 'ramda'

import type { TWallpaperGradientDir, TWallpaperType, TWallpaperData } from '~/spec'
import { WALLPAPER_TYPE, WALLPAPER_STATE_KEYS } from '~/const/wallpaper'

import useSubStore from '~/hooks/useSubStore'
import useFullWallpaper from '~/hooks/useFullWallpaper'
import useViewingCommunity from '~/hooks/useViewingCommunity'
import { closeDrawer, toast } from '~/signal'
import { mutate } from '~/server'

import type { TTab } from './spec'
import { TAB } from './constant'
import S from './schema'

type TRet = {
  tab: TTab
  loading: boolean
  // drived
  getWallpaper: () => TWallpaperData
  getIsTouched: () => boolean
  // actions
  initRollback: () => void
  rollbackWallpaper: () => void
  onSave: () => void
  close: () => void

  changeTab: (tab: TTab) => void
  changeDirection: (direction: TWallpaperGradientDir) => void
  removeWallpaper: () => void
  changeGradientWallpaper: (wallpaper: string) => void
  changePatternWallpaper: (wallpaper: string) => void
  changeCustomGradientWallpaper: () => void
  changeWallpaperType: (wallpaperType: TWallpaperType) => void
  confirmCustomColor: (customColorValue: string) => void
  togglePattern: (hasPattern: boolean) => void
  toggleBlur: (hasBlur: boolean) => void
  toggleShadow: (hasShadow: boolean) => void
}

export default (): TRet => {
  const store = useSubStore('wallpaper')
  const curCommunity = useViewingCommunity()
  const { getWallpaper } = useFullWallpaper()

  const [tab, setTab] = useState<TTab>(TAB.BUILDIN)
  const [loading, setLoading] = useState(false)

  const getIsTouched = useCallback((): boolean => {
    const original = pick(WALLPAPER_STATE_KEYS, store.original)
    const current = pick(WALLPAPER_STATE_KEYS, store)

    return !equals(clone(original), clone(current))
  }, [store])

  const close = (): void => {
    // store.rollbackEdit()
    closeDrawer()
  }

  const initRollback = (): void => store.commit({ original: pick(WALLPAPER_STATE_KEYS, store) })
  const rollbackWallpaper = (): void => store.commit({ ...store.original })

  const onSave = (): void => {
    setLoading(true)
    const community = curCommunity.slug
    const params = { community, ...pick(WALLPAPER_STATE_KEYS, store) }

    mutate(S.updateDashboardWallpaper, params)
      .then(() => {
        toast('设置已保存')
        setLoading(false)
        initRollback()
        closeDrawer()
      })
      .catch((err) => {
        console.error('## handle request error: ', err)
        setLoading(false)
        alert(err)
      })
  }

  const changeTab = (tab: TTab): void => setTab(tab)
  const changeDirection = (direction: TWallpaperGradientDir): void => store.commit({ direction })
  const removeWallpaper = (): void =>
    store.commit({ wallpaper: '', wallpaperType: WALLPAPER_TYPE.NONE })
  const changeGradientWallpaper = (wallpaper: string): void =>
    store.commit({ wallpaper, wallpaperType: WALLPAPER_TYPE.GRADIENT })
  const changePatternWallpaper = (wallpaper: string): void =>
    store.commit({ wallpaper, wallpaperType: WALLPAPER_TYPE.PATTERN })

  const changeCustomGradientWallpaper = (): void => {
    store.commit({ wallpaper: '', wallpaperType: WALLPAPER_TYPE.CUSTOM_GRADIENT })
  }

  const changeWallpaperType = (wallpaperType: TWallpaperType): void => {
    store.commit({ wallpaperType })
  }

  const confirmCustomColor = (customColorValue: string): void => {
    store.commit({ customColorValue, wallpaperType: WALLPAPER_TYPE.CUSTOM_GRADIENT })
  }

  const togglePattern = (hasPattern: boolean): void => store.commit({ hasPattern })
  const toggleBlur = (hasBlur: boolean): void => store.commit({ hasBlur })
  const toggleShadow = (hasShadow: boolean): void => store.commit({ hasShadow })

  return {
    tab,
    loading,
    // drived
    getWallpaper,
    getIsTouched,
    //actions
    initRollback,
    rollbackWallpaper,
    onSave,
    close,
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
  }
}
