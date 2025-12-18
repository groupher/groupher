'use client'

import { motion, useScroll, useSpring, useTransform } from 'motion/react'
import { type FC, type ReactNode, useEffect, useState } from 'react'
import useTopbar from '~/hooks/useTopbar'
import useTrans from '~/hooks/useTrans'
import Footer from '~/widgets/Footer'
import GlowBackground from '~/widgets/GlobalLayout/GlowBackground'
import useSalon from '~/widgets/GlobalLayout/salon/main'
import HomeHeader from '~/widgets/HomeHeader'

const LANDING_WIDTH_VAR = '--container-landing-width'
const DEFAULT_CONTAINER_WIDTH = 1420

type TProps = {
  children: ReactNode
}

const Main: FC<TProps> = ({ children }) => {
  const s = useSalon()
  const { locale } = useTrans()
  const { hasTopbar } = useTopbar()
  const { scrollY } = useScroll()

  const [fromWidth, setFromWidth] = useState(DEFAULT_CONTAINER_WIDTH)
  const [toWidth, setToWidth] = useState(DEFAULT_CONTAINER_WIDTH)
  const [scrollRange, setScrollRange] = useState(0)
  const [_enabled, setEnabled] = useState(false)

  useEffect(() => {
    const getConfiguredContainerWidth = (): number => {
      const varValue = window
        .getComputedStyle(document.documentElement)
        .getPropertyValue(`${LANDING_WIDTH_VAR}-init`)
        .trim()

      let value = DEFAULT_CONTAINER_WIDTH
      if (varValue?.endsWith('px') || varValue?.endsWith('rem')) {
        const tempDiv = document.createElement('div')
        tempDiv.style.visibility = 'hidden'
        tempDiv.style.position = 'fixed'
        tempDiv.style.maxWidth = varValue
        document.body.appendChild(tempDiv)
        const computedStyle = window.getComputedStyle(tempDiv)
        value = parseFloat(computedStyle.maxWidth)
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
    stiffness: 120, // 越小越慢，越柔和
    damping: 10, // 越小越有弹性
    mass: 0.25, // 越大惯性越明显
  })

  useTransform(smoothProgress, (p) => {
    if (typeof window !== 'undefined') {
      if (scrollY.get() === 0) {
        document.documentElement.style.setProperty(`${LANDING_WIDTH_VAR}`, '100vw')
        return fromWidth
      }
    }

    const width = fromWidth + p * (toWidth - fromWidth)

    if (typeof window !== 'undefined') {
      document.documentElement.style.setProperty(`${LANDING_WIDTH_VAR}`, `${width}px`)
    }

    return width
  })

  return (
    <motion.main key={locale} className={s.wrapper}>
      <HomeHeader />
      {hasTopbar && <div className={s.topBar} />}
      <div className={s.body}>{children}</div>
      <Footer />
      <GlowBackground />
    </motion.main>
  )
}

export default Main
