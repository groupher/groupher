'use client'

import { type CSSProperties, type FC, useLayoutEffect, useRef, useState } from 'react'

import useTrans from '~/hooks/useTrans'

import { DOC_EDITOR_MODE, type TDocEditorMode } from '../../Editor/constant'
import useDocsEditor from '../../Editor/store/hooks'
import useSalon from '../salon/edit_toggle'
import { MODE_ITEMS } from './constant'

const EditToggle: FC = () => {
  const s = useSalon()
  const { t } = useTrans()
  const { mode: activeMode, setMode } = useDocsEditor()
  const trackRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<Record<TDocEditorMode, HTMLButtonElement | null>>({
    [DOC_EDITOR_MODE.EDIT]: null,
    [DOC_EDITOR_MODE.PREVIEW]: null,
  })
  const [indicatorStyle, setIndicatorStyle] = useState<CSSProperties>()

  useLayoutEffect(() => {
    const track = trackRef.current
    const activeItem = itemRefs.current[activeMode]

    if (!track || !activeItem) return

    const syncIndicator = (): void => {
      const trackRect = track.getBoundingClientRect()
      const itemRect = activeItem.getBoundingClientRect()

      setIndicatorStyle({
        opacity: 1,
        transform: `translateX(${itemRect.left - trackRect.left}px)`,
        width: itemRect.width,
      })
    }

    syncIndicator()

    const resizeObserver = new ResizeObserver(syncIndicator)
    resizeObserver.observe(track)
    resizeObserver.observe(activeItem)

    return () => resizeObserver.disconnect()
  }, [activeMode])

  return (
    <div className={s.wrapper}>
      <div ref={trackRef} className={s.track} role='tablist' aria-label={t('dsb.doc.editor')}>
        <span className={s.indicator} style={indicatorStyle} />

        {MODE_ITEMS.map(({ key, label, Icon }) => {
          const active = key === activeMode
          const text = t(label)

          return (
            <button
              key={key}
              ref={(node) => {
                itemRefs.current[key] = node
              }}
              type='button'
              role='tab'
              aria-selected={active}
              aria-label={text}
              className={active ? s.itemActive : s.item}
              onClick={() => setMode?.(key)}
            >
              <Icon className={s.icon} />
              <span className={active ? s.labelActive : s.label}>{text}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default EditToggle
