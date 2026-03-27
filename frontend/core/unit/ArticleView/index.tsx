'use client'
/*
 * ArticleViewer
 */
import { startTransition, useEffect, useLayoutEffect, useRef, useState } from 'react'

import { ANCHOR } from '~/const/dom'
import type { TArticleLoad } from '~/spec'
import Comments from '~/unit/Comments'
import DrawerHeader from './DrawerHeader'
import useSalon from './salon'

import useLogic from './useLogic'
import Viewer from './Viewer'

type TProps = TArticleLoad
type TViewProps = {
  isFullView?: boolean
}

const syncDrawerToHeader = (wrapper: HTMLDivElement) => {
  const container = wrapper.closest<HTMLElement>('[data-drawer-scroll-container]')
  if (!container) return

  const anchor = wrapper.querySelector<HTMLElement>(`#${ANCHOR.DRAWER_HEAD}`)
  if (!anchor) return

  const containerRect = container.getBoundingClientRect()
  const anchorRect = anchor.getBoundingClientRect()
  const nextScrollTop = container.scrollTop + (anchorRect.top - containerRect.top)

  container.scrollTop = Math.max(0, nextScrollTop)
}

export default function ArticleViewer({ isFullView = true }: TProps & TViewProps) {
  const s = useSalon()
  const { article } = useLogic()
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const [commentsVisible, setCommentsVisible] = useState(false)

  useLayoutEffect(() => {
    if (!article) return

    const wrapper = wrapperRef.current
    if (!wrapper) return

    // scrollTop=0 only resets the drawer container. The preview's readable start
    // lives at DRAWER_HEAD, and cached-lite/cached-full/live phases can shift where that
    // anchor ends up. Re-sync against the content anchor after each content mount.
    const scrollToHeader = () => syncDrawerToHeader(wrapper)

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

  useEffect(() => {
    if (!article || !isFullView) {
      setCommentsVisible(false)
      return
    }

    // Comments are the heaviest subtree in preview. Let the article body paint
    // first, then mount comments in a follow-up transition.
    setCommentsVisible(false)

    let innerRaf: number | null = null
    const outerRaf = window.requestAnimationFrame(() => {
      innerRaf = window.requestAnimationFrame(() => {
        startTransition(() => {
          setCommentsVisible(true)
        })
      })
    })

    return () => {
      window.cancelAnimationFrame(outerRaf)
      if (innerRaf) {
        window.cancelAnimationFrame(innerRaf)
      }
    }
  }, [article?.id, article?.innerId, isFullView, article])

  if (!article) return null

  return (
    <div ref={wrapperRef} className={s.wrapper}>
      <div id={ANCHOR.DRAWER_HEAD} data-drawer-scroll-anchor className='w-full h-px' />
      <DrawerHeader />
      <div className='relative'>
        <Viewer article={article} isFullView={isFullView} />

        {isFullView && commentsVisible && (
          <div className={s.comments}>
            <Comments />
          </div>
        )}
      </div>
    </div>
  )
}
