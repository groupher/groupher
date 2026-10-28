import { useReducedMotion } from 'motion/react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

import { COVER_SCENES } from '../../../const/coverScenes'
import { useCoverMotionProgress } from '../../../stores/coverMotion/context'
import { useCoverScene } from '../../../stores/coverScene/context'
import { getCoverSlot, SIDE_COUNT, type TCoverTransition } from './coverLoop'
import CoverLoopScene from './CoverLoopScene'

export default function DesktopCoverLoop() {
  const { scene, selectScene } = useCoverScene()
  const coverProgress = useCoverMotionProgress()
  const reducedMotion = useReducedMotion() ?? false
  const [activeIndex, setActiveIndex] = useState(() =>
    COVER_SCENES.findIndex((item) => item.id === scene.id),
  )
  const [transition, setTransition] = useState<TCoverTransition | null>(null)
  const [galleryWidth, setGalleryWidth] = useState(1990)
  const [cycles, setCycles] = useState<Record<string, number>>({})
  const queuedScene = useRef<string | null>(null)
  const pendingScene = useRef<string | null>(null)
  const loopRef = useRef<HTMLDivElement>(null)

  useEffect(
    () => () => {
      if (pendingScene.current) selectScene(pendingScene.current)
    },
    [selectScene],
  )

  useLayoutEffect(() => {
    const element = loopRef.current
    if (!element) return
    const update = () => setGalleryWidth(element.getBoundingClientRect().width)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const select = useCallback(
    (id: string) => {
      const targetIndex = COVER_SCENES.findIndex((item) => item.id === id)
      if (targetIndex < 0 || targetIndex === activeIndex) return
      if (transition) {
        queuedScene.current = id
        return
      }
      if (reducedMotion) {
        setActiveIndex(targetIndex)
        selectScene(id)
        return
      }
      pendingScene.current = id
      setTransition({ to: targetIndex, shift: getCoverSlot(targetIndex, activeIndex) })
    },
    [activeIndex, reducedMotion, selectScene, transition],
  )

  const finish = useCallback(() => {
    if (!transition) return
    const { to, shift } = transition
    setCycles((previous) => {
      const next = { ...previous }
      for (const [index, item] of COVER_SCENES.entries()) {
        const rawSlot = getCoverSlot(index, activeIndex) - shift
        if (rawSlot < -SIDE_COUNT || rawSlot > SIDE_COUNT) next[item.id] = (next[item.id] ?? 0) + 1
      }
      return next
    })
    setActiveIndex(to)
    selectScene(COVER_SCENES[to].id)
    pendingScene.current = null
    setTransition(null)
  }, [activeIndex, selectScene, transition])

  useEffect(() => {
    if (transition || !queuedScene.current) return
    const next = queuedScene.current
    queuedScene.current = null
    select(next)
  }, [select, transition])

  return (
    <div ref={loopRef} className='cover-scene-loop'>
      {COVER_SCENES.map((item, index) => (
        <CoverLoopScene
          key={item.id}
          scene={item}
          index={index}
          activeIndex={activeIndex}
          transition={transition}
          cycle={cycles[item.id] ?? 0}
          galleryWidth={galleryWidth}
          coverProgress={coverProgress}
          reducedMotion={reducedMotion}
          onSelect={select}
          onComplete={finish}
        />
      ))}
    </div>
  )
}
