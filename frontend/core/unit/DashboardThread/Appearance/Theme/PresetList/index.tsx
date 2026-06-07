import { AnimatePresence, domAnimation, LazyMotion, m } from 'motion/react'

import { THEME_PRESET } from '~/const/theme_preset'
import useTrans from '~/hooks/useTrans'
import ArrowsSplitSVG from '~/icons/ArrowsSplit'

import type { TThemePresetCardMode, TThemePresetOption } from '../spec'
import { CARD_LAYOUT_TRANSITION, cardVariants, listVariants, ROTATE_ANGLES } from './constant'
import PresetCard from './PresetCard'
import useSalon, { cn } from './salon'
import type { TPresetListItem, TProps } from './spec'
import useForkDotsAnimation from './useForkDotsAnimation'

export default function PresetList({
  activePreset,
  activePresetBase,
  presetOptions,
  customTokens,
  showForkRelation,
  onSelect,
}: TProps) {
  const s = useSalon({ showForkRelation })
  const { t } = useTrans()
  const { incomingDotControls, outgoingTopDotControls, outgoingBottomDotControls } =
    useForkDotsAnimation(showForkRelation)
  const basePreset = presetOptions.find((preset) => preset.value === activePresetBase)
  const savedCustomPreset = presetOptions.find((preset) => preset.value === THEME_PRESET.CUSTOM)
  const readonlyPresetOptions = presetOptions.filter(
    (preset) => preset.value !== THEME_PRESET.CUSTOM,
  )
  const customPreset: TThemePresetOption = {
    ...(savedCustomPreset ?? { value: THEME_PRESET.CUSTOM }),
    tokens: customTokens,
  }
  const isCustomPreset = activePreset === THEME_PRESET.CUSTOM
  const collapseDirection = isCustomPreset && showForkRelation ? -1 : 1
  const shouldShowCustomPreset = !!savedCustomPreset || isCustomPreset
  const displayPresetOptions = shouldShowCustomPreset
    ? showForkRelation
      ? basePreset
        ? [customPreset, basePreset]
        : [customPreset]
      : [customPreset, ...readonlyPresetOptions]
    : readonlyPresetOptions
  const presetItems: TPresetListItem[] = showForkRelation
    ? basePreset
      ? [
          { type: 'preset', preset: customPreset },
          { type: 'forkedFrom' },
          { type: 'preset', preset: basePreset },
        ]
      : [{ type: 'preset', preset: customPreset }]
    : displayPresetOptions.map((preset) => ({ type: 'preset' as const, preset }))

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
                      initial={{ x: -2, y: -4, opacity: 0, scale: 0.95 }}
                      animate={outgoingTopDotControls}
                    />
                    <m.span
                      className={s.forkedFromDot}
                      initial={{ x: -2, y: 4, opacity: 0, scale: 0.95 }}
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
                  mode={cardMode}
                  rotateAngle={showForkRelation ? 0 : (ROTATE_ANGLES[index] ?? 0)}
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
