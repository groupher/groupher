import { AnimatePresence, domAnimation, LazyMotion } from 'motion/react'
import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FC } from 'react'

import { DSB_DOC_EVENT, type TDocPublishSuccessPayload } from '~/const/dsb/docs'
import useEvent from '~/hooks/useEvent'
import Input from '~/widgets/Input'

import { needsPublishAttention } from '../../SideTree/helper'
import type { TDocTreeNodePublishState } from '../../SideTree/spec'
import {
  TITLE_STAGE_PUBLISHED_VISIBLE_MS,
  TITLE_STAGE_VIEW,
  type TTitleStageView,
} from './constant'
import useSalon from './salon'
import Stage from './Stage'

type TProps = {
  docId?: string | null
  value: string
  disabled?: boolean
  publishState?: TDocTreeNodePublishState | null
  onChange: (value: string) => void
}

const Title: FC<TProps> = ({ docId = null, value, disabled = false, publishState, onChange }) => {
  const s = useSalon()
  const draft = needsPublishAttention(publishState)
  const [stageView, setStageView] = useState<TTitleStageView | null>(
    draft ? TITLE_STAGE_VIEW.DRAFT : null,
  )
  const stageViewRef = useRef<TTitleStageView | null>(stageView)
  const hideTimerRef = useRef<number | null>(null)

  useEffect(() => {
    stageViewRef.current = stageView
  }, [stageView])

  const clearHideTimer = useCallback((): void => {
    if (hideTimerRef.current === null) return

    window.clearTimeout(hideTimerRef.current)
    hideTimerRef.current = null
  }, [])

  const showPublished = useCallback((): void => {
    clearHideTimer()
    setStageView(TITLE_STAGE_VIEW.PUBLISHED)
    hideTimerRef.current = window.setTimeout(() => {
      setStageView(null)
      hideTimerRef.current = null
    }, TITLE_STAGE_PUBLISHED_VISIBLE_MS)
  }, [clearHideTimer])

  useEffect(() => {
    if (draft) {
      clearHideTimer()
      setStageView(TITLE_STAGE_VIEW.DRAFT)
      return
    }

    if (stageViewRef.current === TITLE_STAGE_VIEW.DRAFT) {
      showPublished()
      return
    }

    if (stageViewRef.current !== TITLE_STAGE_VIEW.PUBLISHED) {
      setStageView(null)
    }
  }, [clearHideTimer, draft, showPublished])

  useEffect(() => {
    return () => clearHideTimer()
  }, [clearHideTimer])

  useEvent<TDocPublishSuccessPayload>(
    DSB_DOC_EVENT.PUBLISH_SUCCESS,
    (_msg, payload): void => {
      if (!docId || !payload?.docIds.includes(docId)) return

      showPublished()
    },
    [docId, showPublished],
  )

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    onChange(event.target.value)
  }

  return (
    <div className={s.wrapper}>
      <Input
        behavior='textarea'
        fgColor='title'
        className={s.input}
        value={value}
        disabled={disabled}
        placeholder='Title'
        disableEnter
        onChange={handleChange}
      />
      <LazyMotion features={domAnimation}>
        <AnimatePresence mode='wait'>
          {stageView && <Stage key={stageView} view={stageView} />}
        </AnimatePresence>
      </LazyMotion>
    </div>
  )
}

export default Title
