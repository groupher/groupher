'use client'

import { LazyMotion, domAnimation, m } from 'motion/react'
import { type FC, useState } from 'react'

import { MARKER } from '~/const/marker'
import type { TMarkerValue } from '~/spec'
import { getIconFilePath } from '~/widgets/IconHub/sprite'
import MarkerRender from '~/widgets/MarkerRender'
import { Tabs } from '~/widgets/Switcher'
import Tooltip from '~/widgets/Tooltip'

import { DEFAULT_ICON_NAME, DEFAULT_PROVIDER, TAB, TAB_ITEMS } from './constant'
import EmojiTab from './EmojiTab'
import IconTab from './IconTab'
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
  color,
  triggerClassName,
  iconClassName,
  iconSize,
  emojiClassName,
  devClassName,
  onChange = () => undefined,
}) => {
  const s = useSalon({ compact, active, color })

  const [tab, setTab] = useState<TTab>(TAB.ICON)
  const [direction, setDirection] = useState(1)
  const [panelOpen, setPanelOpen] = useState(false)
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

  const selectedValue = value ?? innerValue

  const handleStyleChange = (nextValue: TMarkerValue) => {
    setInnerValue(nextValue)
    onChange(nextValue)
  }

  const handleTabChange = (key: TTab) => {
    if (key === tab) return

    setDirection(TAB_ORDER.indexOf(key) > TAB_ORDER.indexOf(tab) ? 1 : -1)
    setTab(key)
    setMountedTabs((prev) => (prev[key] ? prev : { ...prev, [key]: true }))
  }

  const hiddenX = direction > 0 ? 14 : -14

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
        onHide={() => setPanelOpen(false)}
        content={
          <div className={s.panel}>
            <Tabs
              items={TAB_ITEMS}
              activeKey={tab}
              onChange={(key) => handleTabChange(key as TTab)}
              left={1.5}
              bottom={1.5}
            />

            <LazyMotion features={domAnimation}>
              <div className={s.content}>
                {mountedTabs[TAB.ICON] && (
                  <m.div
                    initial={false}
                    inert={tab !== TAB.ICON}
                    animate={{
                      opacity: tab === TAB.ICON ? 1 : 0,
                      x: tab === TAB.ICON ? 0 : hiddenX,
                      scale: tab === TAB.ICON ? 1 : 0.985,
                      pointerEvents: tab === TAB.ICON ? 'auto' : 'none',
                    }}
                    transition={TAB_TRANSITION}
                    aria-hidden={tab !== TAB.ICON}
                    className={`${s.tabPanel} ${tab === TAB.ICON ? s.tabPanelActive : s.tabPanelInactive}`}
                  >
                    <IconTab
                      panelOpen={panelOpen && tab === TAB.ICON}
                      selectedValue={selectedValue}
                      color={color}
                      onChange={handleStyleChange}
                    />
                  </m.div>
                )}

                {mountedTabs[TAB.EMOJI] && (
                  <m.div
                    initial={{ opacity: 0, x: hiddenX, scale: 0.985 }}
                    inert={tab !== TAB.EMOJI}
                    animate={{
                      opacity: tab === TAB.EMOJI ? 1 : 0,
                      x: tab === TAB.EMOJI ? 0 : hiddenX,
                      scale: tab === TAB.EMOJI ? 1 : 0.985,
                      pointerEvents: tab === TAB.EMOJI ? 'auto' : 'none',
                    }}
                    transition={TAB_TRANSITION}
                    aria-hidden={tab !== TAB.EMOJI}
                    className={`${s.tabPanel} ${tab === TAB.EMOJI ? s.tabPanelActive : s.tabPanelInactive}`}
                  >
                    <EmojiTab open={panelOpen && tab === TAB.EMOJI} onChange={handleStyleChange} />
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
            iconClassName={iconClassName ?? s.previewIconColor}
            emojiClassName={emojiClassName}
            devClassName={devClassName ?? s.previewDevLogo}
          />
        </button>
      </Tooltip>
    </div>
  )
}

export default MarkerPicker
