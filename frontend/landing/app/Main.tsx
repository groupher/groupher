'use client'

import { motion, useMotionTemplate, useScroll, useSpring, useTransform } from 'motion/react'
import { type FC, type ReactNode, useEffect, useState } from 'react'
import usePageBg from '~/hooks/usePageBg'
import useTopbar from '~/hooks/useTopbar'
import useTrans from '~/hooks/useTrans'
import Footer from '~/widgets/Footer'
import GlowBackground from '~/widgets/GlobalLayout/GlowBackground'
import useSalon from '~/widgets/GlobalLayout/salon/main'
import HomeHeader from '~/widgets/HomeHeader'

const DEFAULT_CONTAINER_WIDTH = 1420

type TProps = {
  children: ReactNode
}

const Main: FC<TProps> = ({ children }) => {
  const s = useSalon()
  const { locale } = useTrans()
  const { hasTopbar } = useTopbar()
  const { background } = usePageBg()
  const { scrollY } = useScroll()

  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const [fromWidth, setFromWidth] = useState(DEFAULT_CONTAINER_WIDTH)
  const [toWidth, setToWidth] = useState(DEFAULT_CONTAINER_WIDTH)
  const [scrollRange, setScrollRange] = useState(0)
  const [enabled, setEnabled] = useState(false)

  // ----------------------
  // 客户端初始化
  // ----------------------
  useEffect(() => {
    if (!mounted) return

    /** tailwind 的 token 在这里获取不到 --container-landing-width, 需要一个值相同的默认值 */
    const tokenWidth = DEFAULT_CONTAINER_WIDTH

    const updateVars = () => {
      const vw = window.innerWidth
      const vh = window.innerHeight || 1
      setFromWidth(vw)
      setToWidth(Math.min(tokenWidth, vw))
      setScrollRange(vh)

      // 初始顶部宽度为 100%
      if (scrollY.get() === 0) {
        document.documentElement.style.setProperty('--container-landing-width', `${vw}px`)
      }
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
  }, [mounted, scrollY])

  // ----------------------
  // scroll progress
  // ----------------------
  const progress = useTransform(scrollY, [0, scrollRange], [0, 1], { clamp: true })
  const smoothProgress = useSpring(progress, {
    stiffness: 150, // 越小越慢，越柔和
    damping: 6, // 越小越有弹性
    mass: 0.25, // 越大惯性越明显
  })

  // ----------------------
  // 宽度计算
  // ----------------------
  const widthPx = useTransform(smoothProgress, (p) => {
    // 如果在顶部，保持 100% 初始宽度
    if (scrollY.get() === 0) {
      return fromWidth
    }

    const width = fromWidth + p * (toWidth - fromWidth)
    if (mounted) {
      document.documentElement.style.setProperty('--container-landing-width', `${width}px`)
    }
    return width
  })

  const maxWidth = useMotionTemplate`${widthPx}px`
  const effectiveMaxWidth = mounted && enabled ? maxWidth : '100%'

  return (
    <>
      <HomeHeader maxWidth={effectiveMaxWidth} sticky />
      <motion.main
        key={locale}
        className={s.wrapper}
        style={{
          background,
          maxWidth: effectiveMaxWidth,
          transition: mounted && enabled ? 'max-width 0.15s ease-out' : undefined,
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
