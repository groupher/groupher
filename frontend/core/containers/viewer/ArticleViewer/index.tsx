'use client'
/*
 * ArticleViewer
 */
import { useLayoutEffect, useRef } from 'react'

import { ANCHOR } from '~/const/dom'
import Comments from '~/containers/unit/Comments'
import type { TArticleLoad } from '~/spec'
import DrawerHeader from './DrawerHeader'
import useSalon from './salon'

import useLogic from './useLogic'
import Viewer from './Viewer'

type TProps = TArticleLoad

export default (_props: TProps) => {
  const s = useSalon()
  const { article } = useLogic()
  const wrapperRef = useRef<HTMLDivElement | null>(null)

  useLayoutEffect(() => {
    if (!article) return

    const wrapper = wrapperRef.current
    if (!wrapper) return

    const container = wrapper.closest<HTMLElement>('[data-drawer-scroll-container]')
    if (!container) return

    const scrollToHeader = () => {
      const anchor = wrapper.querySelector<HTMLElement>(`#${ANCHOR.DRAWER_HEAD}`)
      if (!anchor) return

      const containerRect = container.getBoundingClientRect()
      const anchorRect = anchor.getBoundingClientRect()
      const nextScrollTop = container.scrollTop + (anchorRect.top - containerRect.top)

      container.scrollTop = Math.max(0, nextScrollTop)
    }

    scrollToHeader()

    let raf3: number | null = null
    const raf1 = window.requestAnimationFrame(scrollToHeader)
    const raf2 = window.requestAnimationFrame(() => {
      raf3 = window.requestAnimationFrame(scrollToHeader)
    })
    const timer1 = window.setTimeout(scrollToHeader, 120)
    const timer2 = window.setTimeout(scrollToHeader, 320)

    return () => {
      window.cancelAnimationFrame(raf1)
      window.cancelAnimationFrame(raf2)
      if (raf3) window.cancelAnimationFrame(raf3)
      window.clearTimeout(timer1)
      window.clearTimeout(timer2)
    }
  }, [article])

  if (!article) return null

  return (
    <div ref={wrapperRef} className={s.wrapper}>
      <div id={ANCHOR.DRAWER_HEAD} data-drawer-scroll-anchor className='h-px w-full' />
      <DrawerHeader />
      <div className='relative'>
        <Viewer article={article} />

        <div className={s.comments}>
          <Comments />
        </div>
      </div>
    </div>
  )
}
