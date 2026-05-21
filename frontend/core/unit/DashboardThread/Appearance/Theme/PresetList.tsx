import { AnimatePresence, domAnimation, LazyMotion, m, useAnimationControls } from 'motion/react'
import type { Transition } from 'motion/react'
import { useEffect, useState } from 'react'

import { THEME_PRESET, THEME_PRESET_OPTIONS } from '~/const/theme_preset'
import useTrans from '~/hooks/useTrans'
import ArrowsSplitSVG from '~/icons/ArrowsSplit'

import PresetCard from './PresetCard'
import useSalon, { ROTATE_ANGLES } from './salon/preset_list'
import type { TThemePresetCardMode, TThemePresetOption, TThemePresetOverwrite } from './spec'

const CARD_LAYOUT_TRANSITION = {
  duration: 0.8,
  ease: [0.22, 1, 0.36, 1],
} as const

const CARD_STAGGER = 0.1

const INCOMING_DOT_TRANSITION: Transition = {
  duration: 0.72,
  ease: 'linear',
  times: [0, 0.73, 1],
}

const OUTGOING_TOP_DOT_TRANSITION: Transition = {
  duration: 2.3,
  ease: [0.22, 1, 0.36, 1],
  times: [0, 0.84, 1],
}

const OUTGOING_BOTTOM_DOT_TRANSITION: Transition = {
  duration: 2.3,
  ease: [0.22, 1, 0.36, 1],
  delay: 0.56,
  times: [0, 0.84, 1],
}

const listVariants = {
  visible: (direction: number) => ({
    transition: {
      delayChildren: direction > 0 ? 0.02 : 0,
      staggerChildren: CARD_STAGGER,
      staggerDirection: direction,
    },
  }),
}

const cardVariants = {
  hidden: (direction: number) => ({
    opacity: 0,
    x: 28 * direction,
    scale: 0.92,
  }),
  visible: {
    opacity: 1,
    x: 0,
    scale: 1,
  },
  exit: (direction: number) => ({
    opacity: 0,
    x: 36 * direction,
    scale: 0.9,
  }),
}

type TPresetListItem =
  | {
      type: 'preset'
      preset: TThemePresetOption
    }
  | {
      type: 'forkedFrom'
    }

type TProps = {
  activePreset: string
  activePresetBase: string
  hasCustomPreset: boolean
  customOverwrite: TThemePresetOverwrite
  showForkRelation: boolean
  onSelect: (preset: TThemePresetOption) => void
}

