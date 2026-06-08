/* *
 * KanbanThread
 */

'use client'

import type { UIEvent } from 'react'
import { useEffect, useRef, useState } from 'react'

import Actions from './Actions'
import { BodyRow, HeaderRow, useColumnsData } from './Columns'
import useSalon from './salon'

export default function ClassicLayout() {
  const s = useSalon()
  const columns = useColumnsData()
  const boardRef = useRef<HTMLDivElement | null>(null)
  const headerRef = useRef<HTMLDivElement | null>(null)
  const bodyScrollRef = useRef<HTMLDivElement | null>(null)
  const headerTrackRef = useRef<HTMLDivElement | null>(null)
  const [isHeaderSticky, setIsHeaderSticky] = useState(false)

  useEffect(() => {
    const updateStickyState = () => {
      const board = boardRef.current
      const header = headerRef.current
      if (!board || !header) return

      const boardRect = board.getBoundingClientRect()
      const headerRect = header.getBoundingClientRect()
      const nextSticky = boardRect.top <= 0 && boardRect.bottom > headerRect.height

      setIsHeaderSticky(nextSticky)
    }

    const syncHeaderOffset = () => {
      const scrollLeft = bodyScrollRef.current?.scrollLeft ?? 0

      if (headerTrackRef.current) {
        headerTrackRef.current.style.transform = `translateX(-${scrollLeft}px)`
      }
    }

    const resizeObserver = new ResizeObserver(() => {
      updateStickyState()
      syncHeaderOffset()
    })

    if (boardRef.current) resizeObserver.observe(boardRef.current)
    if (headerRef.current) resizeObserver.observe(headerRef.current)

    updateStickyState()
    syncHeaderOffset()
    window.addEventListener('scroll', updateStickyState, { passive: true })
    window.addEventListener('resize', updateStickyState)

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('scroll', updateStickyState)
      window.removeEventListener('resize', updateStickyState)
    }
  }, [columns.length])

  const handleBodyScroll = (event: UIEvent<HTMLDivElement>) => {
    if (!headerTrackRef.current) return

    headerTrackRef.current.style.transform = `translateX(-${event.currentTarget.scrollLeft}px)`
  }

  return (
    <div className={s.wrapper}>
      <Actions />
      <div ref={boardRef} className={s.boardFrame}>
        <div ref={headerRef} className={s.headerRow(isHeaderSticky)}>
          <HeaderRow columns={columns} trackRef={headerTrackRef} />
        </div>
        <BodyRow columns={columns} scrollRef={bodyScrollRef} onScroll={handleBodyScroll} />
      </div>
    </div>
  )
}
