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

  // ----------------------
  // 客户端初始化
  // ----------------------
  useEffect(() => {
    const getConfiguredContainerWidth = (): number => {
      // 读取 --container-landing-width-init 配置源
      const varValue = window
        .getComputedStyle(document.documentElement)
        .getPropertyValue(`${LANDING_WIDTH_VAR}-init`)
        .trim()

      let value = DEFAULT_CONTAINER_WIDTH
      if (varValue?.endsWith('px') || varValue?.endsWith('rem')) {
        // 使用临时元素来确保 rem/em 被正确计算为 px 值
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
      // 每次运行时都从 CSS 读取原始配置值
      const tokenWidth = getConfiguredContainerWidth()

      const vw = window.innerWidth
      const vh = window.innerHeight || 1
      setFromWidth(vw)
      setToWidth(Math.min(tokenWidth, vw)) // 使用配置值作为目标宽度
      setScrollRange(vh)
    }

    updateVars()
    setEnabled(true)

    let raf: number | null = null
    const onResize = () => {
      if (raf !== null) cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        updateVars() // 窗口变化时执行，获取最新的响应式配置宽度
        raf = null
      })
    }
    window.addEventListener('resize', onResize)

    return () => {
      window.removeEventListener('resize', onResize)
      if (raf !== null) cancelAnimationFrame(raf)
    }
  }, []) // 依赖项数组为空

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
  useTransform(smoothProgress, (p) => {
    // 确保只在客户端执行 DOM 操作
    if (typeof window !== 'undefined') {
      if (scrollY.get() === 0) {
        // 如果在顶部，保持 100% 初始宽度
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
