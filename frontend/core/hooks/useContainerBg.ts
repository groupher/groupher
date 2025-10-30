import { CONTAINER_BG_DEFAULT, PAGE_COLOR } from '~/const/colors'

import { blurRGB } from '~/fmt'
import useGossBlur from '~/hooks/useGossBlur'
import useSubStore from '~/hooks/useSubStore'
import useTheme from '~/hooks/useTheme'

type TRes = {
  background: string
  rawBg: string
}

export default (): TRes => {
  const { pageBg, pageBgDark } = useSubStore('dashboard')
  const { isLightTheme } = useTheme()

  const gossBlur = useGossBlur()

  const lightBg = PAGE_COLOR.light[pageBg] || PAGE_COLOR.light[CONTAINER_BG_DEFAULT.light]
  const darkBg = PAGE_COLOR.dark[pageBgDark] || PAGE_COLOR.dark[CONTAINER_BG_DEFAULT.dark]

  const rawBg = isLightTheme ? lightBg : darkBg
  const background = `${blurRGB(rawBg, gossBlur)}`

  return {
    background,
    rawBg,
  }
}
