import { PAGE_COLOR, PAGE_COLOR_DEFAULT } from '~/const/colors'

import { blurRGB } from '~/fmt'

import useTheme from '~/hooks/useTheme'
import useGossBlur from '~/hooks/useGossBlur'
import useSubStore from '~/hooks/useSubStore'

type TRes = {
  background: string
  rawBg: string
}

export default (): TRes => {
  const { pageBg, pageBgDark } = useSubStore('dashboard')
  const { isLightTheme } = useTheme()

  const gossBlur = useGossBlur()

  const lightBg = PAGE_COLOR.light[pageBg] || PAGE_COLOR.light[PAGE_COLOR_DEFAULT.light]
  const darkBg = PAGE_COLOR.dark[pageBgDark] || PAGE_COLOR.dark[PAGE_COLOR_DEFAULT.dark]

  const rawBg = isLightTheme ? lightBg : darkBg
  const background = `${blurRGB(rawBg, gossBlur)}`

  return {
    background,
    rawBg,
  }
}