export default function PresetList({
  activePreset,
  activePresetBase,
  hasCustomPreset,
  customOverwrite,
  showForkRelation,
  onSelect,
}: TProps) {
  const s = useSalon({ showForkRelation })
  const { t } = useTrans()
  const [hoveredPreset, setHoveredPreset] = useState<string | null>(null)
  const incomingDotControls = useAnimationControls()
  const outgoingTopDotControls = useAnimationControls()
  const outgoingBottomDotControls = useAnimationControls()
  const basePreset =
    THEME_PRESET_OPTIONS.find((preset) => preset.value === activePresetBase) ??
    THEME_PRESET_OPTIONS[0]
  const customPreset: TThemePresetOption = {
    value: THEME_PRESET.CUSTOM,
    overwrite: customOverwrite,
  }
  const isCustomPreset = activePreset === THEME_PRESET.CUSTOM
  const collapseDirection = isCustomPreset && showForkRelation ? -1 : 1
  const shouldShowCustomPreset = hasCustomPreset || isCustomPreset
  const presetOptions = shouldShowCustomPreset
    ? showForkRelation
      ? [customPreset, basePreset]
      : [customPreset, ...THEME_PRESET_OPTIONS]
    : THEME_PRESET_OPTIONS
  const presetItems: TPresetListItem[] = showForkRelation
    ? [
        { type: 'preset', preset: customPreset },
        { type: 'forkedFrom' },
        { type: 'preset', preset: basePreset },
      ]
    : presetOptions.map((preset) => ({ type: 'preset' as const, preset }))

  useEffect(() => {
    if (!showForkRelation) return

    let live = true
    let animationTimer: ReturnType<typeof setTimeout> | null = null

    const playForkDots = async () => {
      incomingDotControls.set({ x: 64, y: 0, opacity: 0, scale: 1 })
      outgoingTopDotControls.set({ x: -2, y: -4, opacity: 0, scale: 0 })
      outgoingBottomDotControls.set({ x: -2, y: 4, opacity: 0, scale: 0 })

      await incomingDotControls.start({
        x: [64, 2, 2],
        y: [0, 0, 0],
        opacity: [0.9, 0.85, 0],
        scale: [1, 0.3, 0],
        transition: INCOMING_DOT_TRANSITION,
      })

      if (!live) return

      void outgoingTopDotControls.start({
        x: [-2, -46, -46],
        y: [-4, -4, -4],
        opacity: [0.85, 0, 0],
        scale: [0.35, 1, 1],
        transition: OUTGOING_TOP_DOT_TRANSITION,
      })
      void outgoingBottomDotControls.start({
        x: [-2, -48, -48],
        y: [4, 4, 4],
        opacity: [0.85, 0, 0],
        scale: [0.35, 1, 1],
        transition: OUTGOING_BOTTOM_DOT_TRANSITION,
      })
    }

    animationTimer = setTimeout(() => {
      void playForkDots()
    }, CARD_LAYOUT_TRANSITION.duration * 1000)

    return () => {
      live = false
      if (animationTimer) clearTimeout(animationTimer)
      incomingDotControls.stop()
      outgoingTopDotControls.stop()
      outgoingBottomDotControls.stop()
    }
  }, [incomingDotControls, outgoingBottomDotControls, outgoingTopDotControls, showForkRelation])

  return (
    <LazyMotion features={domAnimation}>
      <m.div
        layout
        className={s.presetList}
        custom={collapseDirection}
        variants={listVariants}
        animate='visible'
        transition={{ layout: CARD_LAYOUT_TRANSITION }}
      >
        <AnimatePresence initial={false} mode='popLayout' custom={collapseDirection}>
          {presetItems.map((item, index) => {
            if (item.type === 'forkedFrom') {
              return (
                <m.div
                  key='forked-from-label'
                  layout
                  custom={collapseDirection}
                  variants={cardVariants}
                  initial='hidden'
                  animate='visible'
                  exit='exit'
                  transition={{ ...CARD_LAYOUT_TRANSITION, layout: CARD_LAYOUT_TRANSITION }}
                  className={s.forkedFrom}
                >
                  <span className={s.forkedFromIconFx}>
                    <ArrowsSplitSVG className={s.forkedFromIcon} />
                    <m.span
                      className={s.forkedFromDot}
                      initial={{ x: 64, y: 0, opacity: 0, scale: 1 }}
                      animate={incomingDotControls}
                    />
                    <m.span
                      className={s.forkedFromDot}
                      initial={{ x: -2, y: -4, opacity: 0, scale: 0 }}
                      animate={outgoingTopDotControls}
                    />
                    <m.span
                      className={s.forkedFromDot}
                      initial={{ x: -2, y: 4, opacity: 0, scale: 0 }}
                      animate={outgoingBottomDotControls}
                    />
                  </span>
                  <span>{t('dsb.appearance.theme.preset.forked_from')}</span>
                </m.div>
              )
            }

            const { preset } = item
            const readonlyForkBase = showForkRelation && index > 1
            const active = !readonlyForkBase && preset.value === activePreset
            const cardMode: TThemePresetCardMode = showForkRelation
              ? readonlyForkBase
                ? 'forkBase'
                : 'forkActive'
              : 'stacked'

            return (
              <m.div
                key={preset.value}
                layout
                custom={collapseDirection}
                variants={cardVariants}
                initial='hidden'
                animate='visible'
                exit='exit'
                transition={{ ...CARD_LAYOUT_TRANSITION, layout: CARD_LAYOUT_TRANSITION }}
                className={showForkRelation ? (index === 0 ? s.customCard : s.baseCard) : undefined}
              >
                <PresetCard
                  preset={preset}
                  active={active}
                  activeSuppressed={
                    active && hoveredPreset !== null && hoveredPreset !== preset.value
                  }
                  mode={cardMode}
                  rotateAngle={showForkRelation ? 0 : (ROTATE_ANGLES[index] ?? 0)}
                  onHover={setHoveredPreset}
                  onSelect={onSelect}
                />
              </m.div>
            )
          })}
        </AnimatePresence>
      </m.div>
    </LazyMotion>
  )
}
