'use client'

import { motion, useScroll, useSpring, useTransform } from 'motion/react'
import { type FC, type ReactNode, useEffect, useState } from 'react'
import useTopbar from '~/hooks/useTopbar'
import useTrans from '~/hooks/useTrans'
import HomeHeader from '~/unit/HomeHeader'
import Footer from '~/unit/SiteFooter'
import GlowBackground from '~/widgets/GlobalLayout/GlowBackground'
import useSalon from '~/widgets/GlobalLayout/salon/main'

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

  const [layout, setLayout] = useState({
    fromWidth: DEFAULT_CONTAINER_WIDTH,
    toWidth: DEFAULT_CONTAINER_WIDTH,
    scrollRange: 0,
  })

  const { fromWidth, toWidth, scrollRange } = layout

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
      setLayout({
        fromWidth: vw,
        toWidth: Math.min(tokenWidth, vw),
        scrollRange: vh,
      })
    }

    updateVars()

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

  useEffect(() => {
    return smoothProgress.on('change', (p) => {
      if (scrollY.get() === 0) {
        document.documentElement.style.setProperty(`${LANDING_WIDTH_VAR}`, '100vw')
        return
      }

      const width = fromWidth + p * (toWidth - fromWidth)
      document.documentElement.style.setProperty(`${LANDING_WIDTH_VAR}`, `${width}px`)
    })
  }, [smoothProgress, scrollY, fromWidth, toWidth])

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
