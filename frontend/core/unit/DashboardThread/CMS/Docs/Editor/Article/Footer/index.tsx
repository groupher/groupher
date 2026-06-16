'use client'

import { AnimatePresence, domAnimation, LazyMotion, m } from 'motion/react'
import { type FC, useCallback, useState } from 'react'

import FeedbackSpectrum from '~/widgets/FeedbackSpectrum'

import ActionButton from './ActionButton'
import { FOOTER_ACTIONS, FOOTER_TITLE } from './constant'
import FeedbackTags from './FeedbackTags'
import useSalon from './salon'

const Footer: FC = () => {
  const s = useSalon()
  const [showFeedbackTags, setShowFeedbackTags] = useState(false)
  const [feedbackScore, setFeedbackScore] = useState(0)

  const handleSpectrumDragEnd = useCallback((score: number) => {
    setFeedbackScore(score)
    setShowFeedbackTags(true)
  }, [])

  return (
    <footer className={s.wrapper}>
      <div className={s.heading}>
        <span className={s.title}>{FOOTER_TITLE}</span>
        <span className={s.topDivider} />
      </div>

      <div className={s.content}>
        <FeedbackSpectrum onDragEnd={handleSpectrumDragEnd} />

        <div className={s.actions}>
          {FOOTER_ACTIONS.map((action) => (
            <ActionButton key={action.key} action={action} />
          ))}
        </div>
      </div>

      <LazyMotion features={domAnimation}>
        <AnimatePresence initial={false}>
          {showFeedbackTags && (
            <m.div
              key='feedback-tags'
              initial={{ height: 0, opacity: 0, marginTop: 0 }}
              animate={{ height: 'auto', opacity: 1, marginTop: 4 }}
              exit={{ height: 0, opacity: 0, marginTop: 0 }}
              transition={{ duration: 0.18, ease: 'easeInOut' }}
              className={s.feedbackTagsMotion}
            >
              <FeedbackTags score={feedbackScore} />
            </m.div>
          )}
        </AnimatePresence>
      </LazyMotion>

      <div className={s.bottomDivider} />
    </footer>
  )
}

export default Footer
