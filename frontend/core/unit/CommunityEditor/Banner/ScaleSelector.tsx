import { useState } from 'react'

import useTrans from '~/hooks/useTrans'

import useSalon, { cn } from './salon/scale_selector'

const STEP = {
  S: '15%',
  X: '40%',
  M: '65%',
  L: '91%',
}

export default function ScaleSelector() {
  const s = useSalon()
  const { t } = useTrans()
  const [step, setStep] = useState(STEP.X)
  const options = [
    { value: STEP.S, label: t('dsb.community.scale.independent') },
    { value: STEP.X, label: t('dsb.community.scale.small') },
    { value: STEP.M, label: t('dsb.community.scale.medium') },
    { value: STEP.L, label: t('dsb.community.scale.large') },
  ]

  return (
    <div className={s.wrapper}>
      <div className={s.slideBox}>
        <div className={s.gradientBar} style={{ width: step }}>
          <div className={s.gradientBg} />
          <div className={s.indexDot}>
            <div className={s.indexInner} />
          </div>
        </div>

        {options.map((option) => (
          <button
            key={option.value}
            type='button'
            className={cn(s.markDot, 'plain-button')}
            aria-label={option.label}
            aria-pressed={step === option.value}
            onClick={() => setStep(option.value)}
          >
            <span className={s.markInner} />
          </button>
        ))}
      </div>
      <div className={s.footer}>
        {options.map((option, index) => (
          <button
            key={option.value}
            type='button'
            className={cn(
              s.noteBtn,
              'plain-button',
              index === 0 && '-ml-5',
              index === 1 && '-ml-4',
              index === 2 && '-ml-1',
              index === 3 && '-ml-1 mr-0.5',
              step === option.value && s.noteBtnActive,
            )}
            aria-pressed={step === option.value}
            onClick={() => setStep(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}
