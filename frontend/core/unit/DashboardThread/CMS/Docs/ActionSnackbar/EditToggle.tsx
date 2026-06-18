'use client'

import {
  type CSSProperties,
  type FC,
  type SVGProps,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'

import useTrans from '~/hooks/useTrans'
import EditPenSVG from '~/icons/EditPen'
import JoinEyeSVG from '~/icons/JoinEye'
import type { TTransKey } from '~/spec'

import useSalon from './salon/edit_toggle'

type TMode = 'edit' | 'preview'

type TModeItem = {
  key: TMode
  label: TTransKey
  Icon: FC<SVGProps<SVGSVGElement>>
}

const MODE_ITEMS: readonly TModeItem[] = [
  { key: 'edit', label: 'dsb.doc.action.edit', Icon: EditPenSVG },
  { key: 'preview', label: 'dsb.doc.action.preview', Icon: JoinEyeSVG },
]

const EditToggle: FC = () => {
  const s = useSalon()
  const { t } = useTrans()
  const trackRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<Record<TMode, HTMLButtonElement | null>>({
    edit: null,
    preview: null,
  })
  const [activeMode, setActiveMode] = useState<TMode>('edit')
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
              onClick={() => setActiveMode(key)}
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
