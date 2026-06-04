'use client'

import { domAnimation, LazyMotion } from 'motion/react'
import { type ChangeEvent, type CSSProperties, type FC, memo, useId, useState } from 'react'

import Bucket from './Bucket'
import Face from './Face'
import { getMoodLabel, normalizeScore } from './helper'
import { DEFAULT_DISTRIBUTION, DEFAULT_FEEDBACK_VALUE } from './model'
import useSalon from './salon'
import type { TFeedbackBucket } from './spec'

type TProps = {
  testid?: string
  value?: number | null
  distribution?: TFeedbackBucket[]
  disabled?: boolean
  onChange?: (value: number) => void
  onCommit?: (value: number) => void
}

type TSquircleStyle = CSSProperties & {
  cornerShape?: 'squircle'
}

const TRACK_STYLE: TSquircleStyle = { cornerShape: 'squircle' }
const TRACK_SHADE_STYLE: TSquircleStyle = {
  background: 'linear-gradient(90deg, #dc6b5d, #d8c95b, #5fbf78)',
  cornerShape: 'squircle',
}

const FeedbackSpectrum: FC<TProps> = ({
  testid = 'feedback-spectrum',
  value = undefined,
  distribution = DEFAULT_DISTRIBUTION,
  disabled = false,
  onChange,
  onCommit,
}) => {
  const s = useSalon()
  const reactId = useId()
  const inputId = `${reactId}-input`
  const labelId = `${reactId}-label`
  const [innerValue, setInnerValue] = useState(DEFAULT_FEEDBACK_VALUE)
  const [active, setActive] = useState(false)
  const score = normalizeScore(value ?? innerValue)
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

  return (
    <section className={s.panel} data-testid={testid}>
      <div className={s.wrapper}>
        <div className={s.head}>
          <label id={labelId} className={s.title} htmlFor={inputId}>
            文档满意度
          </label>
        </div>

        <LazyMotion features={domAnimation}>
          <div className={s.control}>
            <div className={s.trackWrap}>
              <div className={s.track} style={TRACK_STYLE} aria-hidden='true'>
                <div className={s.trackShade} style={TRACK_SHADE_STYLE} />
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
              aria-labelledby={labelId}
              aria-valuetext={`${moodLabel}, ${score} of 100`}
              onChange={handleChange}
              onBlur={handleCommit}
              onKeyUp={handleCommit}
              onPointerDown={() => setActive(true)}
              onPointerCancel={() => setActive(false)}
              onPointerUp={() => {
                setActive(false)
                handleCommit()
              }}
            />
          </div>
        </LazyMotion>

        <div className={s.footer}>
          <div className={s.value}>
            我的评分
            <strong className={s.score}>{score}</strong>
          </div>
          <div className={s.hint}>{moodLabel}</div>
        </div>
      </div>
    </section>
  )
}

export default memo(FeedbackSpectrum)
