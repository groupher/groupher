'use client'

import { LazyMotion, domAnimation, m } from 'motion/react'
import { type FC, useState } from 'react'

import { MARKER } from '~/const/marker'
import useTheme from '~/hooks/useTheme'
import type { TMarkerValue } from '~/spec'
import { getIconFilePath } from '~/widgets/IconHub/sprite'
import MarkerRender from '~/widgets/MarkerRender'
import Tooltip from '~/widgets/Tooltip'

import AppearancePanel from './AppearancePanel'
import { DEFAULT_ICON_NAME, DEFAULT_PROVIDER, TAB } from './constant'
import EmojiTab from './EmojiTab'
import { getAppearanceTriggerStyle, resolveActiveAppearance } from './helper'
import IconTab from './IconTab'
import PickerHeader from './PickerHeader'
import useSalon from './salon'
import type { TMarkerPickerProps, TTab } from './spec'

const TAB_ORDER = [TAB.ICON, TAB.EMOJI] as const
const TAB_TRANSITION = {
  duration: 0.18,
  ease: 'easeOut',
} as const

const MarkerPicker: FC<TMarkerPickerProps> = ({
  testid = 'marker-picker',
  compact = false,
  active = false,
  value,
  activeColor,
  activeBg,
  appearance = false,
  triggerClassName,
  iconSize,
  onChange = () => undefined,
}) => {
  const s = useSalon({ compact })
  const { theme } = useTheme()

  const [tab, setTab] = useState<TTab>(TAB.ICON)
  const [direction, setDirection] = useState(1)
  const [panelOpen, setPanelOpen] = useState(false)
  const [appearanceOpen, setAppearanceOpen] = useState(false)
  const [appearanceDraft, setAppearanceDraft] = useState<TMarkerValue | null>(null)
  const [appearanceDirty, setAppearanceDirty] = useState(false)
  const [mountedTabs, setMountedTabs] = useState<Record<TTab, boolean>>({
    [TAB.ICON]: true,
    [TAB.EMOJI]: false,
  })
  const [innerValue, setInnerValue] = useState<TMarkerValue>({
    type: MARKER.ICON,
    provider: DEFAULT_PROVIDER,
    name: DEFAULT_ICON_NAME,
    src: getIconFilePath(DEFAULT_PROVIDER, DEFAULT_ICON_NAME),
  })

  const selectedValue = appearanceDraft ?? value ?? innerValue
  const appearanceTriggerStyle = getAppearanceTriggerStyle(selectedValue, theme)
  const resolvedActiveAppearance = resolveActiveAppearance({
    value: selectedValue,
    theme,
    activeColor,
    activeBg,
  })

  const handleStyleChange = (nextValue: TMarkerValue) => {
    setInnerValue(nextValue)
    onChange(nextValue)
  }

  const commitAppearance = () => {
    if (appearanceDraft && appearanceDirty) handleStyleChange(appearanceDraft)
    setAppearanceDraft(null)
    setAppearanceDirty(false)
  }

  const handleAppearanceChange = (nextValue: TMarkerValue) => {
    setAppearanceDraft(nextValue)
    setAppearanceDirty(true)
  }

  const handleAppearanceToggle = () => {
    if (appearanceOpen) {
      commitAppearance()
      setAppearanceOpen(false)
      return
    }

    setAppearanceDraft(value ?? innerValue)
    setAppearanceDirty(false)
    setAppearanceOpen(true)
  }

  const handleTabChange = (key: TTab) => {
    if (appearanceOpen) {
      commitAppearance()
      setAppearanceOpen(false)
    }

    if (key === tab) return

    setDirection(TAB_ORDER.indexOf(key) > TAB_ORDER.indexOf(tab) ? 1 : -1)
    setTab(key)
    setMountedTabs((prev) => (prev[key] ? prev : { ...prev, [key]: true }))
  }

  const handlePanelHide = () => {
    commitAppearance()
    setAppearanceOpen(false)
    setPanelOpen(false)
  }

  const hiddenX = direction > 0 ? 14 : -14
  const iconTabActive = !appearanceOpen && tab === TAB.ICON
  const emojiTabActive = !appearanceOpen && tab === TAB.EMOJI

  return (
    <div className={s.wrapper} data-testid={testid}>
      <Tooltip
        placement='bottom-start'
        trigger='click'
        hideOnClick={false}
        offset={[0, 8]}
        maxWidth='24rem'
        noPadding
        portalToBody
        onShow={() => setPanelOpen(true)}
        onHide={handlePanelHide}
        content={
          <div className={s.panel}>
            <PickerHeader
              tab={tab}
              appearance={appearance}
              appearanceOpen={appearanceOpen}
              appearanceColor={appearanceTriggerStyle.color}
              appearanceBg={appearanceTriggerStyle.bg}
              onTabChange={handleTabChange}
              onAppearanceToggle={handleAppearanceToggle}
            />

            <LazyMotion features={domAnimation}>
              <div className={s.content}>
                {mountedTabs[TAB.ICON] && (
                  <m.div
                    initial={false}
                    inert={!iconTabActive}
                    animate={{
                      opacity: iconTabActive ? 1 : 0,
                      x: iconTabActive ? 0 : hiddenX,
                      scale: iconTabActive ? 1 : 0.985,
                      pointerEvents: iconTabActive ? 'auto' : 'none',
                    }}
                    transition={TAB_TRANSITION}
                    aria-hidden={!iconTabActive}
                    className={`${s.tabPanel} ${iconTabActive ? s.tabPanelActive : s.tabPanelInactive}`}
                  >
                    <IconTab
                      panelOpen={panelOpen && iconTabActive}
                      selectedValue={selectedValue}
                      activeColor={resolvedActiveAppearance.color}
                      activeBg={resolvedActiveAppearance.bg}
                      onChange={handleStyleChange}
                    />
                  </m.div>
                )}

                {mountedTabs[TAB.EMOJI] && (
                  <m.div
                    initial={{ opacity: 0, x: hiddenX, scale: 0.985 }}
                    inert={!emojiTabActive}
                    animate={{
                      opacity: emojiTabActive ? 1 : 0,
                      x: emojiTabActive ? 0 : hiddenX,
                      scale: emojiTabActive ? 1 : 0.985,
                      pointerEvents: emojiTabActive ? 'auto' : 'none',
                    }}
                    transition={TAB_TRANSITION}
                    aria-hidden={!emojiTabActive}
                    className={`${s.tabPanel} ${emojiTabActive ? s.tabPanelActive : s.tabPanelInactive}`}
                  >
                    <EmojiTab
                      open={panelOpen && emojiTabActive}
                      selectedValue={selectedValue}
                      onChange={handleStyleChange}
                    />
                  </m.div>
                )}

                {appearance && (
                  <m.div
                    initial={false}
                    inert={!appearanceOpen}
                    animate={{
                      opacity: appearanceOpen ? 1 : 0,
                      scale: appearanceOpen ? 1 : 0.985,
                      pointerEvents: appearanceOpen ? 'auto' : 'none',
                    }}
                    transition={TAB_TRANSITION}
                    aria-hidden={!appearanceOpen}
                    className={`${s.tabPanel} ${appearanceOpen ? s.tabPanelActive : s.tabPanelInactive}`}
                  >
                    <AppearancePanel value={selectedValue} onChange={handleAppearanceChange} />
                  </m.div>
                )}
              </div>
            </LazyMotion>
          </div>
        }
      >
        <button
          type='button'
          className={triggerClassName ? `${s.trigger} ${triggerClassName}` : s.trigger}
        >
          <MarkerRender
            value={selectedValue}
            size={iconSize ?? (compact ? 3.5 : 4.5)}
            colorOverride={resolvedActiveAppearance.color}
            bgOverride={resolvedActiveAppearance.bg}
            tone={active ? 'primary' : 'digest'}
            className={s.markerPreview}
          />
        </button>
      </Tooltip>
    </div>
  )
}

export default MarkerPicker
