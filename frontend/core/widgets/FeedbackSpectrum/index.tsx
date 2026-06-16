'use client'

import { domAnimation, LazyMotion } from 'motion/react'
import {
  type ChangeEvent,
  type CSSProperties,
  type FC,
  memo,
  type PointerEvent,
  useId,
  useRef,
  useState,
} from 'react'

import Bucket from './Bucket'
import Face from './Face'
import { darkenColor, getMood, getMoodLabel, normalizeScore } from './helper'
import { DEFAULT_DISTRIBUTION, DEFAULT_FEEDBACK_VALUE, FEEDBACK_SPECTRUM_LABEL } from './model'
import useSalon from './salon'
import type { TFeedbackBucket } from './spec'

type TProps = {
  testid?: string
  value?: number | null
  distribution?: TFeedbackBucket[]
  disabled?: boolean
  onChange?: (value: number) => void
  onCommit?: (value: number) => void
  onDragEnd?: (value: number) => void
}

type TSquircleStyle = CSSProperties & {
  cornerShape?: 'squircle'
}

const TRACK_STYLE: TSquircleStyle = { cornerShape: 'squircle' }
const TRACK_SHADE_STYLE: TSquircleStyle = {
  cornerShape: 'squircle',
}

const FeedbackSpectrum: FC<TProps> = ({
  testid = 'feedback-spectrum',
  value = undefined,
  distribution = DEFAULT_DISTRIBUTION,
  disabled = false,
  onChange,
  onCommit,
  onDragEnd,
}) => {
  const s = useSalon()
  const reactId = useId()
  const inputId = `${reactId}-input`
  const dragStartXRef = useRef<number | null>(null)
  const dragMovedRef = useRef(false)
  const [innerValue, setInnerValue] = useState(DEFAULT_FEEDBACK_VALUE)
  const [active, setActive] = useState(false)
  const score = normalizeScore(value ?? innerValue)
  const mood = getMood(score)
  const glowColor = darkenColor(mood.color)
  const moodLabel = getMoodLabel(score)

  const updateValue = (nextValue: number) => {
    const safeValue = normalizeScore(nextValue)

    if (value === undefined) setInnerValue(safeValue)
    onChange?.(safeValue)
  }

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    updateValue(Number.parseInt(event.currentTarget.value, 10))
  }

  const handleCommit = () => onCommit?.(score)
  const handlePointerDown = (event: PointerEvent<HTMLInputElement>) => {
    dragStartXRef.current = event.clientX
    dragMovedRef.current = false
    setActive(true)
  }

  const handlePointerMove = (event: PointerEvent<HTMLInputElement>) => {
    if (dragStartXRef.current === null) return

    if (Math.abs(event.clientX - dragStartXRef.current) > 3) {
      dragMovedRef.current = true
    }
  }

  const handlePointerEnd = (event: PointerEvent<HTMLInputElement>) => {
    const nextScore = normalizeScore(Number.parseInt(event.currentTarget.value, 10))

    setActive(false)
    handleCommit()

    if (dragMovedRef.current) onDragEnd?.(nextScore)

    dragStartXRef.current = null
    dragMovedRef.current = false
  }

  const handlePointerCancel = () => {
    setActive(false)
    dragStartXRef.current = null
    dragMovedRef.current = false
  }

  return (
    <section className={s.panel} data-testid={testid}>
      <div className={s.wrapper}>
        <LazyMotion features={domAnimation}>
          <div className={s.control}>
            <div className={s.trackWrap}>
              <div className={s.track} style={TRACK_STYLE} aria-hidden='true'>
                <div className={s.trackShade} style={TRACK_SHADE_STYLE} />
                <div className={s.glowClip} style={TRACK_STYLE}>
                  <div
                    className={s.handleGlow}
                    style={{ left: `${score}%`, backgroundColor: glowColor }}
                  />
                </div>
                {distribution.map((bucket) => (
                  <Bucket key={bucket.id} bucket={bucket} />
                ))}
                <Face score={score} active={active} />
              </div>
            </div>

            <input
              id={inputId}
              className={s.range}
              type='range'
              min='0'
              max='100'
              step='1'
              value={score}
              disabled={disabled}
              aria-label={FEEDBACK_SPECTRUM_LABEL}
              aria-valuetext={`${moodLabel}, ${score} of 100`}
              onChange={handleChange}
              onBlur={handleCommit}
              onKeyUp={handleCommit}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerCancel={handlePointerCancel}
              onPointerUp={handlePointerEnd}
            />
          </div>
        </LazyMotion>
      </div>
    </section>
  )
}

export default memo(FeedbackSpectrum)
