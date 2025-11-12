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

  const [fromWidth, setFromWidth] = useState(DEFAULT_CONTAINER_WIDTH)
  const [toWidth, setToWidth] = useState(DEFAULT_CONTAINER_WIDTH)
  const [scrollRange, setScrollRange] = useState(0)
  const [enabled, setEnabled] = useState(false)

  // ----------------------
  // 客户端初始化
  // ----------------------
  useEffect(() => {
    // 改进后的核心函数： reliably 获取计算后的像素值
    const getConfiguredContainerWidth = (): number => {
      // 创建一个临时元素，应用我们的 CSS 工具类
      const tempDiv = document.createElement('div')
      tempDiv.style.visibility = 'hidden'
      tempDiv.style.position = 'fixed'
      // *** 关键：读取 --container-landing-width-base ***
      tempDiv.style.maxWidth = 'var(--container-landing-width-base)'
      document.body.appendChild(tempDiv)

      // 读取浏览器计算后的 max-width 像素值
      const computedStyle = window.getComputedStyle(tempDiv)
      const maxWidthValue = computedStyle.maxWidth

      // 清理 DOM
      document.body.removeChild(tempDiv)

      let value = DEFAULT_CONTAINER_WIDTH
      if (maxWidthValue?.endsWith('px')) {
        value = parseFloat(maxWidthValue)
      }

      console.log('## getConfiguredContainerWidth computed value: ', value)
      return value
    }

    const updateVars = () => {
      // 每次运行时都从 CSS 读取原始配置值
      const tokenWidth = getConfiguredContainerWidth()

      const vw = window.innerWidth
      const vh = window.innerHeight || 1
      setFromWidth(vw)
      setToWidth(Math.min(tokenWidth, vw))
      setScrollRange(vh)

      // 注意：这里我们不再劫持 CSS 变量，让动画去设置它
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
  const widthPx = useTransform(smoothProgress, (p) => {
    // 如果在顶部，保持 100% 初始宽度
    if (scrollY.get() === 0) {
      return fromWidth
    }

    const width = fromWidth + p * (toWidth - fromWidth)

    // 在这里，我们将动画值安全地设置给 --container-landing-width 渲染变量
    if (typeof window !== 'undefined') {
      document.documentElement.style.setProperty('--container-landing-width', `${width}px`)
    }
    return width
  })

  const maxWidth = useMotionTemplate`${widthPx}px`
  const effectiveMaxWidth = enabled ? maxWidth : '100%' // 移除 mounted 检查

  return (
    <>
      <HomeHeader maxWidth={effectiveMaxWidth} sticky />
      <motion.main
        key={locale}
        className={s.wrapper}
        style={{
          background,
          maxWidth: effectiveMaxWidth,
          transition: enabled ? 'max-width 0.15s ease-out' : undefined, // 移除 mounted 检查
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
