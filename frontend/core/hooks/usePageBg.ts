import { useEffect, useState } from 'react'
import { blurRGB } from '~/fmt'
import useGaussBlur from '~/hooks/useGaussBlur'
import useTheme from '~/hooks/useTheme'
import useTwBelt from '~/hooks/useTwBelt'

type TRes = {
  background: string
  rawBg: string
}

export default (): TRes => {
  const { page } = useTwBelt()
  const { isLightTheme } = useTheme()

  const gaussBlur = useGaussBlur()
  const pageBg = page()

  const [rawBg, setRawBg] = useState<string>(null)
  const [background, setBackground] = useState<string>(null)

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    const mainEl = document.querySelector('main')
    if (!mainEl) return

    const style = getComputedStyle(mainEl)
    const pageBg = style.getPropertyValue('--color-pageBg').trim()

    setRawBg(pageBg)
    setBackground(blurRGB(pageBg, gaussBlur))
  }, [gaussBlur, pageBg, isLightTheme])

  return { background, rawBg }
}
