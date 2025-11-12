'use client'

import { motion, useMotionTemplate, useScroll, useSpring, useTransform } from 'motion/react'
import { type FC, type ReactNode, useEffect, useLayoutEffect, useState } from 'react'
import usePageBg from '~/hooks/usePageBg'
import useTopbar from '~/hooks/useTopbar'
import useTrans from '~/hooks/useTrans'
import Footer from '~/widgets/Footer'
import GlowBackground from '~/widgets/GlobalLayout/GlowBackground'
import useSalon from '~/widgets/GlobalLayout/salon/main'
import HomeHeader from '~/widgets/HomeHeader'

const DEFAULT_CONTAINER_WIDTH = 1425
const LANDING_WIDTH_VAR = 'container-landing-width'

type TProps = { children: ReactNode }

const Main: FC<TProps> = ({ children }) => {
  const s = useSalon()
  const { locale } = useTrans()
  const { hasTopbar } = useTopbar()
  const { background } = usePageBg()
  const { scrollY } = useScroll()

  const [fromWidth, setFromWidth] = useState(DEFAULT_CONTAINER_WIDTH)
  const [toWidth, setToWidth] = useState(DEFAULT_CONTAINER_WIDTH)
  const [scrollRange, setScrollRange] = useState(DEFAULT_CONTAINER_WIDTH)
  const [enabled, setEnabled] = useState(false)

  // ----------------------
  // SSR 首帧宽度防闪烁
  // ----------------------
  useLayoutEffect(() => {
    document.documentElement.style.setProperty(`--${LANDING_WIDTH_VAR}`, `${window.innerWidth}px`)
  }, [])

  // ----------------------
  // 客户端初始化
  // ----------------------
  useEffect(() => {
    const getConfiguredContainerWidth = (): number => {
      const varValue = window
        .getComputedStyle(document.documentElement)
        .getPropertyValue('--container-landing-width-init')
        .trim()
      let value = 1420
      if (varValue?.endsWith('px') || varValue?.endsWith('rem')) {
        const tempDiv = document.createElement('div')
        tempDiv.style.visibility = 'hidden'
        tempDiv.style.position = 'fixed'
        tempDiv.style.maxWidth = varValue
        document.body.appendChild(tempDiv)
        value = parseFloat(window.getComputedStyle(tempDiv).maxWidth)
        document.body.removeChild(tempDiv)
      }
      return value
    }

    const updateVars = () => {
      const tokenWidth = getConfiguredContainerWidth()
      const vw = window.innerWidth
      const vh = window.innerHeight || 1
      setFromWidth(vw)
      setToWidth(Math.min(tokenWidth, vw))
      setScrollRange(vh)
    }

    updateVars()
    setEnabled(true)

    let raf: number | null = null
    const onResize = () => {
      if (raf !== null) cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        updateVars()
        raf = null
      })
    }

    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      if (raf !== null) cancelAnimationFrame(raf)
    }
  }, [])

  // ----------------------
  // scroll progress
  // ----------------------
  const progress = useTransform(scrollY, [0, scrollRange], [0, 1], { clamp: true })
  const smoothProgress = useSpring(progress, {
    stiffness: 150,
    damping: 6,
    mass: 0.25,
  })

  // ----------------------
  // 宽度计算
  // ----------------------
  const widthPx = useTransform(smoothProgress, (p) => {
    // 使用 Motion 计算宽度，不再硬写 100vw
    const width = fromWidth + p * (toWidth - fromWidth)
    if (typeof window !== 'undefined') {
      document.documentElement.style.setProperty(`--${LANDING_WIDTH_VAR}`, `${width}px`)
    }
    return width
  })

  const maxWidth = useMotionTemplate`${widthPx}px`
  const effectiveMaxWidth = enabled ? maxWidth : '100%'

  return (
    <>
      <HomeHeader maxWidth={effectiveMaxWidth} sticky />
      <motion.main
        key={locale}
        className={s.wrapper}
        style={{
          background,
          transition: enabled ? 'max-width 0.15s ease-out' : undefined,
        }}
      >
        <HomeHeader />
        {hasTopbar && <div className={s.topBar} />}
        <div className={s.body}>{children}</div>
        <Footer />
        <GlowBackground />
      </motion.main>
    </>
  )
}

export default Main
