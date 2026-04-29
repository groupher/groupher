'use client'

import { LazyMotion, domAnimation, m } from 'motion/react'
import { type FC, useState } from 'react'

import type { TNodeStyleValue } from '~/spec'
import { ICONS } from '~/widgets/IconHub/icons'
import NodeStyleRender from '~/widgets/NodeStyleRender'
import { Tabs } from '~/widgets/Switcher'
import Tooltip from '~/widgets/Tooltip'

import ColorTab from './ColorTab'
import { DEFAULT_ICON_NAME, DEFAULT_PROVIDER, TAB, TAB_ITEMS } from './constant'
import EmojiTab from './EmojiTab'
import IconTab from './IconTab'
import useSalon from './salon'
import type { TNodeStylePickerProps, TTab } from './spec'

const TAB_ORDER = [TAB.ICON, TAB.COLOR, TAB.EMOJI] as const
const TAB_TRANSITION = {
  duration: 0.18,
  ease: 'easeOut',
} as const

const NodeStylePicker: FC<TNodeStylePickerProps> = ({
  testid = 'node-style-picker',
  value,
  onChange = console.log,
}) => {
  const s = useSalon()

  const [tab, setTab] = useState<TTab>(TAB.ICON)
  const [direction, setDirection] = useState(1)
  const [panelOpen, setPanelOpen] = useState(false)
  const [mountedTabs, setMountedTabs] = useState<Record<TTab, boolean>>({
    [TAB.ICON]: true,
    [TAB.COLOR]: false,
    [TAB.EMOJI]: false,
  })
  const [innerValue, setInnerValue] = useState<TNodeStyleValue>({
    type: 'icon',
    provider: DEFAULT_PROVIDER,
    name: DEFAULT_ICON_NAME,
    src: ICONS[DEFAULT_PROVIDER][DEFAULT_ICON_NAME],
  })

  const selectedValue = value ?? innerValue

  const handleStyleChange = (nextValue: TNodeStyleValue) => {
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
                      onChange={handleStyleChange}
                    />
                  </m.div>
                )}

                {mountedTabs[TAB.COLOR] && (
                  <m.div
                    initial={{ opacity: 0, x: hiddenX, scale: 0.985 }}
                    inert={tab !== TAB.COLOR}
                    animate={{
                      opacity: tab === TAB.COLOR ? 1 : 0,
                      x: tab === TAB.COLOR ? 0 : hiddenX,
                      scale: tab === TAB.COLOR ? 1 : 0.985,
                      pointerEvents: tab === TAB.COLOR ? 'auto' : 'none',
                    }}
                    transition={TAB_TRANSITION}
                    aria-hidden={tab !== TAB.COLOR}
                    className={`${s.tabPanel} ${tab === TAB.COLOR ? s.tabPanelActive : s.tabPanelInactive}`}
                  >
                    <ColorTab />
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
        <button type='button' className={s.trigger}>
          <NodeStyleRender value={selectedValue} size={18} iconClassName={s.previewIconColor} />
        </button>
      </Tooltip>
    </div>
  )
}

export default NodeStylePicker
