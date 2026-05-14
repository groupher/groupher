'use client'

import { type FC, type ReactNode, useEffect, useRef } from 'react'

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

  const layoutRef = useRef({
    fromWidth: DEFAULT_CONTAINER_WIDTH,
    toWidth: DEFAULT_CONTAINER_WIDTH,
    scrollRange: 1,
  })

  useEffect(() => {
    const getConfiguredContainerWidth = (): number => {
      const varValue = window
        .getComputedStyle(document.documentElement)
        .getPropertyValue(`${LANDING_WIDTH_VAR}-init`)
        .trim()

      let value = DEFAULT_CONTAINER_WIDTH
      if (varValue?.endsWith('px') || varValue?.endsWith('rem')) {
        const tempDiv = document.createElement('div')
        tempDiv.style.cssText = `visibility:hidden;position:fixed;max-width:${varValue};`
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
      layoutRef.current = {
        fromWidth: vw,
        toWidth: Math.min(tokenWidth, vw),
        scrollRange: vh,
      }
    }

    const updateContainerWidth = () => {
      const scrollTop = window.scrollY

      if (scrollTop === 0) {
        document.documentElement.style.setProperty(`${LANDING_WIDTH_VAR}`, '100vw')
        return
      }

      const { fromWidth, toWidth, scrollRange } = layoutRef.current
      const progress = Math.min(scrollTop / scrollRange, 1)
      const width = fromWidth + progress * (toWidth - fromWidth)
      document.documentElement.style.setProperty(`${LANDING_WIDTH_VAR}`, `${width}px`)
    }

    const updateLayout = () => {
      updateVars()
      updateContainerWidth()
    }

    let raf: number | null = null
    const requestUpdate = () => {
      if (raf !== null) cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        updateLayout()
        raf = null
      })
    }

    updateLayout()
    window.addEventListener('resize', requestUpdate)
    window.addEventListener('scroll', requestUpdate, { passive: true })

    return () => {
      window.removeEventListener('resize', requestUpdate)
      window.removeEventListener('scroll', requestUpdate)
      if (raf !== null) cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <main key={locale} className={s.wrapper}>
      <HomeHeader />
      {hasTopbar && <div className={s.topBar} />}
      <div className={s.body}>{children}</div>
      <Footer />
      <GlowBackground />
    </main>
  )
}

export default Main
