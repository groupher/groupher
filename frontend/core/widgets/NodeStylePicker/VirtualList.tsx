'use client'

import { useVirtualizer } from '@tanstack/react-virtual'
import { type CSSProperties, type ReactElement, useEffect, useRef, useState } from 'react'

import type { TVirtualListProps } from './spec'

import scrollStyles from './scroll.module.css'

const parseCssNumber = (value: string): number => {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export default function VirtualList<T>({
  items,
  viewportClassName,
  gridRowClassName,
  itemClassName,
  itemActiveClassName,
  isActive,
  onItemClick,
  getItemKey,
  renderItem,
}: TVirtualListProps<T>): ReactElement {
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const [gridLayout, setGridLayout] = useState({ columns: 1, rowHeight: 40 })

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return

    const updateGridLayout = () => {
      // Layout is CSS-driven. We read the viewport variables here so visual
      // density can be tuned in CSS without duplicating grid constants in TS.
      const styles = window.getComputedStyle(viewport)
      const minWidth = parseCssNumber(styles.getPropertyValue('--icon-grid-min'))
      const gap = parseCssNumber(styles.getPropertyValue('--icon-grid-gap'))
      const paddingX = parseCssNumber(styles.getPropertyValue('--icon-grid-pad-x'))
      const rowHeight = parseCssNumber(styles.getPropertyValue('--icon-grid-row-height')) || 40

      // Derive how many cells fit in the currently visible width.
      // Smaller viewport or larger min cell width => fewer columns.
      const availableWidth = Math.max(0, viewport.clientWidth - paddingX * 2)
      const columns = Math.max(1, Math.floor((availableWidth + gap) / (minWidth + gap)))

      setGridLayout({ columns, rowHeight })
    }

    updateGridLayout()

    const observer = new ResizeObserver(updateGridLayout)
    observer.observe(viewport)

    return () => observer.disconnect()
  }, [])

  const virtualizer = useVirtualizer({
    count: Math.ceil(items.length / gridLayout.columns),
    getScrollElement: () => viewportRef.current,
    estimateSize: () => gridLayout.rowHeight,
    overscan: 6,
  })

  const virtualRows = virtualizer.getVirtualItems()

  return (
    <div
      ref={viewportRef}
      className={[viewportClassName, scrollStyles.viewport].join(' ')}
      onWheelCapture={(event) => {
        event.stopPropagation()
      }}
    >
      <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
        {virtualRows.map((virtualRow) => {
          const rowItems = items.slice(
            virtualRow.index * gridLayout.columns,
            virtualRow.index * gridLayout.columns + gridLayout.columns,
          )
          const rowStyle: CSSProperties = {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: `${virtualRow.size}px`,
            transform: `translateY(${virtualRow.start}px)`,
          }

          return (
            <div key={virtualRow.key} style={rowStyle}>
              <div
                className={gridRowClassName}
                style={{
                  gridTemplateColumns: `repeat(${gridLayout.columns}, minmax(0, 1fr))`,
                  columnGap: 'var(--icon-grid-gap)',
                }}
              >
                {rowItems.map((item) => {
                  const active = isActive?.(item) ?? false

                  return (
                    <button
                      key={getItemKey(item)}
                      type='button'
                      className={[itemClassName, active ? itemActiveClassName : '']
                        .filter(Boolean)
                        .join(' ')}
                      onClick={() => onItemClick?.(item)}
                    >
                      {renderItem(item)}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
