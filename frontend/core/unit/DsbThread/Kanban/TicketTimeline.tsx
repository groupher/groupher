'use client'

import { useRef } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'

import useKanbanBgColors from '~/hooks/useKanbanBgColors'
import useTrans from '~/hooks/useTrans'
import useTwBelt from '~/hooks/useTwBelt'
import type { TTicketStatus } from '~/spec'

type TProps = {
  startDate: string
  endDate: string
  status: TTicketStatus
  disabled?: boolean
  onChange: (startDate: string, endDate: string) => void
  onCommit: (startDate: string, endDate: string) => void
}

type TDrag = {
  pointerX: number
  startDate: string
  endDate: string
  pixelsPerDay: number
}

const DAY_MS = 24 * 60 * 60 * 1000
const toDay = (value: string): number => Math.floor(Date.parse(`${value}T00:00:00.000Z`) / DAY_MS)
const toDate = (day: number): string => new Date(day * DAY_MS).toISOString().slice(0, 10)

export default function TicketTimeline({
  startDate,
  endDate,
  status,
  disabled = false,
  onChange,
  onCommit,
}: TProps) {
  const { t } = useTrans()
  const { rainbow } = useTwBelt()
  const [todoColor, wipColor, doneColor] = useKanbanBgColors()
  const trackRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<TDrag | null>(null)
  const today = Math.floor(Date.now() / DAY_MS)
  const hasSchedule = Boolean(startDate && endDate)
  const start = hasSchedule ? toDay(startDate) : today
  const end = hasSchedule ? toDay(endDate) : today
  const rangeStart = today - 90
  const rangeDays = 365
  const left = Math.max(0, Math.min(100, ((start - rangeStart) / rangeDays) * 100))
  const right = Math.max(0, Math.min(100, ((end - rangeStart) / rangeDays) * 100))
  const width = Math.max(2, right - left)
  const barStatus = status === 'DONE' ? 'DONE' : status === 'WIP' ? 'WIP' : 'TODO'
  const barColor = rainbow(
    barStatus === 'DONE' ? doneColor : barStatus === 'WIP' ? wipColor : todoColor,
    'bg',
  )

  const startDrag = (event: PointerEvent<HTMLButtonElement>) => {
    if (disabled) return
    const trackWidth = trackRef.current?.getBoundingClientRect().width ?? 0
    if (!trackWidth) return
    dragRef.current = {
      pointerX: event.clientX,
      startDate: toDate(start),
      endDate: toDate(end),
      pixelsPerDay: trackWidth / rangeDays,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const moveDrag = (event: PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current
    if (!drag) return
    const offset = Math.round((event.clientX - drag.pointerX) / drag.pixelsPerDay)
    onChange(toDate(toDay(drag.startDate) + offset), toDate(toDay(drag.endDate) + offset))
  }

  const finishDrag = (event: PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current
    if (!drag) return
    const offset = Math.round((event.clientX - drag.pointerX) / drag.pixelsPerDay)
    const nextStart = toDate(toDay(drag.startDate) + offset)
    const nextEnd = toDate(toDay(drag.endDate) + offset)
    dragRef.current = null
    onChange(nextStart, nextEnd)
    onCommit(nextStart, nextEnd)
  }

  const shiftByOneDay = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    const offset = event.key === 'ArrowLeft' ? -1 : 1
    const nextStart = toDate(start + offset)
    const nextEnd = toDate(end + offset)
    onChange(nextStart, nextEnd)
    onCommit(nextStart, nextEnd)
  }

  return (
    <section className='border-divider space-y-3 rounded-xl border p-4'>
      <div className='flex items-center justify-between gap-3'>
        <h2 className='font-semibold'>{t('ticket.workbench.timeline')}</h2>
        <p className='text-digest text-xs'>
          {startDate || '—'} → {endDate || '—'}
        </p>
      </div>
      {hasSchedule ? (
        <div ref={trackRef} className='bg-hoverBg relative h-12 touch-pan-y rounded-lg'>
          <div className='border-divider absolute inset-y-0 left-1/4 border-l' />
          <div className='border-divider absolute inset-y-0 left-1/2 border-l' />
          <div className='border-divider absolute inset-y-0 left-3/4 border-l' />
          <button
            type='button'
            className={`absolute top-2 h-8 rounded-md px-3 text-xs font-medium text-white shadow-sm ${barColor} ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-grab active:cursor-grabbing'}`}
            style={{ left: `${left}%`, width: `${width}%` }}
            disabled={disabled}
            aria-label={t('ticket.workbench.timeline_drag')}
            aria-valuetext={`${toDate(start)} to ${toDate(end)}`}
            onPointerDown={startDrag}
            onPointerMove={moveDrag}
            onPointerUp={finishDrag}
            onPointerCancel={() => {
              dragRef.current = null
            }}
            onKeyDown={shiftByOneDay}
          >
            {status}
          </button>
        </div>
      ) : (
        <div className='bg-hoverBg text-digest rounded-lg px-4 py-3 text-sm' role='status'>
          {t('ticket.workbench.unscheduled')}
        </div>
      )}
      <div className='text-digest flex justify-between text-xs'>
        <span>{t('ticket.workbench.timeline_past')}</span>
        <span>{t('ticket.workbench.timeline_future')}</span>
      </div>
    </section>
  )
}
