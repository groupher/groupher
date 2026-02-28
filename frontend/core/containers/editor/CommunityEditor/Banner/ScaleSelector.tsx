import { useState } from 'react'

import useSalon, { cn } from '../salon/banner/scale_selector'

const STEP = {
  S: '15%',
  X: '40%',
  M: '65%',
  L: '91%',
}

export default () => {
  const s = useSalon()
  const [step, setStep] = useState(STEP.X)

  return (
    <div className={s.wrapper}>
      <div className={s.slideBox}>
        <div className={s.gradientBar} style={{ width: step }}>
          <div className={s.gradientBg} />
          <div className={s.indexDot}>
            <div className={s.indexInner} />
          </div>
        </div>

        <div className={s.markDot} onClick={() => setStep(STEP.S)}>
          <div className={s.markInner} />
        </div>
        <div className={s.markDot} onClick={() => setStep(STEP.X)}>
          <div className={s.markInner} />
        </div>
        <div className={s.markDot} onClick={() => setStep(STEP.M)}>
          <div className={s.markInner} />
        </div>
        <div className={s.markDot} onClick={() => setStep(STEP.L)}>
          <div className={s.markInner} />
        </div>
      </div>
      <div className={s.footer}>
        <div
          className={cn(s.noteBtn, '-ml-5', step === STEP.S && s.noteBtnActive)}
          onClick={() => setStep(STEP.S)}
        >
          独立开发者
        </div>
        <div
          className={cn(s.noteBtn, '-ml-4', step === STEP.X && s.noteBtnActive)}
          onClick={() => setStep(STEP.X)}
        >
          2-20
        </div>
        <div
          className={cn(s.noteBtn, '-ml-1', step === STEP.M && s.noteBtnActive)}
          onClick={() => setStep(STEP.M)}
        >
          20-100
        </div>
        <div
          className={cn(s.noteBtn, '-ml-1 mr-0.5', step === STEP.L && s.noteBtnActive)}
          onClick={() => setStep(STEP.L)}
        >
          100+
        </div>
      </div>
    </div>
  )
}
